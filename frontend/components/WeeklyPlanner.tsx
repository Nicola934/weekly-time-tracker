import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function dayLabel(iso: string) {
  const date = new Date(iso);
  return DAYS[(date.getDay() + 6) % 7];
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function nextIsoForDay(dayName: string, timeText: string) {
  const now = new Date();
  const [hour, minute] = timeText.split(':').map((v) => Number(v || '0'));
  const targetDow = DAYS.indexOf(dayName);
  const nowDow = (now.getDay() + 6) % 7;
  const delta = targetDow - nowDow;
  const target = new Date(now);
  target.setDate(now.getDate() + delta);
  target.setHours(hour, minute, 0, 0);
  return target.toISOString();
}

export default function WeeklyPlanner({ sessions, tasks, onCreate }: any) {
  const [modalDay, setModalDay] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<number | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');

  const grouped = useMemo(() => {
    const data: Record<string, any[]> = Object.fromEntries(DAYS.map((d) => [d, []]));
    for (const session of sessions) {
      const day = dayLabel(session.plannedStart);
      data[day].push(session);
    }
    return data;
  }, [sessions]);

  const save = async () => {
    if (!modalDay) return;
    const resolvedTaskId = taskId ?? null;
    await onCreate({
      day: modalDay,
      taskId: resolvedTaskId,
      taskTitle,
      objective,
      startIso: nextIsoForDay(modalDay, startTime),
      endIso: nextIsoForDay(modalDay, endTime),
    });
    setModalDay(null);
    setTaskId(null);
    setTaskTitle('');
    setObjective('');
    setStartTime('09:00');
    setEndTime('10:00');
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Weekly Planner</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {DAYS.map((day) => (
            <View key={day} style={styles.dayCard}>
              <Text style={styles.dayTitle}>{day}</Text>
              {grouped[day].length === 0 ? <Text style={styles.empty}>No sessions</Text> : null}
              {grouped[day].map((item) => (
                <View key={item.id} style={styles.sessionItem}>
                  <Text style={styles.sessionTitle}>{item.title}</Text>
                  <Text style={styles.sessionTime}>{formatTime(item.plannedStart)} - {formatTime(item.plannedEnd)}</Text>
                </View>
              ))}
              <Pressable style={styles.addButton} onPress={() => setModalDay(day)}>
                <Text style={styles.addText}>+ Add Session</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal visible={Boolean(modalDay)} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add Session • {modalDay}</Text>
            <TextInput style={styles.input} placeholder="Task name" placeholderTextColor="#888C94" value={taskTitle} onChangeText={setTaskTitle} />
            <TextInput style={styles.input} placeholder="Objective" placeholderTextColor="#888C94" value={objective} onChangeText={setObjective} />
            <TextInput style={styles.input} placeholder="Start HH:MM" placeholderTextColor="#888C94" value={startTime} onChangeText={setStartTime} />
            <TextInput style={styles.input} placeholder="End HH:MM" placeholderTextColor="#888C94" value={endTime} onChangeText={setEndTime} />
            <Text style={styles.pickLabel}>Choose existing task (optional)</Text>
            <ScrollView style={{ maxHeight: 120 }}>
              {tasks.map((task: any) => (
                <Pressable key={task.id} onPress={() => { setTaskId(task.id); setTaskTitle(task.title); setObjective(task.objective || objective); }} style={[styles.taskPick, taskId === task.id ? styles.taskPickActive : null]}>
                  <Text style={styles.taskPickText}>{task.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.actions}>
              <Pressable style={styles.cancelButton} onPress={() => setModalDay(null)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
              <Pressable style={styles.saveButton} onPress={save}><Text style={styles.saveText}>Save</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: '#1B1B1B', borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 16, padding: 14, gap: 10 },
  title: { color: '#D6A436', fontSize: 20, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10 },
  dayCard: { width: 230, backgroundColor: '#171717', borderRadius: 14, borderWidth: 1, borderColor: '#2E2E2E', padding: 10, gap: 8 },
  dayTitle: { color: '#F0F0F0', fontWeight: '700' },
  empty: { color: '#888C94' },
  sessionItem: { borderRadius: 10, backgroundColor: '#111111', padding: 8 },
  sessionTitle: { color: '#F0F0F0', fontSize: 13 },
  sessionTime: { color: '#888C94', fontSize: 12 },
  addButton: { backgroundColor: '#D6A436', borderRadius: 999, paddingVertical: 8, alignItems: 'center' },
  addText: { color: '#121212', fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { width: '100%', maxWidth: 480, backgroundColor: '#161616', borderRadius: 14, padding: 16, gap: 10, borderWidth: 1, borderColor: '#343434' },
  modalTitle: { color: '#D6A436', fontWeight: '700', fontSize: 18 },
  input: { backgroundColor: '#101010', borderWidth: 1, borderColor: '#333', borderRadius: 10, color: '#F0F0F0', padding: 10 },
  pickLabel: { color: '#888C94', marginTop: 4 },
  taskPick: { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#2f2f2f', marginBottom: 6 },
  taskPickActive: { borderColor: '#D6A436' },
  taskPickText: { color: '#F0F0F0' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 6 },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: '#666' },
  cancelText: { color: '#F0F0F0' },
  saveButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, backgroundColor: '#D6A436' },
  saveText: { color: '#121212', fontWeight: '700' },
});
