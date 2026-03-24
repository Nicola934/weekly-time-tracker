export const NOTIFICATION_STATE_KEY = 'weekly_execution_notification_state';
export const DISPLAY_NAME_KEY = 'weekly_execution_display_name';
export const LOCAL_APP_STATE_KEYS = [NOTIFICATION_STATE_KEY, DISPLAY_NAME_KEY];

export function createEmptyNotificationState() {
  return {
    scheduledReminders: {},
    deliveredLateReminders: {},
  };
}

export function buildReminderKey(sessionId, reminderType) {
  return `${sessionId}:${reminderType}`;
}

export function reconcileStoredReminders(existingState, desiredReminders) {
  const desiredMap = Object.fromEntries(desiredReminders.map((reminder) => [buildReminderKey(reminder.sessionId, reminder.eventType), reminder]));
  const toSchedule = [];
  const toCancel = [];
  const nextScheduledReminders = {};
  const scheduledKeys = new Set();

  for (const [key, existingReminder] of Object.entries(existingState.scheduledReminders ?? {})) {
    const desired = desiredMap[key];
    if (!desired) {
      toCancel.push(existingReminder);
      continue;
    }
    if (existingReminder.triggerAt !== desired.triggerAt) {
      toCancel.push(existingReminder);
      toSchedule.push(desired);
      scheduledKeys.add(key);
      continue;
    }
    nextScheduledReminders[key] = existingReminder;
    scheduledKeys.add(key);
  }

  for (const [key, desired] of Object.entries(desiredMap)) {
    if (!scheduledKeys.has(key)) {
      toSchedule.push(desired);
      scheduledKeys.add(key);
    }
  }

  return {
    toSchedule,
    toCancel,
    nextState: {
      ...existingState,
      scheduledReminders: nextScheduledReminders,
    },
  };
}

export function markLateReminderDelivered(existingState, sessionId, deliveredAt = new Date().toISOString()) {
  return {
    ...existingState,
    deliveredLateReminders: {
      ...existingState.deliveredLateReminders,
      [String(sessionId)]: deliveredAt,
    },
  };
}

export function hasDeliveredLateReminder(existingState, sessionId) {
  return Boolean(existingState.deliveredLateReminders?.[String(sessionId)]);
}

export function clearSessionNotificationState(existingState, sessionId) {
  const nextScheduledReminders = { ...(existingState.scheduledReminders ?? {}) };
  delete nextScheduledReminders[buildReminderKey(sessionId, 'pre')];
  delete nextScheduledReminders[buildReminderKey(sessionId, 'start')];

  const nextDeliveredLateReminders = { ...(existingState.deliveredLateReminders ?? {}) };
  delete nextDeliveredLateReminders[String(sessionId)];

  return {
    ...existingState,
    scheduledReminders: nextScheduledReminders,
    deliveredLateReminders: nextDeliveredLateReminders,
  };
}

export async function createNotificationStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return {
      async getItem(key) {
        return window.localStorage.getItem(key);
      },
      async setItem(key, value) {
        window.localStorage.setItem(key, value);
      },
      async removeItem(key) {
        window.localStorage.removeItem(key);
      },
    };
  }

  const module = await import('@react-native-async-storage/async-storage');
  return module.default;
}

export async function loadNotificationState(storage) {
  const raw = await storage.getItem(NOTIFICATION_STATE_KEY);
  if (!raw) {
    return createEmptyNotificationState();
  }
  try {
    return { ...createEmptyNotificationState(), ...JSON.parse(raw) };
  } catch {
    return createEmptyNotificationState();
  }
}

export async function saveNotificationState(storage, state) {
  await storage.setItem(NOTIFICATION_STATE_KEY, JSON.stringify(state));
  return state;
}

export async function loadDisplayName(storage, fallback = 'Operator') {
  const stored = await storage.getItem(DISPLAY_NAME_KEY);
  return stored || fallback;
}


export async function resetLocalAppState(storage) {
  const resolvedStorage = storage ?? await createNotificationStorage();
  for (const key of LOCAL_APP_STATE_KEYS) {
    await resolvedStorage.removeItem(key);
  }
  return createEmptyNotificationState();
}
