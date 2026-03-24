import React, { useEffect, useMemo, useState } from 'react';
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

import {
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
import { createNotificationStorage, loadNotificationState, resetLocalAppState } from './services/notificationState.js';

const ENABLE_DEV_FALLBACK = process.env.EXPO_PUBLIC_ENABLE_DEV_FALLBACK === 'true';

const fallbackTasks = [
  { id: 1, title: 'Deep Work: Product Architecture', objective: 'Finalize planner and metrics API' },
  { id: 2, title: 'Client Delivery', objective: 'Ship weekly dashboard and insights view' },
];

const fallbackSessions = [
  {
    id: 101,
    task_id: 1,
    planned_start: new Date(Date.now() + 15 * 60_000).toISOString(),
    planned_end: new Date(Date.now() + 135 * 60_000).toISOString(),
    actual_start: null,
    actual_end: null,
    completion_percent: 0,
    status: 'planned',
  },
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
  enabled: true,
  start_script: 'session starts now.',
  late_script: 'you are now {minutes} minutes late. Start now.',
  pre_script: 'session starts in {minutes} minutes.',
};

export default function App() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [config, setConfig] = useState(fallbackConfig);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState('pending');
  const [scheduleState, setScheduleState] = useState('idle');
  const [backendStatus, setBackendStatus] = useState('checking');
  const [missedTarget, setMissedTarget] = useState<any | null>(null);
  const [selectedReason, setSelectedReason] = useState('Social media');
  const [customReason, setCustomReason] = useState('');
  const [notificationDebug, setNotificationDebug] = useState({
    scheduledReminderCount: 0,
    deliveredLateReminderCount: 0,
    lastSpeechResult: 'none',
    lastNotificationResult: 'none',
  });

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
    return { tasks: remoteTasks, sessions: remoteSessions, config: remoteConfig };
  };

  const refreshHabits = async () => {
    await fetchHabits();
  };

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        await refreshAll();
      } catch (bootError: any) {
        if (!cancelled && ENABLE_DEV_FALLBACK) {
          setBackendStatus('dev fallback');
          setTasks(fallbackTasks);
          setSessions(fallbackSessions);
          setConfig(fallbackConfig);
        } else if (!cancelled) {
          setBackendStatus('offline');
          setError(bootError.message);
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

  const sessionCards = useMemo(() => buildSessionCards({ sessions, tasks, now: new Date() }), [sessions, tasks]);
  const currentSession = useMemo(() => getCurrentSession(sessionCards), [sessionCards]);
  const [elapsedClock, setElapsedClock] = useState('00:00');

  useEffect(() => {
    if (!currentSession?.actualStart) {
      setElapsedClock('00:00');
      return;
    }
    const tick = () => setElapsedClock(formatElapsed(currentSession.actualStart, new Date()));
    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [currentSession?.actualStart]);

  useEffect(() => {
    if (!config.enabled || loading || sessions.length === 0) {
      return;
    }

    let stopWebTimers = () => undefined;
    let stopLateLoop = () => undefined;
    let isMounted = true;

    const updateDebug = (next: Record<string, unknown>) => {
      if (!isMounted) return;
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
      const scheduled = await scheduleDeviceReminders(sessionCards, config, { storage, onDebug: updateDebug });
      const storedState = await loadNotificationState(storage);
      updateDebug({
        scheduledReminderCount: Object.keys(storedState.scheduledReminders).length,
        deliveredLateReminderCount: Object.keys(storedState.deliveredLateReminders).length,
      });
      stopWebTimers = startWebReminderTimers(scheduled, { onDebug: updateDebug });
      stopLateLoop = startLateCheckLoop({
        sessions: () => buildSessionCards({ sessions, tasks, now: new Date() }),
        config: () => config,
        storage,
        onDebug: updateDebug,
        onLateDetected: (session) => {
          setScheduleState(`late: ${session.title}`);
        },
      });
      setScheduleState(`${scheduled.length} reminders armed`);
    };

    activate();

    const subscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'active') {
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
        try {
          const health = await fetchHealth();
          setBackendStatus(health.status === 'ok' ? 'connected' : 'unhealthy');
        } catch {
          setBackendStatus(ENABLE_DEV_FALLBACK ? 'dev fallback' : 'offline');
        }
      }
    });

    return () => {
      isMounted = false;
      stopWebTimers();
      stopLateLoop();
      subscription.remove();
    };
  }, [config, loading, sessionCards, sessions, tasks]);

  const api = {
    startSession: apiStartSession,
    endSession: apiEndSession,
    markSessionMissed,
    refresh: refreshAll,
  };

  const handleStart = async (sessionCard: any) => {
    await clearSessionReminderState(sessionCard.id, { onDebug: setNotificationDebug });
    await startSessionFlow(api, sessionCard);
  };

  const handleEnd = async (sessionCard: any) => {
    await endSessionFlow(api, sessionCard, 100);
    await clearSessionReminderState(sessionCard.id, { onDebug: setNotificationDebug });
  };

  const openMissedPrompt = (sessionCard: any) => {
    setSelectedReason('Social media');
    setCustomReason('');
    setMissedTarget(sessionCard);
  };

  const submitMissed = async () => {
    if (!missedTarget) {
      return;
    }
    await submitMissedSessionFlow(api, missedTarget, selectedReason, selectedReason === 'Custom' ? customReason : '');
    await clearSessionReminderState(missedTarget.id, { onDebug: setNotificationDebug });
    await refreshHabits();
    setMissedTarget(null);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Local run readiness pass</Text>
          <Text style={styles.title}>Weekly Execution & Behavior Intelligence</Text>
          <Text style={styles.subtitle}>The app now exposes explicit local connection status, env-driven backend targeting, and a developer reset action for local reminder state.</Text>
          <View style={styles.metricGrid}>
            <Metric label="Backend" value={backendStatus} />
            <Metric label="Permission" value={permissionState} />
            <Metric label="Schedule" value={scheduleState} />
            <Metric label="Display" value={config.display_name || 'Operator'} />
          </View>
        </View>

        <Panel title="Developer tools">
          <Text style={styles.cardBody}>Backend connection status: {backendStatus}</Text>
          <Text style={styles.cardBody}>Notification permissions: {permissionState}</Text>
          <View style={styles.actionRow}>
            <ActionButton label="Reset local app state" onPress={handleResetLocalState} />
          </View>
        </Panel>

        <Panel title="Notification debug">
          <Text style={styles.cardBody}>Permission state: {permissionState}</Text>
          <Text style={styles.cardBody}>Scheduled reminders: {notificationDebug.scheduledReminderCount}</Text>
          <Text style={styles.cardBody}>Delivered late reminders: {notificationDebug.deliveredLateReminderCount}</Text>
          <Text style={styles.cardBody}>Last speech delivery: {notificationDebug.lastSpeechResult}</Text>
          <Text style={styles.cardBody}>Last notification delivery: {notificationDebug.lastNotificationResult}</Text>
        </Panel>

        <Panel title="Current session">
          {loading ? <ActivityIndicator color="#88c0ff" /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {currentSession ? (
            <>
              <Text style={styles.cardTitle}>{currentSession.title}</Text>
              <Text style={styles.cardBody}>Scheduled window: {formatWindow(currentSession.plannedStart, currentSession.plannedEnd)}</Text>
              <Text style={styles.cardBody}>Actual start: {formatTimestamp(currentSession.actualStart)}</Text>
              <Text style={styles.cardBody}>Elapsed: {elapsedClock}</Text>
              <Text style={styles.cardBody}>Lateness: {currentSession.latenessLabel}</Text>
              <View style={styles.actionRow}>
                <ActionButton label="End session" onPress={() => handleEnd(currentSession)} />
              </View>
            </>
          ) : (
            <Text style={styles.cardBody}>No active session. Start one from Today&apos;s sessions below.</Text>
          )}
        </Panel>

        <Panel title="Today's sessions">
          {sessionCards.map((sessionCard) => (
            <View key={sessionCard.id} style={styles.card}>
              <Text style={styles.pill}>{sessionCard.status}</Text>
              <Text style={styles.cardTitle}>{sessionCard.title}</Text>
              <Text style={styles.muted}>{formatWindow(sessionCard.plannedStart, sessionCard.plannedEnd)}</Text>
              <Text style={styles.cardBody}>{sessionCard.goal}</Text>
              <Text style={styles.cardBody}>{sessionCard.latenessLabel}</Text>
              <View style={styles.actionRow}>
                {sessionCard.status === 'planned' ? <ActionButton label="Start" onPress={() => handleStart(sessionCard)} /> : null}
                {sessionCard.status === 'active' ? <ActionButton label="End" onPress={() => handleEnd(sessionCard)} /> : null}
                {sessionCard.status !== 'completed' && sessionCard.status !== 'missed' ? <ActionButton label="Mark missed" onPress={() => openMissedPrompt(sessionCard)} /> : null}
              </View>
            </View>
          ))}
        </Panel>
      </ScrollView>

      <Modal visible={Boolean(missedTarget)} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.panelTitle}>What were you doing instead?</Text>
            <Text style={styles.cardBody}>{missedTarget?.title}</Text>
            <View style={styles.tagList}>
              {MISSED_REASON_OPTIONS.map((reason) => (
                <Pressable key={reason} style={[styles.tagButton, selectedReason === reason ? styles.tagButtonActive : null]} onPress={() => setSelectedReason(reason)}>
                  <Text style={styles.buttonText}>{reason}</Text>
                </Pressable>
              ))}
            </View>
            {selectedReason === 'Custom' ? (
              <TextInput
                value={customReason}
                onChangeText={setCustomReason}
                placeholder="Enter custom reason"
                placeholderTextColor="#7b8ba8"
                style={styles.input}
              />
            ) : null}
            <View style={styles.actionRow}>
              <ActionButton label="Cancel" onPress={() => setMissedTarget(null)} />
              <ActionButton label="Save missed reason" onPress={submitMissed} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function formatWindow(startIso: string | null, endIso: string | null) {
  if (!startIso || !endIso) {
    return 'Not scheduled';
  }
  return `${new Date(startIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(endIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function formatTimestamp(timestamp: string | null) {
  return timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not started';
}

function Panel({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function ActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#09111d' },
  page: { padding: 20, gap: 16, backgroundColor: '#09111d' },
  hero: { backgroundColor: '#0d1728', borderRadius: 24, padding: 20, gap: 12 },
  eyebrow: { color: '#88c0ff', textTransform: 'uppercase', letterSpacing: 1, fontSize: 12 },
  title: { color: '#f4f7fb', fontSize: 30, fontWeight: '700' },
  subtitle: { color: '#c4d1e3', lineHeight: 22 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricCard: { width: '47%', backgroundColor: '#13233d', borderRadius: 18, padding: 14, gap: 6 },
  metricValue: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
  panel: { backgroundColor: '#0d1728', borderRadius: 24, padding: 18, gap: 12 },
  panelTitle: { color: '#ffffff', fontSize: 20, fontWeight: '600' },
  card: { backgroundColor: '#13233d', borderRadius: 18, padding: 14, gap: 8 },
  cardTitle: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  cardBody: { color: '#d3dff0', lineHeight: 20 },
  muted: { color: '#93a7c2' },
  pill: { color: '#ffffff', backgroundColor: '#2b59c3', alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: { backgroundColor: '#315bca', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-start' },
  buttonText: { color: '#ffffff', fontWeight: '700' },
  input: { minHeight: 100, borderRadius: 16, borderWidth: 1, borderColor: '#25436d', color: '#ffffff', backgroundColor: '#09111d', padding: 12, textAlignVertical: 'top' },
  tagList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagButton: { backgroundColor: '#315bca', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 },
  tagButtonActive: { backgroundColor: '#4f7bff' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(3, 7, 18, 0.75)', justifyContent: 'flex-end', padding: 20 },
  modalCard: { backgroundColor: '#0d1728', borderRadius: 24, padding: 18, gap: 12 },
  error: { color: '#fca5a5' },
});
