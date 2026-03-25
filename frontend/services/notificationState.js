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
  const desiredMap = Object.fromEntries(
    desiredReminders.map((r) => [buildReminderKey(r.sessionId, r.eventType), r])
  );

=======
  const desiredMap = Object.fromEntries(desiredReminders.map((reminder) => [buildReminderKey(reminder.sessionId, reminder.eventType), reminder]));
>>>>>>> theirs
=======
  const desiredMap = Object.fromEntries(desiredReminders.map((reminder) => [buildReminderKey(reminder.sessionId, reminder.eventType), reminder]));
>>>>>>> theirs
=======
  const desiredMap = Object.fromEntries(desiredReminders.map((reminder) => [buildReminderKey(reminder.sessionId, reminder.eventType), reminder]));
>>>>>>> theirs
=======
  const desiredMap = Object.fromEntries(desiredReminders.map((reminder) => [buildReminderKey(reminder.sessionId, reminder.eventType), reminder]));
>>>>>>> theirs
=======
  const desiredMap = Object.fromEntries(desiredReminders.map((reminder) => [buildReminderKey(reminder.sessionId, reminder.eventType), reminder]));
>>>>>>> theirs
=======
  const desiredMap = Object.fromEntries(desiredReminders.map((reminder) => [buildReminderKey(reminder.sessionId, reminder.eventType), reminder]));
>>>>>>> theirs
=======
  const desiredMap = Object.fromEntries(desiredReminders.map((reminder) => [buildReminderKey(reminder.sessionId, reminder.eventType), reminder]));
>>>>>>> theirs
=======
  const desiredMap = Object.fromEntries(desiredReminders.map((reminder) => [buildReminderKey(reminder.sessionId, reminder.eventType), reminder]));
>>>>>>> theirs
=======
  const desiredMap = Object.fromEntries(desiredReminders.map((reminder) => [buildReminderKey(reminder.sessionId, reminder.eventType), reminder]));
>>>>>>> theirs
=======
  const desiredMap = Object.fromEntries(desiredReminders.map((reminder) => [buildReminderKey(reminder.sessionId, reminder.eventType), reminder]));
>>>>>>> theirs
=======
  const desiredMap = Object.fromEntries(desiredReminders.map((reminder) => [buildReminderKey(reminder.sessionId, reminder.eventType), reminder]));
>>>>>>> theirs
=======
  const desiredMap = Object.fromEntries(desiredReminders.map((reminder) => [buildReminderKey(reminder.sessionId, reminder.eventType), reminder]));
>>>>>>> theirs
=======
  const desiredMap = Object.fromEntries(desiredReminders.map((reminder) => [buildReminderKey(reminder.sessionId, reminder.eventType), reminder]));
>>>>>>> theirs
  const toSchedule = [];
  const toCancel = [];
  const nextScheduledReminders = {};
  const scheduledKeys = new Set();

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
  for (const [key, existing] of Object.entries(existingState.scheduledReminders || {})) {
    const desired = desiredMap[key];

    if (!desired) {
      toCancel.push(existing);
      continue;
    }

    if (existing.triggerAt !== desired.triggerAt) {
      toCancel.push(existing);
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
  for (const [key, existingReminder] of Object.entries(existingState.scheduledReminders ?? {})) {
    const desired = desiredMap[key];
    if (!desired) {
      toCancel.push(existingReminder);
      continue;
    }
    if (existingReminder.triggerAt !== desired.triggerAt) {
      toCancel.push(existingReminder);
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
      toSchedule.push(desired);
      scheduledKeys.add(key);
      continue;
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

    nextScheduledReminders[key] = existing;
=======
    nextScheduledReminders[key] = existingReminder;
>>>>>>> theirs
=======
    nextScheduledReminders[key] = existingReminder;
>>>>>>> theirs
=======
    nextScheduledReminders[key] = existingReminder;
>>>>>>> theirs
=======
    nextScheduledReminders[key] = existingReminder;
>>>>>>> theirs
=======
    nextScheduledReminders[key] = existingReminder;
>>>>>>> theirs
=======
    nextScheduledReminders[key] = existingReminder;
>>>>>>> theirs
=======
    nextScheduledReminders[key] = existingReminder;
>>>>>>> theirs
=======
    nextScheduledReminders[key] = existingReminder;
>>>>>>> theirs
=======
    nextScheduledReminders[key] = existingReminder;
>>>>>>> theirs
=======
    nextScheduledReminders[key] = existingReminder;
>>>>>>> theirs
=======
    nextScheduledReminders[key] = existingReminder;
>>>>>>> theirs
=======
    nextScheduledReminders[key] = existingReminder;
>>>>>>> theirs
=======
    nextScheduledReminders[key] = existingReminder;
>>>>>>> theirs
    scheduledKeys.add(key);
  }

  for (const [key, desired] of Object.entries(desiredMap)) {
    if (!scheduledKeys.has(key)) {
      toSchedule.push(desired);
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
      scheduledKeys.add(key);
>>>>>>> theirs
=======
      scheduledKeys.add(key);
>>>>>>> theirs
=======
      scheduledKeys.add(key);
>>>>>>> theirs
=======
      scheduledKeys.add(key);
>>>>>>> theirs
=======
      scheduledKeys.add(key);
>>>>>>> theirs
=======
      scheduledKeys.add(key);
>>>>>>> theirs
=======
      scheduledKeys.add(key);
>>>>>>> theirs
=======
      scheduledKeys.add(key);
>>>>>>> theirs
=======
      scheduledKeys.add(key);
>>>>>>> theirs
=======
      scheduledKeys.add(key);
>>>>>>> theirs
=======
      scheduledKeys.add(key);
>>>>>>> theirs
=======
      scheduledKeys.add(key);
>>>>>>> theirs
=======
      scheduledKeys.add(key);
>>>>>>> theirs
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
export function markLateReminderDelivered(state, sessionId, deliveredAt = new Date().toISOString()) {
  return {
    ...state,
    deliveredLateReminders: {
      ...state.deliveredLateReminders,
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
export function markLateReminderDelivered(existingState, sessionId, deliveredAt = new Date().toISOString()) {
  return {
    ...existingState,
    deliveredLateReminders: {
      ...existingState.deliveredLateReminders,
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
      [String(sessionId)]: deliveredAt,
    },
  };
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
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;

  return AsyncStorage;
=======
  const module = await import('@react-native-async-storage/async-storage');
  return module.default;
>>>>>>> theirs
=======
  const module = await import('@react-native-async-storage/async-storage');
  return module.default;
>>>>>>> theirs
=======
  const module = await import('@react-native-async-storage/async-storage');
  return module.default;
>>>>>>> theirs
=======
  const module = await import('@react-native-async-storage/async-storage');
  return module.default;
>>>>>>> theirs
=======
  const module = await import('@react-native-async-storage/async-storage');
  return module.default;
>>>>>>> theirs
=======
  const module = await import('@react-native-async-storage/async-storage');
  return module.default;
>>>>>>> theirs
=======
  const module = await import('@react-native-async-storage/async-storage');
  return module.default;
>>>>>>> theirs
=======
  const module = await import('@react-native-async-storage/async-storage');
  return module.default;
>>>>>>> theirs
=======
  const module = await import('@react-native-async-storage/async-storage');
  return module.default;
>>>>>>> theirs
=======
  const module = await import('@react-native-async-storage/async-storage');
  return module.default;
>>>>>>> theirs
=======
  const module = await import('@react-native-async-storage/async-storage');
  return module.default;
>>>>>>> theirs
=======
  const module = await import('@react-native-async-storage/async-storage');
  return module.default;
>>>>>>> theirs
=======
  const module = await import('@react-native-async-storage/async-storage');
  return module.default;
>>>>>>> theirs
}

export async function loadNotificationState(storage) {
  const raw = await storage.getItem(NOTIFICATION_STATE_KEY);
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

  if (!raw) return createEmptyNotificationState();

=======
  if (!raw) {
    return createEmptyNotificationState();
  }
>>>>>>> theirs
=======
  if (!raw) {
    return createEmptyNotificationState();
  }
>>>>>>> theirs
=======
  if (!raw) {
    return createEmptyNotificationState();
  }
>>>>>>> theirs
=======
  if (!raw) {
    return createEmptyNotificationState();
  }
>>>>>>> theirs
=======
  if (!raw) {
    return createEmptyNotificationState();
  }
>>>>>>> theirs
=======
  if (!raw) {
    return createEmptyNotificationState();
  }
>>>>>>> theirs
=======
  if (!raw) {
    return createEmptyNotificationState();
  }
>>>>>>> theirs
=======
  if (!raw) {
    return createEmptyNotificationState();
  }
>>>>>>> theirs
=======
  if (!raw) {
    return createEmptyNotificationState();
  }
>>>>>>> theirs
=======
  if (!raw) {
    return createEmptyNotificationState();
  }
>>>>>>> theirs
=======
  if (!raw) {
    return createEmptyNotificationState();
  }
>>>>>>> theirs
=======
  if (!raw) {
    return createEmptyNotificationState();
  }
>>>>>>> theirs
=======
  if (!raw) {
    return createEmptyNotificationState();
  }
>>>>>>> theirs
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
export async function resetLocalAppState(storage) {
  const resolved = storage ?? await createNotificationStorage();

  for (const key of LOCAL_APP_STATE_KEYS) {
    await resolved.removeItem(key);
  }

  return createEmptyNotificationState();
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

export async function resetLocalAppState(storage) {
  const resolvedStorage = storage ?? await createNotificationStorage();
  for (const key of LOCAL_APP_STATE_KEYS) {
    await resolvedStorage.removeItem(key);
  }
  return createEmptyNotificationState();
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
