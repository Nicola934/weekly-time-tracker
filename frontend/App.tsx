import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Image,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import StartupSplash from './components/StartupSplash';
import WeeklyPlanner from './components/WeeklyPlanner';
import WeeklyReview from './components/WeeklyReview';
import {
  clearApiAuthToken,
  createSchedule,
  createTask,
  deleteSession as apiDeleteSession,
  endSession as apiEndSession,
  fetchCurrentUser,
  fetchPendingSyncEvents,
  fetchHabits,
  fetchHealth,
  fetchGoalContextSettings,
  fetchNotificationConfig,
  fetchSessions,
  fetchTasks,
  fetchWeeklyReport,
  loginUser,
  markSessionMissed,
  registerUser,
  setApiAuthToken,
  startSession as apiStartSession,
  updateSession as apiUpdateSession,
} from './services/api.js';
import {
  clearStoredAuthSession,
  loadStoredAuthSession,
  saveStoredAuthSession,
} from './services/authSession.js';
import {
  buildSessionCards,
  endSessionFlow,
  formatElapsed,
  getTaskCategoryLabel,
  getCurrentSession,
  getTaskGoalContext,
  MISSED_REASON_OPTIONS,
  SESSION_FAILURE_REASON_OPTIONS,
  skipSessionFlow,
  startSessionFlow,
  submitMissedSessionFlow,
} from './services/executionLoop.js';
import {
  createNotificationStorage,
  resetLocalAppState,
} from './services/notificationState.js';
import * as notificationRuntime from './services/notificationRuntime.js';
import {
  applyOfflineSessionEnd,
  applyOfflineSessionMissed,
  applyOfflineSessionStart,
  applyOfflineSessionUpdate,
  buildOfflineSession,
  buildOfflineTask,
  createTemporaryId,
  enqueueOfflineOperation,
  flushOfflineQueue,
  getPendingOperationCount,
  loadOfflineSnapshot,
  saveOfflineSnapshot,
  upsertSessionCollection,
  upsertTaskCollection,
} from './services/offlineStore.js';

const ENABLE_DEV_FALLBACK =
  process.env.EXPO_PUBLIC_ENABLE_DEV_FALLBACK === 'true';
const ENABLE_STARTUP_NOTIFICATION_RUNTIME =
  process.env.EXPO_PUBLIC_ENABLE_STARTUP_NOTIFICATION_RUNTIME !== 'false';
const ENABLE_STARTUP_NOTIFICATION_ACTIONS =
  process.env.EXPO_PUBLIC_ENABLE_STARTUP_NOTIFICATION_ACTIONS !== 'false';
const APP_LOG_PREFIX = '[app]';
const BRAND_LOGO_HEIGHT = 32;
const ACTIVE_DEVICE_SYNC_POLL_MS = 5_000;

function logAppInfo(message: string, details?: Record<string, unknown>) {
  if (details) {
    console.info(`${APP_LOG_PREFIX} ${message}`, details);
    return;
  }

  console.info(`${APP_LOG_PREFIX} ${message}`);
}

function logAppError(
  message: string,
  error: unknown,
  details?: Record<string, unknown>,
) {
  if (details) {
    console.error(`${APP_LOG_PREFIX} ${message}`, details, error);
    return;
  }

  console.error(`${APP_LOG_PREFIX} ${message}`, error);
}

async function runStartupStep<T>(
  label: string,
  action: () => Promise<T>,
  details?: Record<string, unknown>,
) {
  logAppInfo(`${label} start`, details);

  try {
    const value = await action();
    logAppInfo(`${label} complete`, details);
    return value;
  } catch (nextError) {
    logAppError(`${label} failed`, nextError, details);
    throw nextError;
  }
}

function getRuntimeProtocol() {
  if (
    typeof window !== 'undefined' &&
    typeof window.location?.protocol === 'string'
  ) {
    return window.location.protocol;
  }

  return 'native:';
}

function shouldRenderStartupSplash() {
  return Platform.OS !== 'web' || getRuntimeProtocol() === 'file:';
}

const logoSource = require('./assets/logo.png');
const brandLogoWidth = BRAND_LOGO_HEIGHT;

const fallbackTasks = [
  {
    id: 1,
    title: 'Strategic Planning',
    objective: 'Map next release priorities',
    category: 'Lionyx-E Automation Systems',
    long_term_goal: 'Launch Tenant Arrears Tracking system',
  },
  {
    id: 2,
    title: 'Execution Block',
    objective: 'Ship key workflow improvements',
    category: 'Lionyx-E Automation Systems',
    long_term_goal: 'Generate R300 000 recurring revenue',
  },
];

const fallbackSessions = [
  {
    id: 300,
    task_id: 1,
    planned_start: new Date(Date.now() + 60 * 60_000).toISOString(),
    planned_end: new Date(Date.now() + 120 * 60_000).toISOString(),
    reminder_offset_minutes: 5,
    actual_start: null,
    actual_end: null,
    completion_percent: 0,
    status: 'planned',
  },
  {
    id: 301,
    task_id: 2,
    planned_start: new Date(Date.now() - 30 * 60_000).toISOString(),
    planned_end: new Date(Date.now() + 30 * 60_000).toISOString(),
    actual_start: new Date(Date.now() - 25 * 60_000).toISOString(),
    actual_end: null,
    completion_percent: 0,
    status: 'active',
  },
];

const fallbackConfig = {
  display_name: 'Operator',
  tone: 'strict',
  pre_session_minutes: 10,
  enabled: true,
  start_script: 'session starts now.',
  late_script: 'you are now {minutes} minutes late. Start now.',
  pre_script: 'session starts in {minutes} minutes.',
};

const fallbackGoalSettings = {
  category_goals: {
    'Lionyx-E Automation Systems': [
      'Launch Tenant Arrears Tracking system',
      'Generate R300 000 recurring revenue',
    ],
  },
};

const EMPTY_NOTIFICATION_DEBUG = {
  scheduledReminderCount: 0,
  deliveredLateReminderCount: 0,
  lastSpeechResult: 'none',
  lastNotificationResult: 'none',
};

function getLocalTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function normalizePositiveId(value: unknown) {
  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function getLatestSyncEventId(events: any[] | null | undefined) {
  return (events ?? []).reduce((maxEventId, event) => {
    const eventId = normalizePositiveId(event?.id);
    return eventId !== null && eventId > maxEventId ? eventId : maxEventId;
  }, 0);
}

function buildPlannerTaskPayload({
  taskTitle,
  category,
  objective,
  goalContext,
}: {
  taskTitle: string;
  category: string;
  objective: string;
  goalContext: string;
}) {
  const normalizedTitle = String(taskTitle || '').trim();
  const normalizedCategory = String(
    category || 'Weekly execution consistency',
  ).trim();
  const normalizedObjective = String(objective || 'Execution block').trim();

  return {
    title: normalizedTitle,
    objective: normalizedObjective || 'Execution block',
    category: normalizedCategory || 'Weekly execution consistency',
    long_term_goal: String(goalContext || '').trim(),
    priority: 3,
    estimated_hours: 1,
  };
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function startOfWeek(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const dow = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - dow);
  return date;
}

function endOfWeek(value: Date) {
  const date = addDays(startOfWeek(value), 6);
  date.setHours(23, 59, 59, 0);
  return date;
}

function formatWeekRangeLabel(start: Date, end: Date) {
  const sameYear = start.getFullYear() === end.getFullYear();
  const left = start.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const right = end.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return `${left} - ${right}`;
}

function isInWeekRange(value: string, weekStart: Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const rangeStart = startOfWeek(weekStart);
  const rangeEndExclusive = addDays(rangeStart, 7);
  return (
    date.getTime() >= rangeStart.getTime() &&
    date.getTime() < rangeEndExclusive.getTime()
  );
}

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMonthKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatTimeInput(value: string) {
  const date = new Date(value);
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

function parseDateInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  if (!match) {
    throw new Error('Use YYYY-MM-DD for the follow-up day.');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error('Choose a valid follow-up day.');
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

function parseTimeParts(timeText: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(timeText).trim());
  if (!match) {
    throw new Error('Use HH:MM for follow-up times.');
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error('Follow-up times must be valid 24-hour values.');
  }

  return { hour, minute };
}

function formatLocalDateTime(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hour = String(value.getHours()).padStart(2, '0');
  const minute = String(value.getMinutes()).padStart(2, '0');
  const second = String(value.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

function buildFutureSessionRange(
  dateText: string,
  startText: string,
  endText: string,
  now = new Date(),
) {
  const targetDate = parseDateInput(dateText);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  if (targetDate.getTime() <= today.getTime()) {
    throw new Error('Choose a future day for the unfinished work.');
  }

  const { hour: startHour, minute: startMinute } = parseTimeParts(startText);
  const { hour: endHour, minute: endMinute } = parseTimeParts(endText);
  const start = new Date(targetDate);
  const end = new Date(targetDate);

  start.setHours(startHour, startMinute, 0, 0);
  end.setHours(endHour, endMinute, 0, 0);

  if (end <= start) {
    throw new Error('Follow-up end time must be after start time.');
  }

  return {
    startIso: formatLocalDateTime(start),
    endIso: formatLocalDateTime(end),
  };
}

function formatFollowUpLabel(dateText: string, startText: string, endText: string) {
  return `${parseDateInput(dateText).toLocaleDateString([], {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })} ${startText} - ${endText}`;
}

function getNotificationStatusLabel(permissionState: string) {
  switch (permissionState) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'blocked';
    case 'deferred':
      return 'deferred';
    case 'default':
      return 'permission required';
    case 'unavailable':
      return 'unavailable';
    case 'pending':
      return 'checking';
    default:
      return permissionState;
  }
}

function getNotificationPermissionMessage(permissionState: string) {
  switch (permissionState) {
    case 'denied':
      return 'Browser notifications are blocked. Enable permission for this app or reminders will not fire.';
    case 'deferred':
      return 'Notification startup is deferred until you enable it from this panel.';
    case 'default':
      return 'Notifications are not enabled yet. Allow permission to arm planner reminders.';
    case 'unavailable':
      return 'This runtime does not expose browser notifications, so reminder pop-ups cannot fire here.';
    default:
      return null;
  }
}

function getNotificationScheduleState(permissionState: string) {
  switch (permissionState) {
    case 'denied':
      return 'notifications blocked';
    case 'deferred':
      return 'startup notifications disabled';
    case 'default':
      return 'notification permission required';
    case 'unavailable':
      return 'notifications unavailable';
    default:
      return 'idle';
  }
}

function buildSessionCardsSafely(params: any) {
  try {
    return buildSessionCards(params);
  } catch (nextError) {
    logAppError('executionLoop session card build failed', nextError);
    return [];
  }
}

function parseDateInputSafely(value: string) {
  try {
    return parseDateInput(value);
  } catch (nextError) {
    logAppError('active week parsing failed', nextError, { value });
    return startOfWeek(new Date());
  }
}

function resolveApiErrorCategory(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    typeof (error as any).category === 'string' &&
    (error as any).category.trim()
  ) {
    return (error as any).category.trim();
  }

  const message =
    error instanceof Error && typeof error.message === 'string'
      ? error.message.toLowerCase()
      : '';
  if (message.includes('timeout')) {
    return 'timeout';
  }
  if (message.includes('non-200')) {
    return 'non-200';
  }
  return 'network error';
}

function resolveApiErrorDetail(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    typeof (error as any).detail === 'string' &&
    (error as any).detail.trim()
  ) {
    return (error as any).detail.trim();
  }

  if (error instanceof Error && error.message) {
    return error.message.trim();
  }

  return '';
}

function describeStartupFailure(label: string, error: unknown) {
  const category = resolveApiErrorCategory(error);
  const detail = resolveApiErrorDetail(error);

  if (!detail) {
    return `${label}: ${category}`;
  }

  const normalizedDetail = detail.toLowerCase();
  if (
    normalizedDetail.includes(category) ||
    normalizedDetail.startsWith(`${label.toLowerCase()}:`)
  ) {
    return `${label}: ${detail}`;
  }

  return `${label}: ${category} (${detail})`;
}

function isOfflineCapableError(error: unknown) {
  const category = resolveApiErrorCategory(error);
  return category === 'network error' || category === 'timeout';
}

function isUnauthorizedError(error: unknown) {
  return (
    error &&
    typeof error === 'object' &&
    Number((error as any).status) === 401
  );
}

function buildDataUnavailableMessage(
  failures: Array<{ label: string; error: unknown }>,
) {
  if (failures.length === 0) {
    return 'Backend online, data temporarily unavailable';
  }

  return `Backend online, data temporarily unavailable. Reason: ${failures
    .map((failure) => describeStartupFailure(failure.label, failure.error))
    .join('; ')}.`;
}

type AppErrorBoundaryProps = {
  children: React.ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    logAppError('render boundary caught a fatal startup error', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.fatalShell}>
          <View style={styles.fatalCard}>
            <Text style={styles.fatalTitle}>App failed to load</Text>
            <Text style={styles.fatalBody}>
              Check the console output for the production startup failure.
            </Text>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppShell />
    </AppErrorBoundary>
  );
}

function AppShell() {
  const [showSplash, setShowSplash] = useState(() => shouldRenderStartupSplash());
  const [authReady, setAuthReady] = useState(false);
  const [authSession, setAuthSession] = useState<any | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [tasks, setTasks] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(fallbackConfig);
  const [goalSettings, setGoalSettings] = useState<any>(fallbackGoalSettings);
  const [loading, setLoading] = useState(true);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [permissionState, setPermissionState] = useState(
    ENABLE_STARTUP_NOTIFICATION_RUNTIME ? 'pending' : 'deferred',
  );
  const [scheduleState, setScheduleState] = useState(
    getNotificationScheduleState(
      ENABLE_STARTUP_NOTIFICATION_RUNTIME ? 'pending' : 'deferred',
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [missedTarget, setMissedTarget] = useState<any | null>(null);
  const [selectedReason, setSelectedReason] = useState('Social media');
  const [customReason, setCustomReason] = useState('');
  const [elapsedClock, setElapsedClock] = useState('00:00');
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const [notificationDebug, setNotificationDebug] = useState(
    EMPTY_NOTIFICATION_DEBUG,
  );
  const [completionSummary, setCompletionSummary] = useState<any | null>(null);
  const [plannerEditRequest, setPlannerEditRequest] = useState<any | null>(null);
  const [endSessionTarget, setEndSessionTarget] = useState<any | null>(null);
  const [objectiveCompletionChoice, setObjectiveCompletionChoice] = useState<
    'yes' | 'no' | null
  >(null);
  const [reflectionNotes, setReflectionNotes] = useState('');
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [failureReasonDetail, setFailureReasonDetail] = useState('');
  const [distractionCategory, setDistractionCategory] = useState('');
  const [followUpDate, setFollowUpDate] = useState(
    formatDateInput(addDays(new Date(), 1)),
  );
  const [followUpStartTime, setFollowUpStartTime] = useState('09:00');
  const [followUpEndTime, setFollowUpEndTime] = useState('10:00');
  const [endSessionError, setEndSessionError] = useState<string | null>(null);
  const [activeWeek, setActiveWeek] = useState(() => {
    const weekStart = startOfWeek(new Date());
    return {
      key: formatDateInput(weekStart),
      label: formatWeekRangeLabel(weekStart, endOfWeek(weekStart)),
      monthKey: formatMonthKey(startOfMonth(new Date())),
    };
  });
  const [weeklyReviewVisible, setWeeklyReviewVisible] = useState(false);
  const [weeklyReviewLoading, setWeeklyReviewLoading] = useState(false);
  const [weeklyReviewError, setWeeklyReviewError] = useState<string | null>(null);
  const [weeklyReviewData, setWeeklyReviewData] = useState<any | null>(null);
  const [weeklyReviewWindow, setWeeklyReviewWindow] = useState<any | null>(null);
  const pendingActionRef = useRef<string | null>(null);
  const loadingRef = useRef(true);
  const sessionCardsRef = useRef<any[]>([]);
  const notificationActionHandlersRef = useRef<{
    onStart: (action: any) => Promise<void>;
    onSkip: (action: any) => Promise<void>;
  }>({
    onStart: async () => undefined,
    onSkip: async () => undefined,
  });
  const latestReminderInputsRef = useRef({
    tasks: fallbackTasks,
    sessions: fallbackSessions,
    config: fallbackConfig,
    categoryGoals: fallbackGoalSettings.category_goals,
  });
  const notificationStorageRef = useRef<any | null>(null);
  const reminderRuntimeRef = useRef<{
    stopWebTimers: () => void;
    stopLateLoop: () => void;
  }>({
    stopWebTimers: () => undefined,
    stopLateLoop: () => undefined,
  });
  const bootSessionKeyRef = useRef<string | null>(null);
  const notificationRuntimeEnabledRef = useRef(
    ENABLE_STARTUP_NOTIFICATION_RUNTIME,
  );
  const notificationActionCleanupRef = useRef<() => void>(() => undefined);
  const notificationDeliveryCleanupRef = useRef<() => void>(() => undefined);
  const notificationActionSubscribedRef = useRef(false);
  const notificationDeliverySubscribedRef = useRef(false);
  const refreshAllInFlightRef = useRef<Promise<void> | null>(null);
  const remoteSyncCursorRef = useRef(0);
  const executionLoopInitLoggedRef = useRef(false);
  const plannerBootstrapLoggedRef = useRef(false);
  const authUserId = normalizePositiveId(authSession?.user?.id);

  const updateNotificationDebug = (next: Record<string, unknown>) => {
    setNotificationDebug((current) => ({ ...current, ...next }));
  };

  const resolveConfigWithDisplayName = useCallback(
    (nextConfig: any) => ({
      ...fallbackConfig,
      ...(nextConfig || {}),
      display_name:
        String(authSession?.user?.name || '').trim() || fallbackConfig.display_name,
    }),
    [authSession?.user?.name],
  );

  const applySnapshotToState = useCallback(
    (snapshot: any) => {
      if (!snapshot || typeof snapshot !== 'object') {
        return false;
      }

      const nextTasks = Array.isArray(snapshot.tasks) ? snapshot.tasks : [];
      const nextSessions = Array.isArray(snapshot.sessions) ? snapshot.sessions : [];
      const nextConfig = resolveConfigWithDisplayName(snapshot.config);
      const nextGoalSettings = snapshot.goalSettings || fallbackGoalSettings;

      setTasks(nextTasks);
      setSessions(nextSessions);
      setConfig(nextConfig);
      setGoalSettings(nextGoalSettings);
      latestReminderInputsRef.current = {
        tasks: nextTasks,
        sessions: nextSessions,
        config: nextConfig,
        categoryGoals: nextGoalSettings?.category_goals ?? {},
      };
      return (
        nextTasks.length > 0 ||
        nextSessions.length > 0 ||
        Boolean(snapshot.config) ||
        Boolean(snapshot.goalSettings)
      );
    },
    [resolveConfigWithDisplayName],
  );

  const refreshPendingSyncState = useCallback(async () => {
    if (authUserId === null) {
      setPendingSyncCount(0);
      return 0;
    }

    const count = await getPendingOperationCount(authUserId);
    setPendingSyncCount(count);
    return count;
  }, [authUserId]);

  const stopReminderRuntime = () => {
    reminderRuntimeRef.current.stopWebTimers();
    reminderRuntimeRef.current.stopLateLoop();
    reminderRuntimeRef.current = {
      stopWebTimers: () => undefined,
      stopLateLoop: () => undefined,
    };
  };

  const ensureNotificationActionSubscription = async () => {
    if (
      !notificationRuntimeEnabledRef.current ||
      (notificationActionSubscribedRef.current &&
        notificationDeliverySubscribedRef.current)
    ) {
      return;
    }

    logAppInfo('notification system init', {
      autoStart: notificationRuntimeEnabledRef.current,
    });

    if (!notificationActionSubscribedRef.current) {
      try {
        const stopListening =
          notificationRuntime.subscribeToNotificationActions({
            onStart: (action: any) =>
              notificationActionHandlersRef.current.onStart(action),
            onSkip: (action: any) =>
              notificationActionHandlersRef.current.onSkip(action),
            onError: (nextError: unknown) => {
              logAppError('notification action handling failed', nextError);
              setError(
                resolveErrorMessage(
                  nextError,
                  'Failed to handle notification action',
                ),
              );
            },
          });
        notificationActionCleanupRef.current = stopListening;
        notificationActionSubscribedRef.current = true;
        logAppInfo('notification action handlers subscribed');
      } catch (nextError) {
        logAppError('notification action subscription failed', nextError);
      }
    }

    if (!notificationDeliverySubscribedRef.current) {
      try {
        const stopListening =
          notificationRuntime.subscribeToNotificationDeliveries({
            onDebug: updateNotificationDebug,
            onError: (nextError: unknown) => {
              logAppError('notification delivery handling failed', nextError);
            },
          });
        notificationDeliveryCleanupRef.current = stopListening;
        notificationDeliverySubscribedRef.current = true;
        logAppInfo('notification delivery listener subscribed');
      } catch (nextError) {
        logAppError('notification delivery subscription failed', nextError);
      }
    }
  };

  const armReminderRuntime = async ({
    promptForPermission = false,
    forceEnable = false,
  }: {
    promptForPermission?: boolean;
    forceEnable?: boolean;
  } = {}) => {
    logAppInfo('notification init start', {
      promptForPermission,
      forceEnable,
      runtimeEnabled: notificationRuntimeEnabledRef.current,
    });
    stopReminderRuntime();
    if (forceEnable) {
      notificationRuntimeEnabledRef.current = true;
    }

    if (!notificationRuntimeEnabledRef.current) {
      setPermissionState('deferred');
      setScheduleState(getNotificationScheduleState('deferred'));
      updateNotificationDebug({ scheduledReminderCount: 0 });
      logAppInfo('notification init skipped', {
        reason: 'startup disabled',
      });
      return;
    }

    const nextConfig = latestReminderInputsRef.current.config;
    if (!nextConfig?.enabled) {
      setScheduleState('disabled');
      updateNotificationDebug({ scheduledReminderCount: 0 });
      logAppInfo('notification init skipped', {
        reason: 'notifications disabled in config',
      });
      return;
    }

    try {
      await ensureNotificationActionSubscription();
      let permission = await notificationRuntime.getReminderPermissionStatus();
      if (permission === 'default' && promptForPermission) {
        permission = await notificationRuntime.requestReminderPermissions();
      }

      setPermissionState(permission);
      if (permission !== 'granted') {
        setScheduleState(getNotificationScheduleState(permission));
        updateNotificationDebug({ scheduledReminderCount: 0 });
        return;
      }

      const storage =
        notificationStorageRef.current ?? (await createNotificationStorage());
      notificationStorageRef.current = storage;

      const reminderSessions = buildSessionCardsSafely({
        sessions: latestReminderInputsRef.current.sessions,
        tasks: latestReminderInputsRef.current.tasks,
        now: new Date(),
        categoryGoals: latestReminderInputsRef.current.categoryGoals,
      });
      const scheduled =
        await notificationRuntime.reconcileNotificationLifecycle({
        sessions: reminderSessions,
        config: nextConfig,
        storage,
        notifier: undefined,
        onDebug: updateNotificationDebug,
      });

      reminderRuntimeRef.current.stopWebTimers =
        notificationRuntime.startWebReminderTimers(scheduled, {
          storage,
          onDebug: updateNotificationDebug,
        });
      reminderRuntimeRef.current.stopLateLoop =
        notificationRuntime.startLateCheckLoop({
        sessions: () =>
          buildSessionCardsSafely({
            sessions: latestReminderInputsRef.current.sessions,
            tasks: latestReminderInputsRef.current.tasks,
            now: new Date(),
            categoryGoals: latestReminderInputsRef.current.categoryGoals,
          }),
        config: () => latestReminderInputsRef.current.config,
        onLateDetected: undefined,
        storage,
        notifier: undefined,
        onDebug: updateNotificationDebug,
        });
      setScheduleState(
        scheduled.length > 0 ? `${scheduled.length} reminders armed` : 'no reminders armed',
      );
      logAppInfo('notification init complete', {
        scheduledReminderCount: scheduled.length,
        permission,
      });
    } catch (nextError) {
      logAppError('notification runtime setup failed', nextError);
      setPermissionState('unavailable');
      setScheduleState('notification unavailable');
      updateNotificationDebug({ scheduledReminderCount: 0 });
    }
  };

  const refreshAll = async ({
    promptForPermission = false,
    enableNotifications = false,
  }: {
    promptForPermission?: boolean;
    enableNotifications?: boolean;
  } = {}) => {
    if (refreshAllInFlightRef.current) {
      return refreshAllInFlightRef.current;
    }

    const runRefresh = async () => {
      if (authSession === null || authUserId === null) {
        return;
      }

      logAppInfo('API initialization', {
        promptForPermission,
        enableNotifications,
      });

      const cachedSnapshot = await loadOfflineSnapshot(authUserId);
      const hasCachedData =
        (Array.isArray(cachedSnapshot?.tasks) && cachedSnapshot.tasks.length > 0) ||
        (Array.isArray(cachedSnapshot?.sessions) && cachedSnapshot.sessions.length > 0) ||
        Boolean(cachedSnapshot?.config) ||
        Boolean(cachedSnapshot?.goalSettings);
      const hasCurrentState =
        tasks.length > 0 ||
        sessions.length > 0 ||
        Boolean(config) ||
        Boolean(goalSettings);
      const hasRecoverableLocalState = hasCachedData || hasCurrentState;

      try {
        try {
          const remoteUser = await fetchCurrentUser();
          const remoteUserId = normalizePositiveId(remoteUser?.id);
          if (remoteUserId !== null && remoteUserId !== authUserId) {
            throw new Error('Signed-in account changed. Sign in again.');
          }
        } catch (nextError) {
          if (isUnauthorizedError(nextError)) {
            await clearStoredAuthSession();
            clearApiAuthToken();
            setAuthSession(null);
            setPendingSyncCount(0);
            setError('Session expired. Sign in again.');
            throw nextError;
          }

          if (!isOfflineCapableError(nextError)) {
            throw nextError;
          }
        }

        try {
          await flushOfflineQueue(authUserId, {
            createTask,
            createSchedule,
            updateSession: apiUpdateSession,
            deleteSession: apiDeleteSession,
            startSession: apiStartSession,
            endSession: apiEndSession,
            markSessionMissed,
          });
        } catch (nextError) {
          if (!isOfflineCapableError(nextError)) {
            throw nextError;
          }
        }

        await refreshPendingSyncState();

        const [
          healthResult,
          remoteTasksResult,
          remoteSessionsResult,
          remoteConfigResult,
          remoteGoalSettingsResult,
        ] = await Promise.allSettled([
          runStartupStep('API init health', () => fetchHealth()),
          runStartupStep('API init tasks', () => fetchTasks()),
          runStartupStep('API init sessions', () => fetchSessions()),
          runStartupStep('API init notification config', () =>
            fetchNotificationConfig(),
          ),
          runStartupStep('API init goal context', () =>
            fetchGoalContextSettings(),
          ),
        ]);

        const healthReachable = healthResult.status === 'fulfilled';
        const sessionsLoaded = remoteSessionsResult.status === 'fulfilled';
        const tasksLoaded = remoteTasksResult.status === 'fulfilled';
        const backendReachable = healthReachable || tasksLoaded || sessionsLoaded;

        if (!backendReachable) {
          const offlineFailures = [
            {
              label: 'health',
              error:
                healthResult.status === 'rejected'
                  ? healthResult.reason
                  : new Error('Unknown health check failure'),
            },
            {
              label: 'tasks',
              error:
                remoteTasksResult.status === 'rejected'
                  ? remoteTasksResult.reason
                  : new Error('Unknown tasks failure'),
            },
            {
              label: 'sessions',
              error:
                remoteSessionsResult.status === 'rejected'
                  ? remoteSessionsResult.reason
                  : new Error('Unknown sessions failure'),
            },
          ];
          const offlineMessage = `Failed to connect to backend. Reason: ${offlineFailures
            .map((failure) => describeStartupFailure(failure.label, failure.error))
            .join('; ')}.`;

          setBackendStatus('offline');
          if (hasRecoverableLocalState) {
            if (!hasCurrentState) {
              applySnapshotToState(cachedSnapshot);
            }
            setError(
              pendingSyncCount > 0
                ? `Backend offline. Using cached data with ${pendingSyncCount} queued changes.`
                : 'Backend offline. Using cached data.',
            );
            await armReminderRuntime({
              promptForPermission,
              forceEnable: enableNotifications,
            });
            return;
          }

          stopReminderRuntime();
          setScheduleState('backend offline');
          setError(offlineMessage);
          throw new Error(offlineMessage);
        }

        const nextTasks =
          remoteTasksResult.status === 'fulfilled'
            ? remoteTasksResult.value
            : Array.isArray(cachedSnapshot?.tasks)
              ? cachedSnapshot.tasks
              : tasks;
        const nextSessions =
          remoteSessionsResult.status === 'fulfilled'
            ? remoteSessionsResult.value
            : Array.isArray(cachedSnapshot?.sessions)
              ? cachedSnapshot.sessions
              : sessions;
        const nextConfig =
          remoteConfigResult.status === 'fulfilled'
            ? resolveConfigWithDisplayName(remoteConfigResult.value)
            : resolveConfigWithDisplayName(cachedSnapshot?.config || config);
        const nextGoalSettings =
          remoteGoalSettingsResult.status === 'fulfilled'
            ? remoteGoalSettingsResult.value ?? { category_goals: {} }
            : cachedSnapshot?.goalSettings || goalSettings;

        latestReminderInputsRef.current = {
          tasks: nextTasks,
          sessions: nextSessions,
          config: nextConfig,
          categoryGoals: nextGoalSettings?.category_goals ?? {},
        };

        if (healthResult.status === 'fulfilled') {
          setBackendStatus(
            healthResult.value?.status === 'ok' ? 'connected' : 'unhealthy',
          );
        } else {
          setBackendStatus('connected');
        }

        setTasks(nextTasks);
        setSessions(nextSessions);
        setConfig(nextConfig);
        setGoalSettings(nextGoalSettings);

        const dataFailures: Array<{ label: string; error: unknown }> = [];
        if (remoteTasksResult.status === 'rejected') {
          dataFailures.push({ label: 'tasks', error: remoteTasksResult.reason });
        }
        if (remoteSessionsResult.status === 'rejected') {
          dataFailures.push({
            label: 'sessions',
            error: remoteSessionsResult.reason,
          });
        }

        if (dataFailures.length > 0) {
          const dataUnavailableMessage = buildDataUnavailableMessage(dataFailures);
          setError(dataUnavailableMessage);
          logAppInfo('startup data partially unavailable', {
            failures: dataFailures.map((failure) =>
              describeStartupFailure(failure.label, failure.error),
            ),
          });
        } else {
          setError(null);
        }

        await refreshPendingSyncState();
        try {
          const pendingSyncEvents = await fetchPendingSyncEvents();
          remoteSyncCursorRef.current = getLatestSyncEventId(pendingSyncEvents);
        } catch (nextError) {
          if (
            !isOfflineCapableError(nextError) &&
            !isUnauthorizedError(nextError)
          ) {
            logAppError('pending sync cursor refresh failed', nextError);
          }
        }

        await armReminderRuntime({
          promptForPermission,
          forceEnable: enableNotifications,
        });
      } catch (nextError) {
        if (hasRecoverableLocalState && isOfflineCapableError(nextError)) {
          if (!hasCurrentState) {
            applySnapshotToState(cachedSnapshot);
          }
          setBackendStatus('offline');
          setError(
            pendingSyncCount > 0
              ? `Backend offline. Using cached data with ${pendingSyncCount} queued changes.`
              : 'Backend offline. Using cached data.',
          );
          await armReminderRuntime({
            promptForPermission,
            forceEnable: enableNotifications,
          });
          return;
        }

        logAppError('API initialization failed', nextError);
        throw nextError;
      }
    };

    const refreshPromise = runRefresh();
    const trackedRefreshPromise = refreshPromise.finally(() => {
      if (refreshAllInFlightRef.current === trackedRefreshPromise) {
        refreshAllInFlightRef.current = null;
      }
    });
    refreshAllInFlightRef.current = trackedRefreshPromise;
    return trackedRefreshPromise;
  };

  const refreshHabits = async () => {
    try {
      await fetchHabits();
    } catch (nextError) {
      logAppError('habit refresh failed', nextError);
      // Habit refresh is informational for the current flow.
    }
  };

  useEffect(() => {
    if (showSplash || authReady) {
      return;
    }

    let cancelled = false;

    const loadAuth = async () => {
      try {
        const storedSession = await loadStoredAuthSession();
        if (cancelled) {
          return;
        }

        if (storedSession?.token) {
          setApiAuthToken(storedSession.token);
        }

        setAuthSession(storedSession);
        setAuthName(String(storedSession?.user?.name || '').trim());
        setAuthEmail(String(storedSession?.user?.email || '').trim());
      } catch (nextError) {
        logAppError('stored auth session load failed', nextError);
      } finally {
        if (!cancelled) {
          setAuthReady(true);
        }
      }
    };

    void loadAuth();

    return () => {
      cancelled = true;
    };
  }, [authReady, showSplash]);

  useEffect(() => {
    if (!authReady || authUserId === null) {
      return;
    }

    void refreshPendingSyncState();
  }, [authReady, authUserId, refreshPendingSyncState]);

  useEffect(() => {
    if (!authReady || authSession === null || authUserId === null) {
      return;
    }

    let cancelled = false;

    const pollRemoteSyncChanges = async () => {
      if (
        cancelled ||
        loadingRef.current ||
        pendingActionRef.current ||
        refreshAllInFlightRef.current
      ) {
        return;
      }

      try {
        const pendingSyncEvents = await fetchPendingSyncEvents();
        const latestSyncEventId = getLatestSyncEventId(pendingSyncEvents);
        const previousSyncEventId = remoteSyncCursorRef.current;

        if (latestSyncEventId <= 0) {
          return;
        }

        if (latestSyncEventId > previousSyncEventId) {
          remoteSyncCursorRef.current = latestSyncEventId;
          logAppInfo('remote sync change detected', {
            previousSyncEventId,
            latestSyncEventId,
          });
          await refreshAll();
          return;
        }

        remoteSyncCursorRef.current = Math.max(
          previousSyncEventId,
          latestSyncEventId,
        );
      } catch (nextError) {
        if (
          !cancelled &&
          !isOfflineCapableError(nextError) &&
          !isUnauthorizedError(nextError)
        ) {
          logAppError('remote sync poll failed', nextError);
        }
      }
    };

    const intervalId = setInterval(() => {
      void pollRemoteSyncChanges();
    }, ACTIVE_DEVICE_SYNC_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [authReady, authSession, authUserId]);

  useEffect(() => {
    if (!authReady || authUserId === null) {
      return;
    }

    void saveOfflineSnapshot(authUserId, {
      tasks,
      sessions,
      config,
      goalSettings,
      lastSyncedAt: new Date().toISOString(),
    });
  }, [authReady, authUserId, config, goalSettings, sessions, tasks]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    logAppInfo('startup', {
      platform: Platform.OS,
      protocol: getRuntimeProtocol(),
      startupNotificationsEnabled: ENABLE_STARTUP_NOTIFICATION_RUNTIME,
    });

    if (
      typeof window === 'undefined' ||
      typeof window.addEventListener !== 'function' ||
      typeof window.removeEventListener !== 'function'
    ) {
      return undefined;
    }

    const handleGlobalError = (event: ErrorEvent) => {
      logAppError('window error', event.error ?? event.message);
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logAppError('unhandled rejection', event.reason);
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    if (showSplash || !authReady) {
      return;
    }

    if (!authSession) {
      setLoading(false);
      return;
    }

    const bootKey = `${authSession.user?.id}:${authSession.token}`;
    if (bootSessionKeyRef.current === bootKey) {
      return;
    }

    bootSessionKeyRef.current = bootKey;
    let cancelled = false;
    const bootTimer = setTimeout(() => {
      const boot = async () => {
        logAppInfo('app startup boot begin');
        try {
          if (!executionLoopInitLoggedRef.current) {
            executionLoopInitLoggedRef.current = true;
            logAppInfo('executionLoop init');
          }

          if (authUserId !== null) {
            const cachedSnapshot = await loadOfflineSnapshot(authUserId);
            if (!cancelled) {
              applySnapshotToState(cachedSnapshot);
            }
          }

          await refreshAll({
            promptForPermission: false,
            enableNotifications:
              ENABLE_STARTUP_NOTIFICATION_RUNTIME &&
              ENABLE_STARTUP_NOTIFICATION_ACTIONS,
          });
        } catch (nextError: any) {
          console.error('Startup error:', nextError);
          if (!cancelled && ENABLE_DEV_FALLBACK) {
            latestReminderInputsRef.current = {
              tasks: fallbackTasks,
              sessions: fallbackSessions,
              config: fallbackConfig,
              categoryGoals: fallbackGoalSettings.category_goals,
            };
            setTasks(fallbackTasks);
            setSessions(fallbackSessions);
            setConfig(fallbackConfig);
            setGoalSettings(fallbackGoalSettings);
            setBackendStatus('dev fallback');
            setError(null);
            await armReminderRuntime();
          } else if (!cancelled) {
            logAppError('startup boot failed', nextError);
            setBackendStatus('offline');
            stopReminderRuntime();
            setScheduleState('backend offline');
            setError(
              resolveErrorMessage(nextError, 'Failed to connect to backend'),
            );
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

      void boot();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(bootTimer);
    };
  }, [applySnapshotToState, authReady, authSession, authUserId, showSplash]);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (next) => {
      if (
        next !== 'active' ||
        loadingRef.current ||
        !notificationRuntimeEnabledRef.current
      ) {
        return;
      }

      void armReminderRuntime();
    });

    return () => {
      appStateSubscription.remove();
      notificationActionCleanupRef.current();
      notificationActionCleanupRef.current = () => undefined;
      notificationActionSubscribedRef.current = false;
      notificationDeliveryCleanupRef.current();
      notificationDeliveryCleanupRef.current = () => undefined;
      notificationDeliverySubscribedRef.current = false;
      stopReminderRuntime();
    };
  }, []);

  const sessionCards = useMemo(
    () =>
      buildSessionCardsSafely({
        sessions,
        tasks,
        now: new Date(),
        categoryGoals: goalSettings?.category_goals ?? {},
      }),
    [goalSettings, sessions, tasks],
  );
  sessionCardsRef.current = sessionCards;

  useEffect(() => {
    if (plannerBootstrapLoggedRef.current) {
      return;
    }

    plannerBootstrapLoggedRef.current = true;
    logAppInfo('weekly planner/session bootstrap', {
      sessionCount: sessionCards.length,
      taskCount: tasks.length,
      activeWeekKey: activeWeek.key,
    });
  }, [activeWeek.key, sessionCards.length, tasks.length]);

  const currentSession = useMemo(
    () => getCurrentSession(sessionCards),
    [sessionCards],
  );
  const activeWeekStart = useMemo(
    () => parseDateInputSafely(activeWeek.key),
    [activeWeek.key],
  );
  const activeWeekEnd = useMemo(
    () => endOfWeek(activeWeekStart),
    [activeWeek.key, activeWeekStart],
  );
  const currentWeekKey = formatDateInput(startOfWeek(new Date()));
  const isCurrentActiveWeek = activeWeek.key === currentWeekKey;
  const activeWeekSessionCards = useMemo(
    () =>
      sessionCards.filter((item: any) =>
        isInWeekRange(item.plannedStart, activeWeekStart),
      ),
    [activeWeek.key, sessionCards],
  );

  useEffect(() => {
    if (!currentSession?.actualStart) {
      setElapsedClock('00:00');
      return;
    }

    const timer = setInterval(() => {
      setElapsedClock(formatElapsed(currentSession.actualStart, new Date()));
    }, 1000);

    return () => clearInterval(timer);
  }, [currentSession?.actualStart]);

  useEffect(() => {
    if (!weeklyReviewVisible) {
      return;
    }

    let cancelled = false;

    const loadWeeklyReview = async () => {
      const rangeStart = activeWeekStart;
      const rangeEnd = activeWeekEnd;
      const effectiveEnd = isCurrentActiveWeek ? new Date() : rangeEnd;
      const nextWindow = {
        start: formatLocalDateTime(rangeStart),
        end: formatLocalDateTime(rangeEnd),
        effectiveEnd: formatLocalDateTime(effectiveEnd),
      };

      if (!cancelled) {
        setWeeklyReviewWindow(nextWindow);
        setWeeklyReviewLoading(true);
        setWeeklyReviewError(null);
        setWeeklyReviewData(null);
      }

      try {
        const report = await fetchWeeklyReport({
          start: nextWindow.start,
          end: nextWindow.effectiveEnd,
        });
        if (!cancelled) {
          setWeeklyReviewData(report);
        }
      } catch (nextError) {
        logAppError('weekly review fetch failed', nextError);
        if (!cancelled) {
          setWeeklyReviewError(
            resolveErrorMessage(nextError, 'Failed to load weekly review'),
          );
        }
      } finally {
        if (!cancelled) {
          setWeeklyReviewLoading(false);
        }
      }
    };

    void loadWeeklyReview();

    return () => {
      cancelled = true;
    };
  }, [
    activeWeek.key,
    isCurrentActiveWeek,
    sessions,
    weeklyReviewVisible,
  ]);

  const isUiLocked = pendingActionKey !== null;
  const actionKeyFor = (action: string, sessionId: number | string) =>
    `${action}:${sessionId}`;
  const isActionPending = (action: string, sessionId: number | string) =>
    pendingActionKey === actionKeyFor(action, sessionId);

  const runLockedAction = async (
    actionKey: string,
    action: () => Promise<void>,
    fallbackMessage: string,
  ) => {
    if (pendingActionRef.current) {
      return;
    }

    pendingActionRef.current = actionKey;
    setPendingActionKey(actionKey);
    try {
      setError(null);
      await action();
    } catch (nextError) {
      logAppError(fallbackMessage, nextError);
      setError(resolveErrorMessage(nextError, fallbackMessage));
    } finally {
      pendingActionRef.current = null;
      setPendingActionKey(null);
    }
  };

  const clearSessionReminders = async (sessionId: number | string) => {
    if (!notificationRuntimeEnabledRef.current) {
      return;
    }

    try {
      await notificationRuntime.clearSessionReminderState(sessionId, {
        onDebug: (next: any) =>
          setNotificationDebug((current) => ({ ...current, ...next })),
      });
    } catch (nextError) {
      logAppError('failed to clear reminder state', nextError, { sessionId });
    }
  };

  const upsertLocalTask = (task: any) => {
    setTasks((current) => {
      const nextTasks = upsertTaskCollection(current, task);
      latestReminderInputsRef.current = {
        ...latestReminderInputsRef.current,
        tasks: nextTasks,
      };
      return nextTasks;
    });
  };

  const upsertLocalSession = (session: any) => {
    setSessions((current) => {
      const nextSessions = upsertSessionCollection(current, session);
      latestReminderInputsRef.current = {
        ...latestReminderInputsRef.current,
        sessions: nextSessions,
      };
      return nextSessions;
    });
  };

  const removeSessionLocally = (sessionId: number | string) => {
    const normalizedSessionId = Number(sessionId);
    if (!Number.isFinite(normalizedSessionId)) {
      return;
    }

    setSessions((current) => {
      const nextSessions = current.filter(
        (item: any) => Number(item.id) !== normalizedSessionId,
      );
      latestReminderInputsRef.current = {
        ...latestReminderInputsRef.current,
        sessions: nextSessions,
      };
      return nextSessions;
    });
  };

  const createTaskWithOffline = async (taskPayload: any) => {
    try {
      const createdTask = await createTask(taskPayload);
      upsertLocalTask(createdTask);
      return createdTask;
    } catch (nextError) {
      if (!isOfflineCapableError(nextError) || authUserId === null) {
        throw nextError;
      }

      const offlineTask = buildOfflineTask(taskPayload);
      upsertLocalTask(offlineTask);
      await enqueueOfflineOperation(authUserId, {
        type: 'createTask',
        localTaskId: offlineTask.id,
        payload: taskPayload,
      });
      await refreshPendingSyncState();
      setBackendStatus('offline');
      setError('Backend offline. Task saved locally and queued for sync.');
      return offlineTask;
    }
  };

  const createScheduleWithOffline = async (schedulePayload: any, selectedTask: any) => {
    try {
      return await createSchedule(schedulePayload);
    } catch (nextError) {
      if (!isOfflineCapableError(nextError) || authUserId === null) {
        throw nextError;
      }

      const offlineSession = buildOfflineSession(schedulePayload, selectedTask);
      upsertLocalSession(offlineSession);
      await enqueueOfflineOperation(authUserId, {
        type: 'createSchedule',
        localSessionId: offlineSession.id,
        payload: schedulePayload,
      });
      await refreshPendingSyncState();
      setBackendStatus('offline');
      setError('Backend offline. Session saved locally and queued for sync.');
      return {
        id: null,
        session_id: offlineSession.id,
      };
    }
  };

  const startSessionWithOffline = async (payload: any) => {
    try {
      return await apiStartSession(payload);
    } catch (nextError) {
      if (!isOfflineCapableError(nextError) || authUserId === null) {
        throw nextError;
      }

      const nextSession = applyOfflineSessionStart(
        sessions.find((item: any) => Number(item.id) === Number(payload?.session_id)),
        payload,
      );
      if (!nextSession) {
        throw nextError;
      }

      upsertLocalSession(nextSession);
      await enqueueOfflineOperation(authUserId, {
        type: 'startSession',
        payload,
      });
      await refreshPendingSyncState();
      setBackendStatus('offline');
      setError('Backend offline. Session start saved locally and queued for sync.');
      return nextSession;
    }
  };

  const endSessionWithOffline = async (payload: any) => {
    try {
      return await apiEndSession(payload);
    } catch (nextError) {
      if (!isOfflineCapableError(nextError) || authUserId === null) {
        throw nextError;
      }

      const nextSession = applyOfflineSessionEnd(
        sessions.find((item: any) => Number(item.id) === Number(payload?.session_id)),
        payload,
      );
      if (!nextSession) {
        throw nextError;
      }

      upsertLocalSession(nextSession);
      await enqueueOfflineOperation(authUserId, {
        type: 'endSession',
        payload,
      });
      await refreshPendingSyncState();
      setBackendStatus('offline');
      setError('Backend offline. Session end saved locally and queued for sync.');
      return nextSession;
    }
  };

  const markSessionMissedWithOffline = async (payload: any) => {
    try {
      return await markSessionMissed(payload);
    } catch (nextError) {
      if (!isOfflineCapableError(nextError) || authUserId === null) {
        throw nextError;
      }

      const nextSession = applyOfflineSessionMissed(
        sessions.find((item: any) => Number(item.id) === Number(payload?.session_id)),
      );
      if (nextSession) {
        upsertLocalSession(nextSession);
      }
      await enqueueOfflineOperation(authUserId, {
        type: 'markSessionMissed',
        payload,
      });
      await refreshPendingSyncState();
      setBackendStatus('offline');
      setError('Backend offline. Missed session saved locally and queued for sync.');
      return {
        habit: {
          session_id: payload?.session_id,
          reason_category: payload?.reason_category,
          custom_reason: payload?.custom_reason ?? null,
          time_lost_minutes: payload?.time_lost_minutes ?? 0,
        },
      };
    }
  };

  const deleteSessionWithOffline = async (sessionId: number | string) => {
    try {
      return await apiDeleteSession(sessionId);
    } catch (nextError) {
      if (!isOfflineCapableError(nextError) || authUserId === null) {
        throw nextError;
      }

      removeSessionLocally(sessionId);
      await enqueueOfflineOperation(authUserId, {
        type: 'deleteSession',
        sessionId,
      });
      await refreshPendingSyncState();
      setBackendStatus('offline');
      setError('Backend offline. Session delete queued for sync.');
      return { deleted: true, session_id: sessionId };
    }
  };

  const updateSessionWithOffline = async (sessionId: number | string, payload: any) => {
    try {
      return await apiUpdateSession(sessionId, payload);
    } catch (nextError) {
      if (!isOfflineCapableError(nextError) || authUserId === null) {
        throw nextError;
      }

      const existingSession =
        sessions.find((item: any) => Number(item.id) === Number(sessionId)) ?? null;
      const nextSession = applyOfflineSessionUpdate(existingSession, payload);
      if (!nextSession) {
        throw nextError;
      }

      upsertLocalSession(nextSession);
      await enqueueOfflineOperation(authUserId, {
        type: 'updateSession',
        sessionId,
        payload,
      });
      await refreshPendingSyncState();
      setBackendStatus('offline');
      setError('Backend offline. Session update saved locally and queued for sync.');
      return nextSession;
    }
  };

  const api = {
    startSession: startSessionWithOffline,
    endSession: endSessionWithOffline,
    markSessionMissed: markSessionMissedWithOffline,
    deleteSession: deleteSessionWithOffline,
    updateSession: updateSessionWithOffline,
    refresh: refreshAll,
  };

  const openMissedPrompt = (sessionCard: any) => {
    if (pendingActionRef.current || !sessionCard.availableActions.includes('missed')) {
      return;
    }

    setSelectedReason('Social media');
    setCustomReason('');
    setMissedTarget(sessionCard);
  };

  const requestPlannerEdit = (sessionCard: any) => {
    const canEditOrReschedule =
      sessionCard.availableActions.includes('edit') ||
      sessionCard.availableActions.includes('reschedule');
    if (pendingActionRef.current || !canEditOrReschedule) {
      return;
    }

    setPlannerEditRequest({
      key: `${sessionCard.id}:${Date.now()}`,
      session: sessionCard,
    });
    setError(null);
  };

  const resetEndSessionPrompt = () => {
    setEndSessionTarget(null);
    setObjectiveCompletionChoice(null);
    setReflectionNotes('');
    setFailureReason(null);
    setFailureReasonDetail('');
    setDistractionCategory('');
    setFollowUpDate(formatDateInput(addDays(new Date(), 1)));
    setFollowUpStartTime('09:00');
    setFollowUpEndTime('10:00');
    setEndSessionError(null);
  };

  const openEndPrompt = (sessionCard: any) => {
    if (pendingActionRef.current || !sessionCard.availableActions.includes('end')) {
      return;
    }

    setEndSessionTarget(sessionCard);
    setObjectiveCompletionChoice(null);
    setReflectionNotes('');
    setFailureReason(null);
    setFailureReasonDetail('');
    setDistractionCategory('');
    setFollowUpDate(formatDateInput(addDays(new Date(), 1)));
    setFollowUpStartTime(formatTimeInput(sessionCard.plannedStart));
    setFollowUpEndTime(formatTimeInput(sessionCard.plannedEnd));
    setEndSessionError(null);
    setError(null);
  };

  const buildFollowUpSchedulePayload = (sessionCard: any) => {
    const taskId = Number(sessionCard?.taskId);
    if (!Number.isFinite(taskId) || taskId <= 0) {
      throw new Error('Cannot plan follow-up work without a valid task.');
    }

    const { startIso, endIso } = buildFutureSessionRange(
      followUpDate,
      followUpStartTime,
      followUpEndTime,
    );

    return {
      task_id: taskId,
      start_time: startIso,
      end_time: endIso,
      reminder_offset_minutes:
        sessionCard.reminderOffsetMinutes ?? config?.pre_session_minutes ?? 5,
      timezone: getLocalTimezone(),
      notes: sessionCard.goal || '',
      goal_context: sessionCard.goalContext || null,
    };
  };

  const resolvePlannerTask = async ({
    selectedTask,
    taskId,
    taskTitle,
    category,
    objective,
    goalContext,
  }: {
    selectedTask?: any;
    taskId: number | null;
    taskTitle: string;
    category: string;
    objective: string;
    goalContext: string;
  }) => {
    const selectedTaskId = normalizePositiveId(selectedTask?.id);
    const requestedTaskId = normalizePositiveId(taskId);
    const resolvedSelectedTask =
      selectedTaskId !== null
        ? tasks.find(
            (task: any) => normalizePositiveId(task?.id) === selectedTaskId,
          ) ?? selectedTask
        : requestedTaskId !== null
          ? tasks.find(
              (task: any) => normalizePositiveId(task?.id) === requestedTaskId,
            ) ?? null
          : null;

    logAppInfo('planner task resolution start', {
      selectedTask: resolvedSelectedTask ?? selectedTask ?? null,
      selectedTaskId,
      requestedTaskId,
      enteredTaskTitle: String(taskTitle || '').trim(),
      category: String(category || '').trim(),
      objective: String(objective || '').trim(),
      goalContext: String(goalContext || '').trim(),
    });

    const directTaskId = selectedTaskId ?? requestedTaskId;
    if (directTaskId !== null) {
      logAppInfo('planner task resolution complete', {
        selectedTask: resolvedSelectedTask ?? selectedTask ?? null,
        resolvedTaskId: directTaskId,
        usedFallbackTaskCreation: false,
      });
      return {
        resolvedTaskId: directTaskId,
        selectedTask: resolvedSelectedTask ?? selectedTask ?? null,
        usedFallbackTaskCreation: false,
      };
    }

    const taskPayload = buildPlannerTaskPayload({
      taskTitle,
      category,
      objective,
      goalContext,
    });

    if (!taskPayload.title) {
      throw new Error('Choose a task or enter a task name first.');
    }

    logAppInfo('planner task fallback create start', {
      selectedTask: selectedTask ?? null,
      taskPayload,
    });

    let createdTask;

    try {
      createdTask = await createTaskWithOffline(taskPayload);
    } catch (nextError) {
      logAppError('planner task fallback create failed', nextError, {
        taskPayload,
      });
      throw nextError;
    }

    const createdTaskId = normalizePositiveId(createdTask?.id);
    logAppInfo('planner task fallback create response', {
      createTaskResponse: createdTask,
      extractedTaskId: createdTaskId,
    });

    if (createdTaskId === null) {
      throw new Error(
        'Planner task creation returned an invalid response. Check the create-task debug log for the raw payload.',
      );
    }

    setTasks((currentTasks) => {
      const existingIndex = currentTasks.findIndex(
        (task: any) => normalizePositiveId(task?.id) === createdTaskId,
      );

      if (existingIndex >= 0) {
        return currentTasks.map((task: any, index: number) =>
          index === existingIndex ? createdTask : task,
        );
      }

      return [...currentTasks, createdTask];
    });

    logAppInfo('planner task resolution complete', {
      selectedTask: createdTask,
      resolvedTaskId: createdTaskId,
      usedFallbackTaskCreation: true,
    });

    return {
      resolvedTaskId: createdTaskId,
      selectedTask: createdTask,
      usedFallbackTaskCreation: true,
    };
  };

  const handleStart = async (sessionCard: any) => {
    if (!sessionCard.availableActions.includes('start')) {
      return;
    }

    await runLockedAction(
      actionKeyFor('start', sessionCard.id),
      async () => {
        setCompletionSummary(null);
        await startSessionFlow(api, sessionCard);
        await clearSessionReminders(sessionCard.id);
      },
      'Failed to start session',
    );
  };

  const handleEnd = async (sessionCard: any) => {
    if (!sessionCard.availableActions.includes('end')) {
      return;
    }

    openEndPrompt(sessionCard);
  };

  const submitEndSession = async (planFollowUp: boolean) => {
    if (!endSessionTarget) {
      return;
    }

    if (!objectiveCompletionChoice) {
      setEndSessionError('Choose whether the objective was completed.');
      return;
    }

    const objectiveCompleted = objectiveCompletionChoice === 'yes';
    const normalizedReflectionNotes = String(reflectionNotes || '').trim();
    const normalizedFailureReason = String(failureReason || '').trim();
    const normalizedFailureReasonDetail = String(failureReasonDetail || '').trim();
    const normalizedDistractionCategory = String(distractionCategory || '').trim();

    if (!objectiveCompleted && !normalizedFailureReason) {
      setEndSessionError('Choose the main reason the objective was not completed.');
      return;
    }

    if (!objectiveCompleted && normalizedFailureReason === 'Other' && !normalizedFailureReasonDetail) {
      setEndSessionError('Add a short detail when the reason is Other.');
      return;
    }

    if (!objectiveCompleted && normalizedFailureReason === 'Distraction' && !normalizedDistractionCategory) {
      setEndSessionError('Name the distraction so it can be tracked.');
      return;
    }

    let followUpPayload = null;
    let followUpLabel = null;

    if (!objectiveCompleted && planFollowUp) {
      try {
        followUpPayload = buildFollowUpSchedulePayload(endSessionTarget);
        followUpLabel = formatFollowUpLabel(
          followUpDate,
          followUpStartTime,
          followUpEndTime,
        );
      } catch (nextError) {
        logAppError('follow-up plan build failed', nextError);
        setEndSessionError(
          resolveErrorMessage(nextError, 'Failed to build follow-up plan'),
        );
        return;
      }
    }

    await runLockedAction(
      actionKeyFor('end', endSessionTarget.id),
      async () => {
        const result = await endSessionFlow(api, endSessionTarget, {
          completionPercent: objectiveCompleted ? 100 : 0,
          objectiveCompleted,
          outputNotes: normalizedReflectionNotes || endSessionTarget.goal || '',
          reflectionNotes: normalizedReflectionNotes,
          failureReason: objectiveCompleted ? null : normalizedFailureReason,
          failureReasonDetail:
            objectiveCompleted || !normalizedFailureReasonDetail
              ? null
              : normalizedFailureReasonDetail,
          distractionCategory:
            objectiveCompleted || !normalizedDistractionCategory
              ? null
              : normalizedDistractionCategory,
          refresh: false,
        } as any);
        await clearSessionReminders(endSessionTarget.id);

        let followUpError: unknown = null;
        if (followUpPayload) {
          try {
            await createScheduleWithOffline(
              followUpPayload,
              tasks.find((task: any) => Number(task.id) === Number(endSessionTarget.taskId)) ??
                null,
            );
          } catch (nextError) {
            logAppError('follow-up schedule creation failed', nextError);
            followUpError = nextError;
          }
        }

        await refreshAll();

        if (followUpError) {
          throw followUpError;
        }

        setCompletionSummary({
          sessionId: endSessionTarget.id,
          title: endSessionTarget.title,
          spentLabel: result.spentLabel,
          timingStatusLabel: endSessionTarget.timingStatusLabel,
          startDeltaLabel: endSessionTarget.startDeltaLabel,
          objectiveStatusLabel: objectiveCompleted
            ? 'Objective completed'
            : 'Objective not completed',
          reflectionNotes: normalizedReflectionNotes,
          failureReason: objectiveCompleted ? null : normalizedFailureReason,
          qualityScore: result.session?.quality_score ?? result.session?.qualityScore ?? null,
          qualityLabel: result.session?.quality_label ?? result.session?.qualityLabel ?? null,
          followUpLabel,
        });
        resetEndSessionPrompt();
      },
      'Failed to end session',
    );
  };

  const handleDelete = async (sessionCard: any) => {
    if (!sessionCard.availableActions.includes('delete')) {
      return;
    }

    await runLockedAction(
      actionKeyFor('delete', sessionCard.id),
      async () => {
        await deleteSessionWithOffline(sessionCard.id);
        removeSessionLocally(sessionCard.id);
        await clearSessionReminders(sessionCard.id);
        await refreshAll();
      },
      'Failed to delete session',
    );
  };

  const submitMissed = async () => {
    if (!missedTarget) {
      return;
    }

    await runLockedAction(
      actionKeyFor('missed', missedTarget.id),
      async () => {
        await submitMissedSessionFlow(
          api,
          missedTarget,
          selectedReason,
          selectedReason === 'Custom' ? customReason : '',
        );
        await clearSessionReminders(missedTarget.id);
        await refreshHabits();
        setMissedTarget(null);
      },
      'Failed to mark session missed',
    );
  };

  const resolveSessionCardById = async (sessionId: number | string) => {
    const normalizedSessionId = Number(sessionId);
    if (!Number.isFinite(normalizedSessionId)) {
      return null;
    }

    let sessionCard =
      sessionCardsRef.current.find(
        (item: any) => Number(item.id) === normalizedSessionId,
      ) ?? null;
    if (sessionCard) {
      return sessionCard;
    }

    await refreshAll();
    sessionCard =
      buildSessionCardsSafely({
        sessions: latestReminderInputsRef.current.sessions,
        tasks: latestReminderInputsRef.current.tasks,
        now: new Date(),
        categoryGoals: latestReminderInputsRef.current.categoryGoals,
      }).find((item: any) => Number(item.id) === normalizedSessionId) ?? null;
    return sessionCard;
  };

  const startSessionFromNotification = async (sessionId: number | string) => {
    const sessionCard = await resolveSessionCardById(sessionId);
    if (!sessionCard) {
      return;
    }

    await runLockedAction(
      actionKeyFor('start', sessionCard.id),
      async () => {
        setCompletionSummary(null);
        await startSessionFlow(api, sessionCard);
        await clearSessionReminders(sessionCard.id);
      },
      'Failed to start session',
    );
  };

  const skipSessionFromNotification = async (sessionId: number | string) => {
    const sessionCard = await resolveSessionCardById(sessionId);
    if (!sessionCard) {
      return;
    }

    await runLockedAction(
      actionKeyFor('missed', sessionCard.id),
      async () => {
        await skipSessionFlow(api, sessionCard);
        await clearSessionReminders(sessionCard.id);
        await refreshHabits();
        if (Number(missedTarget?.id) === Number(sessionCard.id)) {
          setMissedTarget(null);
        }
      },
      'Failed to skip session',
    );
  };

  notificationActionHandlersRef.current = {
    onStart: async (action: any) => startSessionFromNotification(action.sessionId),
    onSkip: async (action: any) => skipSessionFromNotification(action.sessionId),
  };

  const createPlannerSession = async ({
    selectedTask,
    taskId,
    taskTitle,
    category,
    objective,
    goalContext,
    startIso,
    endIso,
    reminderOffsetMinutes,
  }: any) => {
    try {
      const localTimezone = getLocalTimezone();
      const {
        resolvedTaskId,
        selectedTask: resolvedSelectedTask,
        usedFallbackTaskCreation,
      } = await resolvePlannerTask({
        selectedTask,
        taskId,
        taskTitle,
        category,
        objective,
        goalContext,
      });

      const schedulePayload = {
        task_id: resolvedTaskId,
        start_time: startIso,
        end_time: endIso,
        reminder_offset_minutes: reminderOffsetMinutes,
        timezone: localTimezone,
        notes: objective || '',
        goal_context: goalContext || null,
      };

      logAppInfo('planner session create payload', {
        selectedTask: resolvedSelectedTask,
        resolvedTaskId,
        usedFallbackTaskCreation,
        finalSchedulePayload: schedulePayload,
      });

      await createScheduleWithOffline(
        schedulePayload,
        resolvedSelectedTask,
      );
      await refreshAll();
      setError(null);
    } catch (nextError) {
      logAppError('planner session creation failed', nextError);
      const message = resolveErrorMessage(
        nextError,
        'Failed to create planner session',
      );
      setError(message);
      throw new Error(message);
    }
  };

  const updatePlannerSession = async ({
    sessionId,
    selectedTask,
    taskId,
    taskTitle,
    category,
    objective,
    goalContext,
    startIso,
    endIso,
    reminderOffsetMinutes,
  }: any) => {
    try {
      const localTimezone = getLocalTimezone();
      const {
        resolvedTaskId,
        selectedTask: resolvedSelectedTask,
        usedFallbackTaskCreation,
      } = await resolvePlannerTask({
        selectedTask,
        taskId,
        taskTitle,
        category,
        objective,
        goalContext,
      });

      const sessionPayload = {
        task_id: resolvedTaskId,
        start_time: startIso,
        end_time: endIso,
        reminder_offset_minutes: reminderOffsetMinutes,
        timezone: localTimezone,
        notes: objective || '',
        goal_context: goalContext || null,
      };

      logAppInfo('planner session update payload', {
        selectedTask: resolvedSelectedTask,
        resolvedTaskId,
        usedFallbackTaskCreation,
        sessionId,
        finalSessionPayload: sessionPayload,
      });

      await updateSessionWithOffline(sessionId, sessionPayload);
      await refreshAll();
      setError(null);
    } catch (nextError) {
      logAppError('planner session update failed', nextError);
      const message = resolveErrorMessage(
        nextError,
        'Failed to update planner session',
      );
      setError(message);
      throw new Error(message);
    }
  };

  const handleResetLocalState = async () => {
    const storage =
      notificationStorageRef.current ?? (await createNotificationStorage());
    notificationStorageRef.current = storage;
    await resetLocalAppState(storage);
    setNotificationDebug({
      scheduledReminderCount: 0,
      deliveredLateReminderCount: 0,
      lastSpeechResult: 'reset',
      lastNotificationResult: 'reset',
    });
    await armReminderRuntime({ forceEnable: notificationRuntimeEnabledRef.current });
  };

  const handleRetryNotificationSetup = async () => {
    setError(null);
    await armReminderRuntime({
      promptForPermission: true,
      forceEnable: true,
    });
  };

  const completeAuthSession = async (nextSession: any) => {
    setApiAuthToken(nextSession?.token);
    await saveStoredAuthSession(nextSession);
    bootSessionKeyRef.current = null;
    remoteSyncCursorRef.current = 0;
    setAuthSession(nextSession);
    setAuthName(String(nextSession?.user?.name || '').trim());
    setAuthEmail(String(nextSession?.user?.email || '').trim());
    setAuthPassword('');
    setPendingSyncCount(0);
    setLoading(true);
    setError(null);
  };

  const handleAuthSubmit = async () => {
    setAuthSubmitting(true);
    setError(null);

    try {
      const normalizedEmail = String(authEmail || '').trim();
      const normalizedPassword = String(authPassword || '');
      const normalizedName = String(authName || '').trim();

      if (!normalizedEmail) {
        throw new Error('Email is required.');
      }
      if (!normalizedPassword) {
        throw new Error('Password is required.');
      }
      if (authMode === 'register' && !normalizedName) {
        throw new Error('Name is required.');
      }

      const nextSession =
        authMode === 'register'
          ? await registerUser({
              name: normalizedName,
              email: normalizedEmail,
              password: normalizedPassword,
            })
          : await loginUser({
              email: normalizedEmail,
              password: normalizedPassword,
            });

      await completeAuthSession(nextSession);
    } catch (nextError) {
      logAppError('auth submit failed', nextError, { mode: authMode });
      setError(resolveErrorMessage(nextError, 'Failed to authenticate'));
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await clearStoredAuthSession();
    clearApiAuthToken();
    bootSessionKeyRef.current = null;
    remoteSyncCursorRef.current = 0;
    stopReminderRuntime();
    setAuthSession(null);
    setTasks([]);
    setSessions([]);
    setConfig(fallbackConfig);
    setGoalSettings(fallbackGoalSettings);
    setPendingSyncCount(0);
    setLoading(false);
    setError(null);
    setBackendStatus('checking');
  };

  const notificationStatusLabel = getNotificationStatusLabel(permissionState);
  const notificationPermissionMessage = getNotificationPermissionMessage(
    permissionState,
  );
  const weeklyReviewStatus = `Active week: ${activeWeek.label}`;

  const handlePlannerWeekChange = useCallback((nextWeek: any) => {
    try {
      const weekStart = startOfWeek(new Date(nextWeek.start));
      const nextActiveWeek = {
        key: formatDateInput(weekStart),
        label:
          nextWeek.label ?? formatWeekRangeLabel(weekStart, endOfWeek(weekStart)),
        monthKey:
          nextWeek.monthKey ??
          formatMonthKey(startOfMonth(new Date(nextWeek.start))),
      };

      logAppInfo('weekly planner/session bootstrap complete', {
        activeWeekKey: nextActiveWeek.key,
        monthKey: nextActiveWeek.monthKey,
      });
      setActiveWeek((current) => {
        if (
          current.key === nextActiveWeek.key &&
          current.label === nextActiveWeek.label &&
          current.monthKey === nextActiveWeek.monthKey
        ) {
          return current;
        }

        return nextActiveWeek;
      });
    } catch (nextError) {
      logAppError('weekly planner/session bootstrap failed', nextError, {
        nextWeek,
      });
    }
  }, []);

  const openWeeklyReview = () => {
    setWeeklyReviewError(null);
    setWeeklyReviewVisible(true);
  };

  if (showSplash) {
    return <StartupSplash onFinish={() => setShowSplash(false)} />;
  }

  if (!authReady) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <View style={styles.page}>
          <View style={styles.authCard}>
            <ActivityIndicator color="#D6A436" />
            <Text style={styles.panelTitle}>Restoring account</Text>
            <Text style={styles.subtle}>
              Loading the last signed-in session and local workspace.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!authSession) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <View style={styles.page}>
          <View style={styles.authCard}>
            <Text style={styles.panelTitle}>
              {authMode === 'register' ? 'Create Account' : 'Sign In'}
            </Text>
            <Text style={styles.subtle}>
              Accounts keep each user&apos;s data separate across devices. Offline mode stays available after the first successful sign-in on this device.
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {authMode === 'register' ? (
              <TextInput
                style={styles.input}
                placeholder="Name"
                placeholderTextColor="#888C94"
                autoCapitalize="words"
                value={authName}
                editable={!authSubmitting}
                onChangeText={setAuthName}
              />
            ) : null}
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#888C94"
              autoCapitalize="none"
              keyboardType="email-address"
              value={authEmail}
              editable={!authSubmitting}
              onChangeText={setAuthEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#888C94"
              secureTextEntry
              value={authPassword}
              editable={!authSubmitting}
              onChangeText={setAuthPassword}
            />
            <View style={styles.actions}>
              <Pressable
                disabled={authSubmitting}
                style={[
                  styles.primaryButton,
                  authSubmitting ? styles.buttonDisabled : null,
                ]}
                onPress={handleAuthSubmit}
              >
                <Text style={styles.primaryButtonText}>
                  {authSubmitting
                    ? authMode === 'register'
                      ? 'Creating...'
                      : 'Signing in...'
                    : authMode === 'register'
                      ? 'Create Account'
                      : 'Sign In'}
                </Text>
              </Pressable>
              <Pressable
                disabled={authSubmitting}
                style={[
                  styles.secondaryButton,
                  authSubmitting ? styles.buttonDisabled : null,
                ]}
                onPress={() =>
                  setAuthMode((current) =>
                    current === 'register' ? 'login' : 'register',
                  )
                }
              >
                <Text style={styles.secondaryButtonText}>
                  {authMode === 'register'
                    ? 'Use Existing Account'
                    : 'Create New Account'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.topBar}>
          <View style={styles.brandBlock}>
            <Image
              accessibilityLabel="LIONYX-E logo"
              resizeMode="contain"
              source={logoSource}
              style={[styles.brandLogo, { width: brandLogoWidth }]}
            />
            <Text numberOfLines={1} style={styles.brand}>
              LIONYX-E
            </Text>
          </View>
          <View style={styles.statusBlock}>
            <Text style={styles.status}>
              User: {authSession?.user?.name || authSession?.user?.email}
            </Text>
            <Text style={styles.status}>Backend: {backendStatus}</Text>
            <Text style={styles.status}>Pending sync: {pendingSyncCount}</Text>
            <Text style={styles.status}>
              Notifications: {notificationStatusLabel}
            </Text>
            <Pressable style={styles.secondaryButton} onPress={handleLogout}>
              <Text style={styles.secondaryButtonText}>Log Out</Text>
            </Pressable>
          </View>
        </View>

        {loading ? <ActivityIndicator color="#D6A436" /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Current Session</Text>
          {currentSession ? (
            <>
              <Text style={styles.sessionTitle}>{currentSession.title}</Text>
              <Text style={styles.body}>
                Objective: {currentSession.objectiveText || currentSession.goal}
              </Text>
              <Text style={styles.subtle}>
                Objective status: {currentSession.objectiveStatusLabel}
              </Text>
              <Text style={styles.body}>Elapsed: {elapsedClock}</Text>
              <Text style={styles.body}>
                Punctuality: {currentSession.timingStatusLabel}
              </Text>
              <Text style={styles.subtle}>
                Start delta: {currentSession.startDeltaLabel}
              </Text>
              {currentSession.availableActions.includes('end') ? (
                <Pressable
                  disabled={isUiLocked}
                  style={[
                    styles.primaryButton,
                    isUiLocked ? styles.buttonDisabled : null,
                  ]}
                  onPress={() => handleEnd(currentSession)}
                >
                  <Text style={styles.primaryButtonText}>
                    {isActionPending('end', currentSession.id) ? 'Ending...' : 'End'}
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : completionSummary ? (
            <>
              <Text style={styles.subtle}>Last Completed Session</Text>
              <Text style={styles.sessionTitle}>{completionSummary.title}</Text>
              <Text style={styles.body}>
                Time spent: {completionSummary.spentLabel}
              </Text>
              <Text style={styles.body}>
                Punctuality: {completionSummary.timingStatusLabel}
              </Text>
              {completionSummary.startDeltaLabel ? (
                <Text style={styles.body}>
                  Start delta: {completionSummary.startDeltaLabel}
                </Text>
              ) : null}
              {completionSummary.objectiveStatusLabel ? (
                <Text style={styles.body}>
                  {completionSummary.objectiveStatusLabel}
                </Text>
              ) : null}
              {completionSummary.qualityLabel ? (
                <Text style={styles.body}>
                  Quality: {Math.round(Number(completionSummary.qualityScore || 0))} / 100{' '}
                  {completionSummary.qualityLabel}
                </Text>
              ) : null}
              {completionSummary.failureReason ? (
                <Text style={styles.subtle}>
                  Main reason: {completionSummary.failureReason}
                </Text>
              ) : null}
              {completionSummary.reflectionNotes ? (
                <Text style={styles.subtle}>
                  Outcome: {completionSummary.reflectionNotes}
                </Text>
              ) : null}
              {completionSummary.followUpLabel ? (
                <Text style={styles.subtle}>
                  Follow-up planned: {completionSummary.followUpLabel}
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.body}>
              No active session. Start a planned session below.
            </Text>
          )}
        </View>

        <View style={styles.panel}>
          <View style={styles.reviewCopy}>
            <Text style={styles.panelTitle}>Weekly Feedback</Text>
            <Text style={styles.subtle}>{weeklyReviewStatus}</Text>
          </View>
          <Pressable style={styles.primaryButton} onPress={openWeeklyReview}>
            <Text style={styles.primaryButtonText}>Review Weekly Feedback</Text>
          </Pressable>
        </View>

        <WeeklyPlanner
          sessions={sessionCards}
          tasks={tasks}
          categoryGoals={goalSettings?.category_goals ?? {}}
          onCreate={createPlannerSession}
          onUpdate={updatePlannerSession}
          onDelete={handleDelete}
          activeWeekKey={activeWeek.key}
          activeMonthKey={activeWeek.monthKey}
          onWeekChange={handlePlannerWeekChange}
          isUiLocked={isUiLocked}
          isActionPending={isActionPending}
          defaultReminderOffsetMinutes={config?.pre_session_minutes ?? 5}
          editRequest={plannerEditRequest}
        />

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Sessions</Text>
          <Text style={styles.subtle}>{activeWeek.label}</Text>
          {activeWeekSessionCards.length === 0 ? (
            <Text style={styles.body}>No sessions belong to this week.</Text>
          ) : null}
          {activeWeekSessionCards.map((item: any) => (
            <View key={item.id} style={styles.sessionCard}>
              <Text style={styles.sessionTitle}>{item.title}</Text>
              <Text style={styles.subtle}>{item.status.toUpperCase()}</Text>
              {item.category ? <Text style={styles.categoryTag}>{item.category}</Text> : null}
              <Text style={styles.body}>
                Objective: {item.objectiveText || item.goal}
              </Text>
              <Text style={styles.subtle}>
                Objective status: {item.objectiveStatusLabel}
              </Text>
              <Text style={styles.subtle}>
                {new Date(item.plannedStart).toLocaleString()} -{' '}
                {new Date(item.plannedEnd).toLocaleTimeString()}
              </Text>
              <Text style={styles.subtle}>{item.timingStatusLabel}</Text>
              <Text style={styles.subtle}>Start delta: {item.startDeltaLabel}</Text>
              {item.spentLabel ? (
                <Text style={styles.subtle}>Time spent: {item.spentLabel}</Text>
              ) : null}
              {item.qualityLabel ? (
                <Text style={styles.subtle}>
                  Quality: {Math.round(Number(item.qualityScore || 0))} / 100 {item.qualityLabel}
                </Text>
              ) : null}
              {item.failureReason ? (
                <Text style={styles.subtle}>Main reason: {item.failureReason}</Text>
              ) : null}
              {item.distractionCategory ? (
                <Text style={styles.subtle}>
                  Distraction: {item.distractionCategory}
                </Text>
              ) : null}
              {item.actualOutcomeLabel ? (
                <Text style={styles.subtle}>Actual: {item.actualOutcomeLabel}</Text>
              ) : null}
              <View style={styles.actions}>
                {item.availableActions.includes('start') ? (
                  <Pressable
                    disabled={isUiLocked}
                    style={[
                      styles.primaryButton,
                      isUiLocked ? styles.buttonDisabled : null,
                    ]}
                    onPress={() => handleStart(item)}
                  >
                    <Text style={styles.primaryButtonText}>
                      {isActionPending('start', item.id) ? 'Starting...' : 'Start'}
                    </Text>
                  </Pressable>
                ) : null}
                {item.availableActions.includes('edit') ||
                item.availableActions.includes('reschedule') ? (
                  <Pressable
                    disabled={isUiLocked}
                    style={[
                      styles.secondaryButton,
                      isUiLocked ? styles.buttonDisabled : null,
                    ]}
                    onPress={() => requestPlannerEdit(item)}
                  >
                    <Text style={styles.secondaryButtonText}>
                      {item.availableActions.includes('reschedule')
                        ? 'Reschedule'
                        : 'Edit'}
                    </Text>
                  </Pressable>
                ) : null}
                {item.availableActions.includes('end') ? (
                  <Pressable
                    disabled={isUiLocked}
                    style={[
                      styles.primaryButton,
                      isUiLocked ? styles.buttonDisabled : null,
                    ]}
                    onPress={() => handleEnd(item)}
                  >
                    <Text style={styles.primaryButtonText}>
                      {isActionPending('end', item.id) ? 'Ending...' : 'End'}
                    </Text>
                  </Pressable>
                ) : null}
                {item.availableActions.includes('missed') ? (
                  <Pressable
                    disabled={isUiLocked}
                    style={[
                      styles.secondaryButton,
                      isUiLocked ? styles.buttonDisabled : null,
                    ]}
                    onPress={() => openMissedPrompt(item)}
                  >
                    <Text style={styles.secondaryButtonText}>Missed</Text>
                  </Pressable>
                ) : null}
                {item.availableActions.includes('delete') ? (
                  <Pressable
                    disabled={isUiLocked}
                    style={[
                      styles.dangerButton,
                      isUiLocked ? styles.buttonDisabled : null,
                    ]}
                    onPress={() => handleDelete(item)}
                  >
                    <Text style={styles.dangerButtonText}>
                      {isActionPending('delete', item.id) ? 'Deleting...' : 'Delete'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Notification Runtime</Text>
          <Text style={styles.subtle}>Schedule state: {scheduleState}</Text>
          {notificationPermissionMessage ? (
            <Text style={styles.warning}>{notificationPermissionMessage}</Text>
          ) : null}
          <Text style={styles.subtle}>
            Scheduled reminders: {notificationDebug.scheduledReminderCount}
          </Text>
          <Text style={styles.subtle}>
            Delivered late reminders: {notificationDebug.deliveredLateReminderCount}
          </Text>
          {permissionState !== 'granted' ? (
            <Pressable
              style={styles.secondaryButton}
              onPress={handleRetryNotificationSetup}
            >
              <Text style={styles.secondaryButtonText}>
                Enable / Retry Notifications
              </Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.secondaryButton} onPress={handleResetLocalState}>
            <Text style={styles.secondaryButtonText}>
              Reset Local Notification State
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <WeeklyReview
        visible={weeklyReviewVisible}
        onClose={() => setWeeklyReviewVisible(false)}
        report={weeklyReviewData}
        sessions={sessions}
        loading={weeklyReviewLoading}
        error={weeklyReviewError}
        reviewWindow={weeklyReviewWindow}
        devOverrideEnabled={false}
      />

      <Modal visible={Boolean(endSessionTarget)} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.panelTitle}>End Session</Text>
            <Text style={styles.body}>{endSessionTarget?.title}</Text>
            <Text style={styles.subtle}>Did you complete the objective?</Text>
            {endSessionError ? <Text style={styles.error}>{endSessionError}</Text> : null}
            <View style={styles.choiceWrap}>
              {[
                { label: 'Yes', value: 'yes' },
                { label: 'No', value: 'no' },
              ].map((option) => (
                <Pressable
                  key={option.value}
                  disabled={isUiLocked}
                  style={[
                    styles.choiceButton,
                    objectiveCompletionChoice === option.value
                      ? styles.choiceButtonActive
                      : null,
                    isUiLocked ? styles.buttonDisabled : null,
                  ]}
                  onPress={() => {
                    setObjectiveCompletionChoice(option.value as 'yes' | 'no');
                    setEndSessionError(null);
                  }}
                >
                  <Text style={styles.choiceText}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="What actually happened? (optional)"
              placeholderTextColor="#888C94"
              value={reflectionNotes}
              multiline
              editable={!isUiLocked}
              onChangeText={setReflectionNotes}
            />
            {objectiveCompletionChoice === 'no' ? (
              <>
                <Text style={styles.subtle}>Main reason if not completed</Text>
                <View style={styles.reasonWrap}>
                  {SESSION_FAILURE_REASON_OPTIONS.map((reason) => (
                    <Pressable
                      key={reason}
                      disabled={isUiLocked}
                      style={[
                        styles.reasonButton,
                        failureReason === reason ? styles.reasonButtonActive : null,
                        isUiLocked ? styles.buttonDisabled : null,
                      ]}
                      onPress={() => {
                        setFailureReason(reason);
                        setEndSessionError(null);
                      }}
                    >
                      <Text style={styles.reasonText}>{reason}</Text>
                    </Pressable>
                  ))}
                </View>
                {failureReason === 'Other' ? (
                  <TextInput
                    style={styles.input}
                    placeholder="Other reason"
                    placeholderTextColor="#888C94"
                    value={failureReasonDetail}
                    editable={!isUiLocked}
                    onChangeText={setFailureReasonDetail}
                  />
                ) : null}
                {failureReason === 'Distraction' ? (
                  <TextInput
                    style={styles.input}
                    placeholder="Distraction category (e.g. Social media)"
                    placeholderTextColor="#888C94"
                    value={distractionCategory}
                    editable={!isUiLocked}
                    onChangeText={setDistractionCategory}
                  />
                ) : null}
                <Text style={styles.subtle}>
                  Plan the unfinished work into a future session now.
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Future day YYYY-MM-DD"
                  placeholderTextColor="#888C94"
                  value={followUpDate}
                  editable={!isUiLocked}
                  onChangeText={setFollowUpDate}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Start HH:MM"
                  placeholderTextColor="#888C94"
                  value={followUpStartTime}
                  editable={!isUiLocked}
                  onChangeText={setFollowUpStartTime}
                />
                <TextInput
                  style={styles.input}
                  placeholder="End HH:MM"
                  placeholderTextColor="#888C94"
                  value={followUpEndTime}
                  editable={!isUiLocked}
                  onChangeText={setFollowUpEndTime}
                />
              </>
            ) : null}
            <View style={styles.actions}>
              <Pressable
                disabled={isUiLocked}
                style={[
                  styles.secondaryButton,
                  isUiLocked ? styles.buttonDisabled : null,
                ]}
                onPress={resetEndSessionPrompt}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              {objectiveCompletionChoice === 'no' ? (
                <Pressable
                  disabled={isUiLocked}
                  style={[
                    styles.secondaryButton,
                    isUiLocked ? styles.buttonDisabled : null,
                  ]}
                  onPress={() => submitEndSession(false)}
                >
                  <Text style={styles.secondaryButtonText}>End Only</Text>
                </Pressable>
              ) : null}
              <Pressable
                disabled={isUiLocked}
                style={[
                  styles.primaryButton,
                  isUiLocked ? styles.buttonDisabled : null,
                ]}
                onPress={() => submitEndSession(objectiveCompletionChoice === 'no')}
              >
                <Text style={styles.primaryButtonText}>
                  {endSessionTarget && isActionPending('end', endSessionTarget.id)
                    ? 'Saving...'
                    : objectiveCompletionChoice === 'no'
                      ? 'End + Plan'
                      : 'End Session'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(missedTarget)} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.panelTitle}>What were you doing instead?</Text>
            <Text style={styles.body}>{missedTarget?.title}</Text>
            <View style={styles.reasonWrap}>
              {MISSED_REASON_OPTIONS.map((reason) => (
                <Pressable
                  key={reason}
                  disabled={isUiLocked}
                  style={[
                    styles.reasonButton,
                    selectedReason === reason ? styles.reasonButtonActive : null,
                    isUiLocked ? styles.buttonDisabled : null,
                  ]}
                  onPress={() => setSelectedReason(reason)}
                >
                  <Text style={styles.reasonText}>{reason}</Text>
                </Pressable>
              ))}
            </View>
            {selectedReason === 'Custom' ? (
              <TextInput
                style={styles.input}
                placeholder="Custom reason"
                placeholderTextColor="#888C94"
                value={customReason}
                editable={!isUiLocked}
                onChangeText={setCustomReason}
              />
            ) : null}
            <View style={styles.actions}>
              <Pressable
                disabled={isUiLocked}
                style={[
                  styles.secondaryButton,
                  isUiLocked ? styles.buttonDisabled : null,
                ]}
                onPress={() => setMissedTarget(null)}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={isUiLocked}
                style={[
                  styles.primaryButton,
                  isUiLocked ? styles.buttonDisabled : null,
                ]}
                onPress={submitMissed}
              >
                <Text style={styles.primaryButtonText}>
                  {missedTarget && isActionPending('missed', missedTarget.id)
                    ? 'Saving...'
                    : 'Save'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#121212' },
  fatalShell: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  fatalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2C2C2C',
    borderRadius: 16,
    padding: 18,
    gap: 8,
  },
  fatalTitle: { color: '#F0F0F0', fontSize: 22, fontWeight: '700' },
  fatalBody: { color: '#888C94', fontSize: 14 },
  page: { padding: 16, gap: 14, backgroundColor: '#121212' },
  authCard: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2C2C2C',
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
    minWidth: 0,
    marginRight: 12,
  },
  brandLogo: {
    height: BRAND_LOGO_HEIGHT,
  },
  statusBlock: { alignItems: 'flex-end' },
  reviewCopy: {
    gap: 4,
  },
  brand: { color: '#D6A436', fontWeight: '700', fontSize: 24, flexShrink: 1 },
  status: { color: '#888C94', fontSize: 12, textAlign: 'right' },
  panel: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2C2C2C',
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  panelTitle: { color: '#D6A436', fontSize: 19, fontWeight: '700' },
  sessionCard: {
    backgroundColor: '#141414',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2F2F2F',
    padding: 10,
    marginTop: 8,
    gap: 6,
  },
  sessionTitle: { color: '#F0F0F0', fontWeight: '700', fontSize: 16 },
  categoryTag: { color: '#C9AF69', fontSize: 12, fontWeight: '600' },
  body: { color: '#F0F0F0' },
  subtle: { color: '#888C94', fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primaryButton: {
    backgroundColor: '#D6A436',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  primaryButtonText: { color: '#121212', fontWeight: '700' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#888C94',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  secondaryButtonText: { color: '#F0F0F0', fontWeight: '600' },
  dangerButton: {
    borderWidth: 1,
    borderColor: '#874040',
    backgroundColor: '#341717',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  dangerButtonText: { color: '#F0F0F0', fontWeight: '600' },
  buttonDisabled: { opacity: 0.55 },
  error: {
    color: '#F0F0F0',
    backgroundColor: '#4A2121',
    borderRadius: 8,
    padding: 8,
  },
  warning: {
    color: '#F3D37A',
    backgroundColor: '#3A2E10',
    borderRadius: 8,
    padding: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2E2E2E',
    padding: 14,
    gap: 10,
  },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceButton: {
    borderWidth: 1,
    borderColor: '#414141',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  choiceButtonActive: { borderColor: '#D6A436', backgroundColor: '#2A2212' },
  choiceText: { color: '#F0F0F0', fontWeight: '600' },
  reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonButton: {
    borderWidth: 1,
    borderColor: '#414141',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  reasonButtonActive: { borderColor: '#D6A436', backgroundColor: '#2A2212' },
  reasonText: { color: '#F0F0F0' },
  input: {
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    color: '#F0F0F0',
    padding: 10,
  },
  multilineInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
});
