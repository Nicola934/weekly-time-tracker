import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import * as Notifications from 'expo-notifications';

import {
  buildNotificationPayload,
  buildSessionReminderPlan,
  getLateSessions,
} from './notificationPlan.js';

import {
  buildReminderKey,
  clearSessionNotificationState,
  createNotificationStorage,
  hasDeliveredLateReminder,
  loadDisplayName,
  loadNotificationState,
  markLateReminderDelivered,
  reconcileStoredReminders,
  saveNotificationState,
} from './notificationState.js';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldShowAlert: true,
  }),
});

function createNativeNotifier() {
  return {
    async schedule(reminder) {
      return Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.payload.title,
          body: reminder.payload.body,
          data: reminder.payload.data,
        },
        trigger: new Date(reminder.triggerAt),
      });
    },
    async cancel(id) {
      if (id) await Notifications.cancelScheduledNotificationAsync(id);
    },
    async present(payload) {
      await Notifications.presentNotificationAsync({
        title: payload.title,
        body: payload.body,
      });
      return 'native';
    },
  };
}

function createWebNotifier() {
  return {
    async schedule(reminder) {
      return `${reminder.sessionId}-${reminder.eventType}`;
    },
    async cancel() {},
    async present(payload) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(payload.title, { body: payload.body });
        return 'web';
      }
      return 'unavailable';
    },
  };
}

export async function requestReminderPermissions() {
  if (Platform.OS === 'web') {
    if ('Notification' in window) return Notification.requestPermission();
    return 'unavailable';
  }

  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return 'granted';

  const req = await Notifications.requestPermissionsAsync();
  return req.granted ? 'granted' : 'denied';
}

export async function scheduleDeviceReminders(sessions, config) {
  const storage = await createNotificationStorage();
  const notifier =
    Platform.OS === 'web' ? createWebNotifier() : createNativeNotifier();

  const state = await loadNotificationState(storage);

  const reminders = sessions.flatMap((s) =>
    buildSessionReminderPlan(s, config)
  );

  const { toSchedule, toCancel, nextState } =
    reconcileStoredReminders(state, reminders);

  for (const r of toCancel) {
    await notifier.cancel(r.identifier);
  }

  for (const r of toSchedule) {
    const id = await notifier.schedule(r);
    nextState.scheduledReminders[
      buildReminderKey(r.sessionId, r.eventType)
    ] = { ...r, identifier: id };
  }

  await saveNotificationState(storage, nextState);
}

export function startLateCheckLoop({ sessions, config }) {
  const interval = setInterval(async () => {
    const storage = await createNotificationStorage();
    const state = await loadNotificationState(storage);
    const notifier =
      Platform.OS === 'web' ? createWebNotifier() : createNativeNotifier();

    const late = getLateSessions(sessions(), new Date());

    for (const s of late) {
      if (hasDeliveredLateReminder(state, s.id)) continue;

      const payload = buildNotificationPayload(s, config(), 'late');

      await notifier.present(payload);
      await deliverSpeech(payload.voiceText);

      const next = markLateReminderDelivered(state, s.id);
      await saveNotificationState(storage, next);
    }
  }, 60000);

  return () => clearInterval(interval);
}

export async function deliverSpeech(text) {
  if (Platform.OS === 'web') {
    if ('speechSynthesis' in window) {
      speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      return 'web';
    }
    return 'none';
  }

  Speech.speak(text);
  return 'native';
}