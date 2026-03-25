import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
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

import StartupSplash from './components/StartupSplash';
import WeeklyPlanner from './components/WeeklyPlanner';
import {
  createSchedule,
  createTask,
  endSession as apiEndSession,
  fetchHabits,
  fetchHealth,
  fetchNotificationConfig,
  fetchSessions,
  fetchTasks,
  markSessionMissed,
  startSession as apiStartSession,
} from './services/api.js';
import {
  buildSessionCards,
  endSessionFlow,
  formatElapsed,
  getCurrentSession,
  MISSED_REASON_OPTIONS,
  startSessionFlow,
  submitMissedSessionFlow,
} from './services/executionLoop.js';
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

const ENABLE_DEV_FALLBACK =
  process.env.EXPO_PUBLIC_ENABLE_DEV_FALLBACK === 'true';

const fallbackTasks = [
  { id: 1, title: 'Strategic Planning', objective: 'Map next release priorities' },
  { id: 2, title: 'Execution Block', objective: 'Ship key workflow improvements' },
];

const fallbackSessions = [
  {
    id: 300,
    task_id: 1,
    planned_start: new Date(Date.now() + 60 * 60_000).toISOString(),
    planned_end: new Date(Date.now() + 120 * 60_000).toISOString(),
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

const EMPTY_NOTIFICATION_DEBUG = {
  scheduledReminderCount: 0,
  deliveredLateReminderCount: 0,
  lastSpeechResult: 'none',
  lastNotificationResult: 'none',
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [tasks, setTasks] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(fallbackConfig);
  const [loading, setLoading] = useState(true);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [permissionState, setPermissionState] = useState('pending');
  const [scheduleState, setScheduleState] = useState('idle');
  const [error, setError] = useState<string | null>(null);
  const [missedTarget, setMissedTarget] = useState<any | null>(null);
  const [selectedReason, setSelectedReason] = useState('Social media');
  const [customReason, setCustomReason] = useState('');
  const [elapsedClock, setElapsedClock] = useState('00:00');
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const [notificationDebug, setNotificationDebug] = useState(
    EMPTY_NOTIFICATION_DEBUG,
  );
  const pendingActionRef = useRef<string | null>(null);

  const refreshAll = async () => {
    const [health, remoteTasks, remoteSessions, remoteConfig] = await Promise.all([
      fetchHealth(),
      fetchTasks(),
      fetchSessions(),
      fetchNotificationConfig(),
    ]);

    setBackendStatus(health.status === 'ok' ? 'connected' : 'unhealthy');
    setTasks(remoteTasks);
    setSessions(remoteSessions);
    setConfig(remoteConfig);
  };

  const refreshHabits = async () => {
    try {
      await fetchHabits();
    } catch {
      // Habit refresh is informational for the current flow.
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
      } catch (nextError: any) {
        if (!cancelled && ENABLE_DEV_FALLBACK) {
          setTasks(fallbackTasks);
          setSessions(fallbackSessions);
          setConfig(fallbackConfig);
          setBackendStatus('dev fallback');
          setError(null);
        } else if (!cancelled) {
          setBackendStatus('offline');
          setError(resolveErrorMessage(nextError, 'Failed to connect to backend'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const sessionCards = useMemo(
    () => buildSessionCards({ sessions, tasks, now: new Date() }),
    [sessions, tasks],
  );
  const currentSession = useMemo(
    () => getCurrentSession(sessionCards),
    [sessionCards],
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
    if (!config?.enabled || loading || sessionCards.length === 0) {
      if (!config?.enabled) {
        setScheduleState('disabled');
      }
      return;
    }

    let cancelled = false;
    let stopWebTimers = () => undefined;
    let stopLateLoop = () => undefined;
    let appStateSubscription:
      | {
          remove: () => void;
        }
      | undefined;

    const updateDebug = (next: Record<string, unknown>) => {
      if (cancelled) {
        return;
      }

      setNotificationDebug((current) => ({ ...current, ...next }));
    };

    const activate = async () => {
      try {
        const permission = await requestReminderPermissions();
        if (cancelled) {
          return;
        }

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
          deliveredLateReminderCount: Object.keys(
            stored.deliveredLateReminders,
          ).length,
        });
        stopWebTimers = startWebReminderTimers(scheduled, { onDebug: updateDebug });
        stopLateLoop = startLateCheckLoop({
          sessions: () => buildSessionCards({ sessions, tasks, now: new Date() }),
          config: () => config,
          storage,
          onDebug: updateDebug,
        });
        setScheduleState(`${scheduled.length} reminders armed`);

        appStateSubscription = AppState.addEventListener('change', async (next) => {
          if (next !== 'active') {
            return;
          }

          const reconciled = await reconcileNotificationLifecycle({
            sessions: buildSessionCards({ sessions, tasks, now: new Date() }),
            config,
            storage,
            onDebug: updateDebug,
          });
          if (cancelled) {
            return;
          }

          stopWebTimers();
          stopWebTimers = startWebReminderTimers(reconciled, {
            onDebug: updateDebug,
          });
          setScheduleState(`${reconciled.length} reminders re-armed`);
        });
      } catch (nextError) {
        if (!cancelled) {
          setScheduleState('notification setup failed');
          setError(resolveErrorMessage(nextError, 'Failed to initialize reminders'));
        }
      }
    };

    activate();

    return () => {
      cancelled = true;
      stopWebTimers();
      stopLateLoop();
      appStateSubscription?.remove();
    };
  }, [config, loading, sessionCards, sessions, tasks]);

  const api = {
    startSession: apiStartSession,
    endSession: apiEndSession,
    markSessionMissed,
    refresh: refreshAll,
  };

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
      setError(resolveErrorMessage(nextError, fallbackMessage));
    } finally {
      pendingActionRef.current = null;
      setPendingActionKey(null);
    }
  };

  const openMissedPrompt = (sessionCard: any) => {
    if (pendingActionRef.current || !sessionCard.availableActions.includes('missed')) {
      return;
    }

    setSelectedReason('Social media');
    setCustomReason('');
    setMissedTarget(sessionCard);
  };

  const handleStart = async (sessionCard: any) => {
    if (!sessionCard.availableActions.includes('start')) {
      return;
    }

    await runLockedAction(
      actionKeyFor('start', sessionCard.id),
      async () => {
        await clearSessionReminderState(sessionCard.id, {
          onDebug: (next: any) =>
            setNotificationDebug((current) => ({ ...current, ...next })),
        });
        await startSessionFlow(api, sessionCard);
      },
      'Failed to start session',
    );
  };

  const handleEnd = async (sessionCard: any) => {
    if (!sessionCard.availableActions.includes('end')) {
      return;
    }

    await runLockedAction(
      actionKeyFor('end', sessionCard.id),
      async () => {
        await endSessionFlow(api, sessionCard, 100);
        await clearSessionReminderState(sessionCard.id, {
          onDebug: (next: any) =>
            setNotificationDebug((current) => ({ ...current, ...next })),
        });
      },
      'Failed to end session',
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
        await clearSessionReminderState(missedTarget.id, {
          onDebug: (next: any) =>
            setNotificationDebug((current) => ({ ...current, ...next })),
        });
        await refreshHabits();
        setMissedTarget(null);
      },
      'Failed to mark session missed',
    );
  };

  const createPlannerSession = async ({
    taskId,
    taskTitle,
    objective,
    startIso,
    endIso,
  }: any) => {
    try {
      let resolvedTaskId = taskId;
      if (!resolvedTaskId) {
        const normalized = String(taskTitle || '').trim().toLowerCase();
        const match = tasks.find(
          (task) => task.title.toLowerCase() === normalized,
        );

        if (match) {
          resolvedTaskId = match.id;
        }
      }

      if (!resolvedTaskId) {
        const createdTask = await createTask({
          title: taskTitle,
          objective: objective || 'Execution block',
          long_term_goal: 'Weekly execution consistency',
          priority: 3,
          estimated_hours: 1,
        });
        resolvedTaskId = createdTask.id;
      }

      await createSchedule({
        task_id: resolvedTaskId,
        start_time: startIso,
        end_time: endIso,
        timezone: 'UTC',
        notes: objective || '',
      });
      await refreshAll();
      setError(null);
    } catch (nextError) {
      const message = resolveErrorMessage(
        nextError,
        'Failed to create planner session',
      );
      setError(message);
      throw new Error(message);
    }
  };

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

  if (showSplash) {
    return <StartupSplash onFinish={() => setShowSplash(false)} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.topBar}>
          <Text style={styles.brand}>LIONYX-E</Text>
          <View>
            <Text style={styles.status}>Backend: {backendStatus}</Text>
            <Text style={styles.status}>Notifications: {permissionState}</Text>
          </View>
        </View>

        {loading ? <ActivityIndicator color="#D6A436" /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Current Session</Text>
          {currentSession ? (
            <>
              <Text style={styles.sessionTitle}>{currentSession.title}</Text>
              <Text style={styles.body}>Elapsed: {elapsedClock}</Text>
              <Text style={styles.body}>
                Lateness: {currentSession.latenessLabel}
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
          ) : (
            <Text style={styles.body}>
              No active session. Start a planned session below.
            </Text>
          )}
        </View>

        <WeeklyPlanner
          sessions={sessionCards}
          tasks={tasks}
          onCreate={createPlannerSession}
        />

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Sessions</Text>
          {sessionCards.map((item) => (
            <View key={item.id} style={styles.sessionCard}>
              <Text style={styles.sessionTitle}>{item.title}</Text>
              <Text style={styles.subtle}>{item.status.toUpperCase()}</Text>
              <Text style={styles.body}>{item.goal}</Text>
              <Text style={styles.subtle}>
                {new Date(item.plannedStart).toLocaleString()} -{' '}
                {new Date(item.plannedEnd).toLocaleTimeString()}
              </Text>
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
              </View>
            </View>
          ))}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Notification Runtime</Text>
          <Text style={styles.subtle}>Schedule state: {scheduleState}</Text>
          <Text style={styles.subtle}>
            Scheduled reminders: {notificationDebug.scheduledReminderCount}
          </Text>
          <Text style={styles.subtle}>
            Delivered late reminders: {notificationDebug.deliveredLateReminderCount}
          </Text>
          <Pressable style={styles.secondaryButton} onPress={handleResetLocalState}>
            <Text style={styles.secondaryButtonText}>
              Reset Local Notification State
            </Text>
          </Pressable>
        </View>
      </ScrollView>

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
  page: { padding: 16, gap: 14, backgroundColor: '#121212' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
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
  buttonDisabled: { opacity: 0.55 },
  error: {
    color: '#F0F0F0',
    backgroundColor: '#4A2121',
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
