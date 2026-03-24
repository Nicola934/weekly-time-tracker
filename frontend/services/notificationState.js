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
  const desiredMap = Object.fromEntries(
    desiredReminders.map((r) => [buildReminderKey(r.sessionId, r.eventType), r])
  );

  const toSchedule = [];
  const toCancel = [];
  const nextScheduledReminders = {};
  const scheduledKeys = new Set();

  for (const [key, existing] of Object.entries(existingState.scheduledReminders || {})) {
    const desired = desiredMap[key];

    if (!desired) {
      toCancel.push(existing);
      continue;
    }

    if (existing.triggerAt !== desired.triggerAt) {
      toCancel.push(existing);
      toSchedule.push(desired);
      scheduledKeys.add(key);
      continue;
    }

    nextScheduledReminders[key] = existing;
    scheduledKeys.add(key);
  }

  for (const [key, desired] of Object.entries(desiredMap)) {
    if (!scheduledKeys.has(key)) {
      toSchedule.push(desired);
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

export function markLateReminderDelivered(state, sessionId, deliveredAt = new Date().toISOString()) {
  return {
    ...state,
    deliveredLateReminders: {
      ...state.deliveredLateReminders,
      [String(sessionId)]: deliveredAt,
    },
  };
}

export function hasDeliveredLateReminder(state, sessionId) {
  return Boolean(state.deliveredLateReminders?.[String(sessionId)]);
}

export function clearSessionNotificationState(state, sessionId) {
  const nextScheduled = { ...(state.scheduledReminders || {}) };
  delete nextScheduled[buildReminderKey(sessionId, 'pre')];
  delete nextScheduled[buildReminderKey(sessionId, 'start')];

  const nextLate = { ...(state.deliveredLateReminders || {}) };
  delete nextLate[String(sessionId)];

  return {
    ...state,
    scheduledReminders: nextScheduled,
    deliveredLateReminders: nextLate,
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

  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;

  return AsyncStorage;
}

export async function loadNotificationState(storage) {
  const raw = await storage.getItem(NOTIFICATION_STATE_KEY);

  if (!raw) return createEmptyNotificationState();

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
  const resolved = storage ?? await createNotificationStorage();

  for (const key of LOCAL_APP_STATE_KEYS) {
    await resolved.removeItem(key);
  }

  return createEmptyNotificationState();
}