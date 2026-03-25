import React, { useEffect, useMemo, useState } from 'react';
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
import {
  ActivityIndicator,
=======
import {
  ActivityIndicator,
  AppState,
>>>>>>> theirs
=======
import {
  ActivityIndicator,
  AppState,
>>>>>>> theirs
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

<<<<<<< ours
<<<<<<< ours
import {
  endSession as apiEndSession,
  fetchHabits,
=======
=======
>>>>>>> theirs
import StartupSplash from './components/StartupSplash';
import WeeklyPlanner from './components/WeeklyPlanner';
import {
  createSchedule,
  createTask,
  endSession as apiEndSession,
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
  fetchHealth,
  fetchNotificationConfig,
  fetchSessions,
  fetchTasks,
  markSessionMissed,
  startSession as apiStartSession,
} from './services/api.js';
<<<<<<< ours
<<<<<<< ours

=======
>>>>>>> theirs
=======
>>>>>>> theirs
import {
  buildSessionCards,
  endSessionFlow,
  formatElapsed,
  getCurrentSession,
<<<<<<< ours
<<<<<<< ours
=======
  getSessionActions,
>>>>>>> theirs
=======
  getSessionActions,
>>>>>>> theirs
  MISSED_REASON_OPTIONS,
  startSessionFlow,
  submitMissedSessionFlow,
} from './services/executionLoop.js';
<<<<<<< ours
<<<<<<< ours

const ENABLE_DEV_FALLBACK =
  process.env.EXPO_PUBLIC_ENABLE_DEV_FALLBACK === 'true';

const fallbackTasks = [
  {
    id: 1,
    title: 'Deep Work: Product Architecture',
    objective: 'Finalize planner and metrics API',
  },
  {
    id: 2,
    title: 'Client Delivery',
    objective: 'Ship weekly dashboard and insights view',
  },
=======
=======
>>>>>>> theirs
import {
  clearSessionReminderState,
  reconcileNotificationLifecycle,
  requestReminderPermissions,
  scheduleDeviceReminders,
  startLateCheckLoop,
  startWebReminderTimers,
} from './services/notificationRuntime.js';
import {
  createNotificationStorage,
  loadNotificationState,
  resetLocalAppState,
} from './services/notificationState.js';

const ENABLE_DEV_FALLBACK = process.env.EXPO_PUBLIC_ENABLE_DEV_FALLBACK === 'true';

const fallbackTasks = [
  { id: 1, title: 'Strategic Planning', objective: 'Map next release priorities' },
  { id: 2, title: 'Execution Block', objective: 'Ship key workflow improvements' },
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
];

const fallbackSessions = [
  {
<<<<<<< ours
<<<<<<< ours
    id: 101,
    task_id: 1,
    planned_start: new Date(Date.now() + 15 * 60_000).toISOString(),
    planned_end: new Date(Date.now() + 135 * 60_000).toISOString(),
=======
=======
>>>>>>> theirs
    id: 300,
    task_id: 1,
    planned_start: new Date(Date.now() + 3600_000).toISOString(),
    planned_end: new Date(Date.now() + 7200_000).toISOString(),
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
    actual_start: null,
    actual_end: null,
    completion_percent: 0,
    status: 'planned',
  },
<<<<<<< ours
<<<<<<< ours
  {
    id: 102,
    task_id: 2,
    planned_start: new Date(Date.now() - 45 * 60_000).toISOString(),
    planned_end: new Date(Date.now() + 15 * 60_000).toISOString(),
    actual_start: new Date(Date.now() - 35 * 60_000).toISOString(),
    actual_end: null,
    completion_percent: 0,
    status: 'active',
  },
];

const fallbackConfig = {
  tone: 'strict',
  display_name: process.env.EXPO_PUBLIC_DISPLAY_NAME || 'Operator',
  pre_session_minutes: 5,
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
import { ActivityIndicator, Modal, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';

import StartupSplash from './components/StartupSplash';
import WeeklyPlanner from './components/WeeklyPlanner';
import { createSchedule, endSession as apiEndSession, fetchHealth, fetchNotificationConfig, fetchSessions, fetchTasks, markSessionMissed, startSession as apiStartSession } from './services/api.js';
import { buildSessionCards, endSessionFlow, formatElapsed, getCurrentSession, getSessionActions, MISSED_REASON_OPTIONS, startSessionFlow, submitMissedSessionFlow } from './services/executionLoop.js';

const ENABLE_DEV_FALLBACK = process.env.EXPO_PUBLIC_ENABLE_DEV_FALLBACK === 'true';

const fallbackTasks = [
  { id: 1, title: 'Strategic Planning', objective: 'Map next release priorities' },
  { id: 2, title: 'Execution Block', objective: 'Ship key workflow improvements' },
];

const fallbackSessions = [
  { id: 300, task_id: 1, planned_start: new Date(Date.now() + 3600_000).toISOString(), planned_end: new Date(Date.now() + 7200_000).toISOString(), actual_start: null, actual_end: null, completion_percent: 0, status: 'planned' },
=======
>>>>>>> theirs
=======
>>>>>>> theirs
];

const fallbackConfig = {
  display_name: 'Operator',
  tone: 'strict',
  pre_session_minutes: 10,
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
  enabled: true,
  start_script: 'session starts now.',
  late_script: 'you are now {minutes} minutes late. Start now.',
  pre_script: 'session starts in {minutes} minutes.',
};

export default function App() {
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
  const [tasks, setTasks] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(fallbackConfig);

  const [loading, setLoading] = useState(true);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [error, setError] = useState<string | null>(null);

  const [missedTarget, setMissedTarget] = useState<any | null>(null);
  const [selectedReason, setSelectedReason] = useState('Social media');
  const [customReason, setCustomReason] = useState('');
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
  const [showSplash, setShowSplash] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(fallbackConfig);
  const [loading, setLoading] = useState(true);
  const [backendStatus, setBackendStatus] = useState('checking');
<<<<<<< ours
<<<<<<< ours
=======
  const [permissionState, setPermissionState] = useState('pending');
  const [scheduleState, setScheduleState] = useState('idle');
>>>>>>> theirs
=======
  const [permissionState, setPermissionState] = useState('pending');
  const [scheduleState, setScheduleState] = useState('idle');
>>>>>>> theirs
  const [error, setError] = useState<string | null>(null);
  const [missedTarget, setMissedTarget] = useState<any | null>(null);
  const [selectedReason, setSelectedReason] = useState('Social media');
  const [customReason, setCustomReason] = useState('');
  const [elapsedClock, setElapsedClock] = useState('00:00');
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
=======
>>>>>>> theirs
  const [notificationDebug, setNotificationDebug] = useState({
    scheduledReminderCount: 0,
    deliveredLateReminderCount: 0,
    lastSpeechResult: 'none',
    lastNotificationResult: 'none',
  });
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs

  const refreshAll = async () => {
    const [health, remoteTasks, remoteSessions, remoteConfig] = await Promise.all([
      fetchHealth(),
      fetchTasks(),
      fetchSessions(),
      fetchNotificationConfig(),
    ]);
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours

=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
    setBackendStatus(health.status === 'ok' ? 'connected' : 'unhealthy');
    setTasks(remoteTasks);
    setSessions(remoteSessions);
    setConfig(remoteConfig);
  };

<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
  const refreshHabits = async () => {
    try {
      await fetchHabits();
    } catch {
      // Non-blocking for now
    }
  };

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        await refreshAll();
        if (!cancelled) {
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled && ENABLE_DEV_FALLBACK) {
          setBackendStatus('dev fallback');
          setTasks(fallbackTasks);
          setSessions(fallbackSessions);
          setConfig(fallbackConfig);
          setError(null);
        } else if (!cancelled) {
          setBackendStatus('offline');
          setError(err?.message || 'Failed to connect to backend');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    boot();

=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        await refreshAll();
      } catch (err: any) {
        if (ENABLE_DEV_FALLBACK && !cancelled) {
          setTasks(fallbackTasks);
          setSessions(fallbackSessions);
          setConfig(fallbackConfig);
          setBackendStatus('dev fallback');
        } else if (!cancelled) {
          setBackendStatus('offline');
          setError(err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    boot();
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
    return () => {
      cancelled = true;
    };
  }, []);

<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
  const sessionCards = useMemo(
    () => buildSessionCards({ sessions, tasks, now: new Date() }),
    [sessions, tasks]
  );

  const currentSession = useMemo(
    () => getCurrentSession(sessionCards),
    [sessionCards]
  );

  const [elapsedClock, setElapsedClock] = useState('00:00');
=======
  const sessionCards = useMemo(() => buildSessionCards({ sessions, tasks, now: new Date() }), [sessions, tasks]);
  const currentSession = useMemo(() => getCurrentSession(sessionCards), [sessionCards]);
>>>>>>> theirs
=======
  const sessionCards = useMemo(() => buildSessionCards({ sessions, tasks, now: new Date() }), [sessions, tasks]);
  const currentSession = useMemo(() => getCurrentSession(sessionCards), [sessionCards]);
>>>>>>> theirs
=======
  const sessionCards = useMemo(() => buildSessionCards({ sessions, tasks, now: new Date() }), [sessions, tasks]);
  const currentSession = useMemo(() => getCurrentSession(sessionCards), [sessionCards]);
>>>>>>> theirs
=======
  const sessionCards = useMemo(() => buildSessionCards({ sessions, tasks, now: new Date() }), [sessions, tasks]);
  const currentSession = useMemo(() => getCurrentSession(sessionCards), [sessionCards]);
>>>>>>> theirs
=======
  const sessionCards = useMemo(() => buildSessionCards({ sessions, tasks, now: new Date() }), [sessions, tasks]);
  const currentSession = useMemo(() => getCurrentSession(sessionCards), [sessionCards]);
>>>>>>> theirs
=======
  const sessionCards = useMemo(() => buildSessionCards({ sessions, tasks, now: new Date() }), [sessions, tasks]);
  const currentSession = useMemo(() => getCurrentSession(sessionCards), [sessionCards]);
>>>>>>> theirs
=======
  const sessionCards = useMemo(() => buildSessionCards({ sessions, tasks, now: new Date() }), [sessions, tasks]);
  const currentSession = useMemo(() => getCurrentSession(sessionCards), [sessionCards]);
>>>>>>> theirs
=======
  const sessionCards = useMemo(() => buildSessionCards({ sessions, tasks, now: new Date() }), [sessions, tasks]);
  const currentSession = useMemo(() => getCurrentSession(sessionCards), [sessionCards]);
>>>>>>> theirs
=======
  const sessionCards = useMemo(() => buildSessionCards({ sessions, tasks, now: new Date() }), [sessions, tasks]);
  const currentSession = useMemo(() => getCurrentSession(sessionCards), [sessionCards]);
>>>>>>> theirs
=======
  const sessionCards = useMemo(() => buildSessionCards({ sessions, tasks, now: new Date() }), [sessions, tasks]);
  const currentSession = useMemo(() => getCurrentSession(sessionCards), [sessionCards]);
>>>>>>> theirs
=======
  const sessionCards = useMemo(() => buildSessionCards({ sessions, tasks, now: new Date() }), [sessions, tasks]);
  const currentSession = useMemo(() => getCurrentSession(sessionCards), [sessionCards]);
>>>>>>> theirs
=======
=======
>>>>>>> theirs
  const sessionCards = useMemo(
    () => buildSessionCards({ sessions, tasks, now: new Date() }),
    [sessions, tasks],
  );
  const currentSession = useMemo(() => getCurrentSession(sessionCards), [sessionCards]);
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs

  useEffect(() => {
    if (!currentSession?.actualStart) {
      setElapsedClock('00:00');
      return;
    }
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours

    const tick = () =>
      setElapsedClock(formatElapsed(currentSession.actualStart, new Date()));

    tick();
    const intervalId = setInterval(tick, 1000);

    return () => clearInterval(intervalId);
  }, [currentSession?.actualStart]);

  const handleStart = async (sessionCard: any) => {
    try {
      await startSessionFlow(
        {
          startSession: apiStartSession,
          refresh: refreshAll,
        },
        sessionCard
      );
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to start session');
    }
  };

  const handleEnd = async (sessionCard: any) => {
    try {
      await endSessionFlow(
        {
          endSession: apiEndSession,
          refresh: refreshAll,
        },
        sessionCard,
        100
      );
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to end session');
    }
  };

  const openMissedPrompt = (sessionCard: any) => {
    setSelectedReason('Social media');
    setCustomReason('');
    setMissedTarget(sessionCard);
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
    const timer = setInterval(() => setElapsedClock(formatElapsed(currentSession.actualStart, new Date())), 1000);
    return () => clearInterval(timer);
  }, [currentSession?.actualStart]);
=======
=======
>>>>>>> theirs
    const timer = setInterval(
      () => setElapsedClock(formatElapsed(currentSession.actualStart, new Date())),
      1000,
    );
    return () => clearInterval(timer);
  }, [currentSession?.actualStart]);

  useEffect(() => {
    if (!config.enabled || loading || sessionCards.length === 0) {
      return;
    }

    let stopWebTimers = () => undefined;
    let stopLateLoop = () => undefined;
    let mounted = true;

    const updateDebug = (next: Record<string, unknown>) => {
      if (!mounted) return;
      setNotificationDebug((current) => ({ ...current, ...next }));
    };

    const activate = async () => {
      const permission = await requestReminderPermissions();
      setPermissionState(permission);
      if (permission !== 'granted') {
        setScheduleState('permissions required');
        return;
      }

      const storage = await createNotificationStorage();
      const scheduled = await scheduleDeviceReminders(sessionCards, config, {
        storage,
        onDebug: updateDebug,
      });
      const stored = await loadNotificationState(storage);
      updateDebug({
        scheduledReminderCount: Object.keys(stored.scheduledReminders).length,
        deliveredLateReminderCount: Object.keys(stored.deliveredLateReminders).length,
      });
      stopWebTimers = startWebReminderTimers(scheduled, { onDebug: updateDebug });
      stopLateLoop = startLateCheckLoop({
        sessions: () => buildSessionCards({ sessions, tasks, now: new Date() }),
        config: () => config,
        storage,
        onDebug: updateDebug,
      });
      setScheduleState(`${scheduled.length} reminders armed`);
    };

    activate();

    const sub = AppState.addEventListener('change', async (next) => {
      if (next !== 'active') {
        return;
      }
      const storage = await createNotificationStorage();
      const reconciled = await reconcileNotificationLifecycle({
        sessions: buildSessionCards({ sessions, tasks, now: new Date() }),
        config,
        storage,
        onDebug: updateDebug,
      });
      stopWebTimers();
      stopWebTimers = startWebReminderTimers(reconciled, { onDebug: updateDebug });
      setScheduleState(`${reconciled.length} reminders re-armed`);
    });

    return () => {
      mounted = false;
      stopWebTimers();
      stopLateLoop();
      sub.remove();
    };
  }, [config, loading, sessions, tasks, sessionCards]);
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs

  const api = {
    startSession: apiStartSession,
    endSession: apiEndSession,
    markSessionMissed,
    refresh: refreshAll,
  };

  const handleStart = async (sessionCard: any) => {
<<<<<<< ours
<<<<<<< ours
=======
    await clearSessionReminderState(sessionCard.id, {
      onDebug: (next: any) => setNotificationDebug((cur) => ({ ...cur, ...next })),
    });
>>>>>>> theirs
=======
    await clearSessionReminderState(sessionCard.id, {
      onDebug: (next: any) => setNotificationDebug((cur) => ({ ...cur, ...next })),
    });
>>>>>>> theirs
    await startSessionFlow(api, sessionCard);
  };

  const handleEnd = async (sessionCard: any) => {
    await endSessionFlow(api, sessionCard, 100);
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
    await clearSessionReminderState(sessionCard.id, {
      onDebug: (next: any) => setNotificationDebug((cur) => ({ ...cur, ...next })),
    });
>>>>>>> theirs
=======
    await clearSessionReminderState(sessionCard.id, {
      onDebug: (next: any) => setNotificationDebug((cur) => ({ ...cur, ...next })),
    });
>>>>>>> theirs
  };

  const submitMissed = async () => {
    if (!missedTarget) return;
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours

    try {
      await submitMissedSessionFlow(
        {
          markSessionMissed,
          refresh: refreshAll,
        },
        missedTarget,
        selectedReason,
        selectedReason === 'Custom' ? customReason : ''
      );

      await refreshHabits();
      setMissedTarget(null);
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to mark session missed');
    }
  };

=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
    await submitMissedSessionFlow(api, missedTarget, selectedReason, selectedReason === 'Custom' ? customReason : '');
=======
=======
>>>>>>> theirs
    await submitMissedSessionFlow(
      api,
      missedTarget,
      selectedReason,
      selectedReason === 'Custom' ? customReason : '',
    );
    await clearSessionReminderState(missedTarget.id, {
      onDebug: (next: any) => setNotificationDebug((cur) => ({ ...cur, ...next })),
    });
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
    setMissedTarget(null);
  };

  const createPlannerSession = async ({ taskId, taskTitle, objective, startIso, endIso }: any) => {
    let resolvedTaskId = taskId;
    if (!resolvedTaskId) {
<<<<<<< ours
<<<<<<< ours
      const match = tasks.find((task) => task.title.toLowerCase() === String(taskTitle).toLowerCase());
=======
      const normalized = String(taskTitle || '').trim().toLowerCase();
      const match = tasks.find((task) => task.title.toLowerCase() === normalized);
>>>>>>> theirs
=======
      const normalized = String(taskTitle || '').trim().toLowerCase();
      const match = tasks.find((task) => task.title.toLowerCase() === normalized);
>>>>>>> theirs
      if (match) {
        resolvedTaskId = match.id;
      }
    }
<<<<<<< ours
<<<<<<< ours
    if (!resolvedTaskId) {
      throw new Error('Please choose an existing task title from the list first.');
=======
=======
>>>>>>> theirs

    if (!resolvedTaskId) {
      const createdTask = await createTask({
        title: taskTitle,
        objective: objective || 'Execution block',
        long_term_goal: 'Weekly execution consistency',
        priority: 3,
        estimated_hours: 1,
      });
      resolvedTaskId = createdTask.id;
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
    }

    await createSchedule({
      task_id: resolvedTaskId,
      start_time: startIso,
      end_time: endIso,
      timezone: 'UTC',
      notes: objective || '',
    });
    await refreshAll();
  };

<<<<<<< ours
<<<<<<< ours
=======
=======
>>>>>>> theirs
  const handleResetLocalState = async () => {
    const storage = await createNotificationStorage();
    await resetLocalAppState(storage);
    setNotificationDebug({
      scheduledReminderCount: 0,
      deliveredLateReminderCount: 0,
      lastSpeechResult: 'reset',
      lastNotificationResult: 'reset',
    });
    setScheduleState('local state reset');
  };

<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
  if (showSplash) {
    return <StartupSplash onFinish={() => setShowSplash(false)} />;
  }

<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.page}>
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
        <Text style={styles.title}>Execution System</Text>
        <Text style={styles.status}>Status: {backendStatus}</Text>
        <Text style={styles.status}>
          Display: {config?.display_name || 'Operator'}
        </Text>

        {loading ? (
          <View style={styles.panel}>
            <ActivityIndicator />
            <Text style={styles.cardBody}>Loading system...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.panel}>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Current session</Text>
          {currentSession ? (
            <>
              <Text style={styles.cardTitle}>{currentSession.title}</Text>
              <Text style={styles.cardBody}>
                Scheduled window:{' '}
                {formatWindow(currentSession.plannedStart, currentSession.plannedEnd)}
              </Text>
              <Text style={styles.cardBody}>
                Actual start: {formatTimestamp(currentSession.actualStart)}
              </Text>
              <Text style={styles.cardBody}>Elapsed: {elapsedClock}</Text>
              <Text style={styles.cardBody}>
                Lateness: {currentSession.latenessLabel}
              </Text>
              {currentSession.availableActions.includes('end') ? (
                <View style={styles.actionRow}>
                  <ActionButton
                    label="End session"
                    onPress={() => handleEnd(currentSession)}
                  />
                </View>
              ) : null}
            </>
          ) : (
            <Text style={styles.cardBody}>No active session.</Text>
          )}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Sessions</Text>

          {sessionCards.length === 0 ? (
            <Text style={styles.cardBody}>No sessions found.</Text>
          ) : null}

          {sessionCards.map((sessionCard) => (
            <View key={sessionCard.id} style={styles.card}>
              <Text style={styles.cardTitle}>{sessionCard.title}</Text>
              <Text style={styles.muted}>Status: {sessionCard.status}</Text>
              <Text style={styles.muted}>
                {formatWindow(sessionCard.plannedStart, sessionCard.plannedEnd)}
              </Text>
              <Text style={styles.cardBody}>{sessionCard.goal}</Text>
              <Text style={styles.cardBody}>{sessionCard.latenessLabel}</Text>

              <View style={styles.actionRow}>
                {sessionCard.availableActions.includes('start') ? (
                  <ActionButton
                    label="Start"
                    onPress={() => handleStart(sessionCard)}
                  />
                ) : null}

                {sessionCard.availableActions.includes('end') ? (
                  <ActionButton
                    label="End"
                    onPress={() => handleEnd(sessionCard)}
                  />
                ) : null}

                {sessionCard.availableActions.includes('missed') ? (
                  <ActionButton
                    label="Missed"
                    onPress={() => openMissedPrompt(sessionCard)}
                  />
                ) : null}
              </View>
            </View>
          ))}
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
        <View style={styles.topBar}>
          <Text style={styles.brand}>LIONYX-E</Text>
          <Text style={styles.status}>Backend: {backendStatus}</Text>
=======
=======
>>>>>>> theirs
        <View style={styles.topBar}>
          <Text style={styles.brand}>LIONYX-E</Text>
          <View>
            <Text style={styles.status}>Backend: {backendStatus}</Text>
            <Text style={styles.status}>Notifications: {permissionState}</Text>
          </View>
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
        </View>

        {loading ? <ActivityIndicator color="#D6A436" /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Current Session</Text>
          {currentSession ? (
            <>
              <Text style={styles.sessionTitle}>{currentSession.title}</Text>
              <Text style={styles.body}>Elapsed: {elapsedClock}</Text>
              <Text style={styles.body}>Lateness: {currentSession.latenessLabel}</Text>
              <Pressable style={styles.primaryButton} onPress={() => handleEnd(currentSession)}>
                <Text style={styles.primaryButtonText}>End</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.body}>No active session. Start a planned session below.</Text>
          )}
        </View>

        <WeeklyPlanner sessions={sessionCards} tasks={tasks} onCreate={createPlannerSession} />

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Sessions</Text>
          {sessionCards.map((item) => {
            const actions = getSessionActions(item.status);
            return (
              <View key={item.id} style={styles.sessionCard}>
                <Text style={styles.sessionTitle}>{item.title}</Text>
                <Text style={styles.subtle}>{item.status.toUpperCase()}</Text>
                <Text style={styles.body}>{item.goal}</Text>
<<<<<<< ours
<<<<<<< ours
                <Text style={styles.subtle}>{new Date(item.plannedStart).toLocaleString()} - {new Date(item.plannedEnd).toLocaleTimeString()}</Text>
                <View style={styles.actions}>
                  {actions.canStart ? <Pressable style={styles.primaryButton} onPress={() => handleStart(item)}><Text style={styles.primaryButtonText}>Start</Text></Pressable> : null}
                  {actions.canEnd ? <Pressable style={styles.primaryButton} onPress={() => handleEnd(item)}><Text style={styles.primaryButtonText}>End</Text></Pressable> : null}
                  {actions.canMiss ? <Pressable style={styles.secondaryButton} onPress={() => { setSelectedReason('Social media'); setCustomReason(''); setMissedTarget(item); }}><Text style={styles.secondaryButtonText}>Missed</Text></Pressable> : null}
=======
=======
>>>>>>> theirs
                <Text style={styles.subtle}>
                  {new Date(item.plannedStart).toLocaleString()} -{' '}
                  {new Date(item.plannedEnd).toLocaleTimeString()}
                </Text>
                <View style={styles.actions}>
                  {actions.canStart ? (
                    <Pressable style={styles.primaryButton} onPress={() => handleStart(item)}>
                      <Text style={styles.primaryButtonText}>Start</Text>
                    </Pressable>
                  ) : null}
                  {actions.canEnd ? (
                    <Pressable style={styles.primaryButton} onPress={() => handleEnd(item)}>
                      <Text style={styles.primaryButtonText}>End</Text>
                    </Pressable>
                  ) : null}
                  {actions.canMiss ? (
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => {
                        setSelectedReason('Social media');
                        setCustomReason('');
                        setMissedTarget(item);
                      }}
                    >
                      <Text style={styles.secondaryButtonText}>Missed</Text>
                    </Pressable>
                  ) : null}
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
                </View>
              </View>
            );
          })}
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
=======
>>>>>>> theirs
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Notification Runtime</Text>
          <Text style={styles.subtle}>Schedule state: {scheduleState}</Text>
          <Text style={styles.subtle}>Scheduled reminders: {notificationDebug.scheduledReminderCount}</Text>
          <Text style={styles.subtle}>Delivered late reminders: {notificationDebug.deliveredLateReminderCount}</Text>
          <Pressable style={styles.secondaryButton} onPress={handleResetLocalState}>
            <Text style={styles.secondaryButtonText}>Reset Local Notification State</Text>
          </Pressable>
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
        </View>
      </ScrollView>

      <Modal visible={Boolean(missedTarget)} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.panelTitle}>What were you doing instead?</Text>
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
            <Text style={styles.cardBody}>{missedTarget?.title}</Text>

            <View style={styles.reasonList}>
=======
            <View style={styles.reasonWrap}>
>>>>>>> theirs
=======
            <View style={styles.reasonWrap}>
>>>>>>> theirs
              {MISSED_REASON_OPTIONS.map((reason) => (
                <Pressable
                  key={reason}
                  style={[
                    styles.reasonButton,
<<<<<<< ours
<<<<<<< ours
                    selectedReason === reason && styles.reasonButtonActive,
                  ]}
                  onPress={() => setSelectedReason(reason)}
                >
                  <Text style={styles.buttonText}>{reason}</Text>
                </Pressable>
              ))}
            </View>

            {selectedReason === 'Custom' ? (
              <TextInput
                value={customReason}
                onChangeText={setCustomReason}
                placeholder="Enter custom reason"
                placeholderTextColor="#8fa2bf"
                style={styles.input}
              />
            ) : null}

            <View style={styles.actionRow}>
              <ActionButton
                label="Cancel"
                onPress={() => setMissedTarget(null)}
              />
              <ActionButton
                label="Save"
                onPress={submitMissed}
              />
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
            <View style={styles.reasonWrap}>
              {MISSED_REASON_OPTIONS.map((reason) => (
                <Pressable key={reason} style={[styles.reasonButton, selectedReason === reason ? styles.reasonButtonActive : null]} onPress={() => setSelectedReason(reason)}>
                  <Text style={styles.reasonText}>{reason}</Text>
                </Pressable>
              ))}
            </View>
            {selectedReason === 'Custom' ? (
              <TextInput style={styles.input} placeholder="Custom reason" placeholderTextColor="#888C94" value={customReason} onChangeText={setCustomReason} />
            ) : null}
            <View style={styles.actions}>
              <Pressable style={styles.secondaryButton} onPress={() => setMissedTarget(null)}><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable>
              <Pressable style={styles.primaryButton} onPress={submitMissed}><Text style={styles.primaryButtonText}>Save</Text></Pressable>
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
=======
>>>>>>> theirs
                    selectedReason === reason ? styles.reasonButtonActive : null,
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
                onChangeText={setCustomReason}
              />
            ) : null}
            <View style={styles.actions}>
              <Pressable style={styles.secondaryButton} onPress={() => setMissedTarget(null)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={submitMissed}>
                <Text style={styles.primaryButtonText}>Save</Text>
              </Pressable>
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
function ActionButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function formatWindow(startIso: string | null, endIso: string | null) {
  if (!startIso || !endIso) return 'Not scheduled';

  return `${new Date(startIso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })} - ${new Date(endIso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function formatTimestamp(timestamp: string | null) {
  if (!timestamp) return 'Not started';

  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#061222',
  },
  page: {
    padding: 20,
    gap: 16,
    backgroundColor: '#061222',
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  status: {
    color: '#b7c7df',
  },
  panel: {
    backgroundColor: '#0f2340',
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  card: {
    backgroundColor: '#142b4d',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  panelTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cardBody: {
    color: '#d6e2f3',
  },
  muted: {
    color: '#99adc9',
  },
  error: {
    color: '#ff9a9a',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  button: {
    backgroundColor: '#3466d6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#0f2340',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  reasonList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonButton: {
    backgroundColor: '#1d3c6b',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  reasonButtonActive: {
    backgroundColor: '#3466d6',
  },
  input: {
    borderWidth: 1,
    borderColor: '#34527f',
    backgroundColor: '#0a1830',
    color: '#ffffff',
    borderRadius: 10,
    padding: 12,
    minHeight: 90,
    textAlignVertical: 'top',
  },
});
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#121212' },
  page: { padding: 16, gap: 14, backgroundColor: '#121212' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: '#D6A436', fontWeight: '700', fontSize: 24 },
  status: { color: '#888C94', fontSize: 12 },
  panel: { backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2C2C2C', borderRadius: 16, padding: 14, gap: 8 },
  panelTitle: { color: '#D6A436', fontSize: 19, fontWeight: '700' },
  sessionCard: { backgroundColor: '#141414', borderRadius: 12, borderWidth: 1, borderColor: '#2F2F2F', padding: 10, marginTop: 8, gap: 6 },
  sessionTitle: { color: '#F0F0F0', fontWeight: '700', fontSize: 16 },
  body: { color: '#F0F0F0' },
  subtle: { color: '#888C94', fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primaryButton: { backgroundColor: '#D6A436', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  primaryButtonText: { color: '#121212', fontWeight: '700' },
  secondaryButton: { borderWidth: 1, borderColor: '#888C94', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  secondaryButtonText: { color: '#F0F0F0', fontWeight: '600' },
  error: { color: '#F0F0F0', backgroundColor: '#4A2121', borderRadius: 8, padding: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#1A1A1A', borderRadius: 14, borderWidth: 1, borderColor: '#2E2E2E', padding: 14, gap: 10 },
  reasonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonButton: { borderWidth: 1, borderColor: '#414141', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  reasonButtonActive: { borderColor: '#D6A436', backgroundColor: '#2A2212' },
  reasonText: { color: '#F0F0F0' },
  input: { backgroundColor: '#101010', borderWidth: 1, borderColor: '#333', borderRadius: 8, color: '#F0F0F0', padding: 10 },
});
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
=======
>>>>>>> theirs
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#121212' },
  page: { padding: 16, gap: 14, backgroundColor: '#121212' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: '#D6A436', fontWeight: '700', fontSize: 24 },
  status: { color: '#888C94', fontSize: 12 },
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
  error: { color: '#F0F0F0', backgroundColor: '#4A2121', borderRadius: 8, padding: 8 },
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
});
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
