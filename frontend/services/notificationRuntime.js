import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import * as Notifications from 'expo-notifications';

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
  buildNotificationPayload,
  buildSessionReminderPlan,
  getLateSessions,
} from './notificationPlan.js';

=======
import { buildNotificationPayload, buildSessionReminderPlan, getLateSessions } from './notificationPlan.js';
>>>>>>> theirs
=======
import { buildNotificationPayload, buildSessionReminderPlan, getLateSessions } from './notificationPlan.js';
>>>>>>> theirs
=======
import { buildNotificationPayload, buildSessionReminderPlan, getLateSessions } from './notificationPlan.js';
>>>>>>> theirs
=======
import { buildNotificationPayload, buildSessionReminderPlan, getLateSessions } from './notificationPlan.js';
>>>>>>> theirs
=======
import { buildNotificationPayload, buildSessionReminderPlan, getLateSessions } from './notificationPlan.js';
>>>>>>> theirs
=======
import { buildNotificationPayload, buildSessionReminderPlan, getLateSessions } from './notificationPlan.js';
>>>>>>> theirs
=======
import { buildNotificationPayload, buildSessionReminderPlan, getLateSessions } from './notificationPlan.js';
>>>>>>> theirs
=======
import { buildNotificationPayload, buildSessionReminderPlan, getLateSessions } from './notificationPlan.js';
>>>>>>> theirs
=======
import { buildNotificationPayload, buildSessionReminderPlan, getLateSessions } from './notificationPlan.js';
>>>>>>> theirs
=======
import { buildNotificationPayload, buildSessionReminderPlan, getLateSessions } from './notificationPlan.js';
>>>>>>> theirs
=======
import { buildNotificationPayload, buildSessionReminderPlan, getLateSessions } from './notificationPlan.js';
>>>>>>> theirs
=======
import { buildNotificationPayload, buildSessionReminderPlan, getLateSessions } from './notificationPlan.js';
>>>>>>> theirs
=======
import { buildNotificationPayload, buildSessionReminderPlan, getLateSessions } from './notificationPlan.js';
>>>>>>> theirs
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
    shouldShowAlert: true,
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
    shouldSetBadge: false,
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
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
          sound: true,
>>>>>>> theirs
=======
          sound: true,
>>>>>>> theirs
=======
          sound: true,
>>>>>>> theirs
=======
          sound: true,
>>>>>>> theirs
=======
          sound: true,
>>>>>>> theirs
=======
          sound: true,
>>>>>>> theirs
=======
          sound: true,
>>>>>>> theirs
=======
          sound: true,
>>>>>>> theirs
=======
          sound: true,
>>>>>>> theirs
=======
          sound: true,
>>>>>>> theirs
=======
          sound: true,
>>>>>>> theirs
=======
          sound: true,
>>>>>>> theirs
=======
          sound: true,
>>>>>>> theirs
        },
        trigger: new Date(reminder.triggerAt),
      });
    },
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
    async cancel(id) {
      if (id) await Notifications.cancelScheduledNotificationAsync(id);
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
    async cancel(identifier) {
      if (identifier) {
        await Notifications.cancelScheduledNotificationAsync(identifier);
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
    },
    async present(payload) {
      await Notifications.presentNotificationAsync({
        title: payload.title,
        body: payload.body,
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
      });
      return 'native';
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
        data: payload.data,
        sound: true,
      });
      return 'native-presented';
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
    },
  };
}

function createWebNotifier() {
  return {
    async schedule(reminder) {
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
      return `${reminder.sessionId}-${reminder.eventType}`;
    },
    async cancel() {},
    async present(payload) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(payload.title, { body: payload.body });
        return 'web';
      }
      return 'unavailable';
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
      return `${buildReminderKey(reminder.sessionId, reminder.eventType)}:${reminder.triggerAt}`;
    },
    async cancel() {
      return undefined;
    },
    async present(payload) {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(payload.title, { body: payload.body });
        return 'web-notification';
      }
      return 'notification-unavailable';
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
    },
  };
}

export async function requestReminderPermissions() {
  if (Platform.OS === 'web') {
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
    if ('Notification' in window) return Notification.requestPermission();
=======
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.requestPermission();
    }
>>>>>>> theirs
=======
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.requestPermission();
    }
>>>>>>> theirs
=======
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.requestPermission();
    }
>>>>>>> theirs
=======
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.requestPermission();
    }
>>>>>>> theirs
=======
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.requestPermission();
    }
>>>>>>> theirs
=======
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.requestPermission();
    }
>>>>>>> theirs
=======
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.requestPermission();
    }
>>>>>>> theirs
=======
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.requestPermission();
    }
>>>>>>> theirs
=======
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.requestPermission();
    }
>>>>>>> theirs
=======
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.requestPermission();
    }
>>>>>>> theirs
=======
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.requestPermission();
    }
>>>>>>> theirs
=======
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.requestPermission();
    }
>>>>>>> theirs
=======
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.requestPermission();
    }
>>>>>>> theirs
    return 'unavailable';
  }

  const settings = await Notifications.getPermissionsAsync();
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
  if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return 'granted';
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted ? 'granted' : 'denied';
}

export async function scheduleDeviceReminders(sessions, config, options = {}) {
  const now = options.now ?? new Date();
  const storage = options.storage ?? await createNotificationStorage();
  const notifier = options.notifier ?? (Platform.OS === 'web' ? createWebNotifier() : createNativeNotifier());
  const displayName = options.displayName ?? await loadDisplayName(storage, config.display_name || 'Operator');
  const existingState = await loadNotificationState(storage);
  const desiredReminders = sessions.flatMap((session) => buildSessionReminderPlan(session, config, now, displayName));
  const reconciliation = reconcileStoredReminders(existingState, desiredReminders);

  for (const staleReminder of reconciliation.toCancel) {
    await notifier.cancel(staleReminder.identifier);
  }

  const scheduled = [];
  let nextState = { ...reconciliation.nextState };
  for (const reminder of reconciliation.toSchedule) {
    const identifier = await notifier.schedule(reminder);
    const key = buildReminderKey(reminder.sessionId, reminder.eventType);
    nextState.scheduledReminders[key] = { ...reminder, identifier };
  }

  await saveNotificationState(storage, nextState);
  scheduled.push(...Object.values(nextState.scheduledReminders));
  options.onDebug?.({
    scheduledReminderCount: scheduled.length,
    deliveredLateReminderCount: Object.keys(nextState.deliveredLateReminders).length,
  });
  return scheduled;
}

export function startWebReminderTimers(reminders, options = {}) {
  if (Platform.OS !== 'web') {
    return () => undefined;
  }

  const timerIds = reminders.map((reminder) => {
    const delay = Math.max(new Date(reminder.triggerAt).getTime() - Date.now(), 0);
    return setTimeout(async () => {
      const speechResult = await deliverSpeech(reminder.payload.voiceText);
      const notificationResult = await deliverWebNotification(reminder.payload.title, reminder.payload.body);
      options.onDebug?.({ lastSpeechResult: speechResult, lastNotificationResult: notificationResult });
    }, delay);
  });

  return () => timerIds.forEach(clearTimeout);
}

export function startLateCheckLoop({ sessions, config, onLateDetected, pollIntervalMs = 60_000, graceMinutes = 10, storage, notifier, onDebug }) {
  const tick = async () => {
    const resolvedStorage = storage ?? await createNotificationStorage();
    const resolvedNotifier = notifier ?? (Platform.OS === 'web' ? createWebNotifier() : createNativeNotifier());
    const state = await loadNotificationState(resolvedStorage);
    const displayName = await loadDisplayName(resolvedStorage, config().display_name || 'Operator');
    const lateSessions = getLateSessions(sessions(), new Date(), graceMinutes);
    let nextState = state;

    for (const session of lateSessions) {
      if (hasDeliveredLateReminder(nextState, session.id)) {
        continue;
      }
      const latenessMinutes = Math.max(Math.floor((Date.now() - new Date(session.plannedStart).getTime()) / 60_000), graceMinutes);
      const payload = buildNotificationPayload(session, config(), 'late', displayName, latenessMinutes);
      const delivery = await deliverReminder(payload, { notifier: resolvedNotifier });
      nextState = markLateReminderDelivered(nextState, session.id);
      await saveNotificationState(resolvedStorage, nextState);
      onLateDetected?.(session, payload);
      onDebug?.({
        deliveredLateReminderCount: Object.keys(nextState.deliveredLateReminders).length,
        lastSpeechResult: delivery.speechResult,
        lastNotificationResult: delivery.notificationResult,
      });
    }
  };

  tick();
  const intervalId = setInterval(tick, pollIntervalMs);
  return () => clearInterval(intervalId);
}

export async function reconcileNotificationLifecycle({ sessions, config, storage, notifier, onDebug }) {
  const resolvedStorage = storage ?? await createNotificationStorage();
  const resolvedNotifier = notifier ?? (Platform.OS === 'web' ? createWebNotifier() : createNativeNotifier());
  const state = await loadNotificationState(resolvedStorage);
  let nextState = state;
  const activeSessionIds = new Set(sessions.map((session) => String(session.id)));

  for (const reminder of Object.values(state.scheduledReminders)) {
    if (!activeSessionIds.has(String(reminder.sessionId))) {
      await resolvedNotifier.cancel(reminder.identifier);
      nextState = clearSessionNotificationState(nextState, reminder.sessionId);
    }
  }

  const validSessions = sessions.filter((session) => !['completed', 'missed'].includes(session.status));
  await saveNotificationState(resolvedStorage, nextState);
  return scheduleDeviceReminders(validSessions, config, { storage: resolvedStorage, notifier: resolvedNotifier, onDebug });
}

export async function clearSessionReminderState(sessionId, options = {}) {
  const storage = options.storage ?? await createNotificationStorage();
  const notifier = options.notifier ?? (Platform.OS === 'web' ? createWebNotifier() : createNativeNotifier());
  const state = await loadNotificationState(storage);
  const pre = state.scheduledReminders[buildReminderKey(sessionId, 'pre')];
  const start = state.scheduledReminders[buildReminderKey(sessionId, 'start')];
  await notifier.cancel(pre?.identifier);
  await notifier.cancel(start?.identifier);
  const nextState = clearSessionNotificationState(state, sessionId);
  await saveNotificationState(storage, nextState);
  options.onDebug?.({
    scheduledReminderCount: Object.keys(nextState.scheduledReminders).length,
    deliveredLateReminderCount: Object.keys(nextState.deliveredLateReminders).length,
  });
  return nextState;
}

export async function deliverReminder(payload, options = {}) {
  const notifier = options.notifier ?? (Platform.OS === 'web' ? createWebNotifier() : createNativeNotifier());
  const notificationResult = await notifier.present(payload);
  const speechResult = await deliverSpeech(payload.voiceText);
  return { notificationResult, speechResult };
}

export async function deliverWebNotification(title, body) {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
    return 'web-notification';
  }
  return 'notification-unavailable';
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
}

export async function deliverSpeech(text) {
  if (Platform.OS === 'web') {
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
    if ('speechSynthesis' in window) {
      speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      return 'web';
    }
    return 'none';
  }

  Speech.speak(text);
  return 'native';
}
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
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
      return 'web-speech';
    }
    return 'speech-unavailable';
  }

  Speech.speak(text, { language: 'en-US', pitch: 1.0, rate: 0.95 });
  return 'expo-speech';
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
