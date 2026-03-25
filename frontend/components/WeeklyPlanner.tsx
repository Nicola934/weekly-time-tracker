import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

function dayLabel(iso: string) {
  const date = new Date(iso);
  return DAYS[(date.getDay() + 6) % 7];
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseTimeParts(timeText: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(timeText).trim());
  if (!match) {
    throw new Error('Use HH:MM for planner times.');
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
    throw new Error('Planner times must be valid 24-hour values.');
  }

  return { hour, minute };
}

function nextPlannerDate(dayName: string, now = new Date()) {
  const targetDow = DAYS.indexOf(dayName);
  if (targetDow === -1) {
    throw new Error('Unknown planner day.');
  }

  const nowDow = (now.getDay() + 6) % 7;
  let delta = targetDow - nowDow;

  if (delta < 0) {
    delta += 7;
  }

  const target = new Date(now);
  target.setDate(now.getDate() + delta);
  target.setHours(0, 0, 0, 0);

  return target;
}

function buildSessionRange(dayName: string, startText: string, endText: string, now = new Date()) {
  const { hour: startHour, minute: startMinute } = parseTimeParts(startText);
  const { hour: endHour, minute: endMinute } = parseTimeParts(endText);
  const baseDate = nextPlannerDate(dayName, now);
  const start = new Date(baseDate);
  const end = new Date(baseDate);

  start.setHours(startHour, startMinute, 0, 0);
  end.setHours(endHour, endMinute, 0, 0);

  if (end <= start) {
    throw new Error('End time must be after start time.');
  }

  if (baseDate.toDateString() === now.toDateString() && start <= now) {
    start.setDate(start.getDate() + 7);
    end.setDate(end.getDate() + 7);
  }

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export default function WeeklyPlanner({ sessions, tasks, onCreate }: any) {
  const [modalDay, setModalDay] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<number | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const grouped = useMemo(() => {
    const data: Record<string, any[]> = Object.fromEntries(
      DAYS.map((day) => [day, []]),
    );

    for (const session of sessions) {
      const day = dayLabel(session.plannedStart);
      data[day].push(session);
    }

    return data;
  }, [sessions]);

  const resetForm = () => {
    setModalDay(null);
    setTaskId(null);
    setTaskTitle('');
    setObjective('');
    setStartTime('09:00');
    setEndTime('10:00');
    setFormError(null);
    setSaving(false);
  };

  const save = async () => {
    if (!modalDay || saving) {
      return;
    }

    try {
      const normalizedTitle = String(taskTitle || '').trim();
      if (!taskId && !normalizedTitle) {
        throw new Error('Choose a task or enter a task name first.');
      }

      const { startIso, endIso } = buildSessionRange(modalDay, startTime, endTime);

      setSaving(true);
      setFormError(null);
      await onCreate({
        day: modalDay,
        taskId,
        taskTitle: normalizedTitle,
        objective,
        startIso,
        endIso,
      });
      resetForm();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Failed to save planner session.',
      );
      setSaving(false);
    }
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Weekly Planner</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {DAYS.map((day) => (
            <View key={day} style={styles.dayCard}>
              <Text style={styles.dayTitle}>{day}</Text>
              {grouped[day].length === 0 ? (
                <Text style={styles.empty}>No sessions</Text>
              ) : null}
              {grouped[day].map((item) => (
                <View key={item.id} style={styles.sessionItem}>
                  <Text style={styles.sessionTitle}>{item.title}</Text>
                  <Text style={styles.sessionTime}>
                    {formatTime(item.plannedStart)} - {formatTime(item.plannedEnd)}
                  </Text>
                </View>
              ))}
              <Pressable
                style={styles.addButton}
                onPress={() => {
                  setModalDay(day);
                  setFormError(null);
                }}
              >
                <Text style={styles.addText}>+ Add Session</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={Boolean(modalDay)} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add Session for {modalDay}</Text>
            {formError ? <Text style={styles.error}>{formError}</Text> : null}
            <TextInput
              style={styles.input}
              placeholder="Task name"
              placeholderTextColor="#888C94"
              value={taskTitle}
              editable={!saving}
              onChangeText={setTaskTitle}
            />
            <TextInput
              style={styles.input}
              placeholder="Objective"
              placeholderTextColor="#888C94"
              value={objective}
              editable={!saving}
              onChangeText={setObjective}
            />
            <TextInput
              style={styles.input}
              placeholder="Start HH:MM"
              placeholderTextColor="#888C94"
              value={startTime}
              editable={!saving}
              onChangeText={setStartTime}
            />
            <TextInput
              style={styles.input}
              placeholder="End HH:MM"
              placeholderTextColor="#888C94"
              value={endTime}
              editable={!saving}
              onChangeText={setEndTime}
            />
            <Text style={styles.pickLabel}>Choose existing task (optional)</Text>
            <ScrollView style={styles.taskList}>
              {tasks.map((task: any) => (
                <Pressable
                  key={task.id}
                  disabled={saving}
                  onPress={() => {
                    setTaskId(task.id);
                    setTaskTitle(task.title);
                    setObjective(task.objective || '');
                    setFormError(null);
                  }}
                  style={[
                    styles.taskPick,
                    taskId === task.id ? styles.taskPickActive : null,
                  ]}
                >
                  <Text style={styles.taskPickText}>{task.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.actions}>
              <Pressable
                style={[styles.cancelButton, saving ? styles.disabledButton : null]}
                disabled={saving}
                onPress={resetForm}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveButton, saving ? styles.disabledButton : null]}
                disabled={saving}
                onPress={save}
              >
                <Text style={styles.saveText}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#1B1B1B',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  title: { color: '#D6A436', fontSize: 20, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10 },
  dayCard: {
    width: 230,
    backgroundColor: '#171717',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2E2E2E',
    padding: 10,
    gap: 8,
  },
  dayTitle: { color: '#F0F0F0', fontWeight: '700' },
  empty: { color: '#888C94' },
  sessionItem: { borderRadius: 10, backgroundColor: '#111111', padding: 8 },
  sessionTitle: { color: '#F0F0F0', fontSize: 13 },
  sessionTime: { color: '#888C94', fontSize: 12 },
  addButton: {
    backgroundColor: '#D6A436',
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
  },
  addText: { color: '#121212', fontWeight: '700' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#161616',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#343434',
  },
  modalTitle: { color: '#D6A436', fontWeight: '700', fontSize: 18 },
  error: {
    color: '#F0F0F0',
    backgroundColor: '#4A2121',
    borderRadius: 8,
    padding: 8,
  },
  input: {
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    color: '#F0F0F0',
    padding: 10,
  },
  pickLabel: { color: '#888C94', marginTop: 4 },
  taskList: { maxHeight: 120 },
  taskPick: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2F2F2F',
    marginBottom: 6,
  },
  taskPickActive: { borderColor: '#D6A436' },
  taskPickText: { color: '#F0F0F0' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 6 },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#666',
  },
  cancelText: { color: '#F0F0F0' },
  saveButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#D6A436',
  },
  saveText: { color: '#121212', fontWeight: '700' },
  disabledButton: { opacity: 0.6 },
});
