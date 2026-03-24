import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
  const [config, setConfig] = useState<any>(fallbackConfig);

  const [loading, setLoading] = useState(true);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [error, setError] = useState<string | null>(null);

  const [missedTarget, setMissedTarget] = useState<any | null>(null);
  const [selectedReason, setSelectedReason] = useState('Social media');
  const [customReason, setCustomReason] = useState('');

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

    return () => {
      cancelled = true;
    };
  }, []);

  const sessionCards = useMemo(
    () => buildSessionCards({ sessions, tasks, now: new Date() }),
    [sessions, tasks]
  );

  const currentSession = useMemo(
    () => getCurrentSession(sessionCards),
    [sessionCards]
  );

  const [elapsedClock, setElapsedClock] = useState('00:00');

  useEffect(() => {
    if (!currentSession?.actualStart) {
      setElapsedClock('00:00');
      return;
    }

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
  };

  const submitMissed = async () => {
    if (!missedTarget) return;

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.page}>
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
        </View>
      </ScrollView>

      <Modal visible={Boolean(missedTarget)} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.panelTitle}>What were you doing instead?</Text>
            <Text style={styles.cardBody}>{missedTarget?.title}</Text>

            <View style={styles.reasonList}>
              {MISSED_REASON_OPTIONS.map((reason) => (
                <Pressable
                  key={reason}
                  style={[
                    styles.reasonButton,
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
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

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