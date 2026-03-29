import AsyncStorage from '@react-native-async-storage/async-storage';

export const NOTIFICATION_STATE_KEY = 'weekly_execution_notification_state';
export const DISPLAY_NAME_KEY = 'weekly_execution_display_name';
export const LOCAL_APP_STATE_KEYS = [NOTIFICATION_STATE_KEY, DISPLAY_NAME_KEY];
const NOTIFICATION_STATE_LOG_PREFIX = '[notificationState]';
let inMemoryNotificationStorage = null;

function logNotificationStateInfo(message, details) {
  if (details) {
    console.info(`${NOTIFICATION_STATE_LOG_PREFIX} ${message}`, details);
    return;
  }

  console.info(`${NOTIFICATION_STATE_LOG_PREFIX} ${message}`);
}

function logNotificationStateError(message, error, details) {
  if (details) {
    console.error(`${NOTIFICATION_STATE_LOG_PREFIX} ${message}`, details, error);
    return;
  }

  console.error(`${NOTIFICATION_STATE_LOG_PREFIX} ${message}`, error);
}

function getInMemoryNotificationStorage() {
  if (inMemoryNotificationStorage) {
    return inMemoryNotificationStorage;
  }

  const store = new Map();
  inMemoryNotificationStorage = {
    async getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async setItem(key, value) {
      store.set(key, value);
    },
    async removeItem(key) {
      store.delete(key);
    },
  };
  return inMemoryNotificationStorage;
}

function normalizeLateReminderRecord(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return {
      deliveredAt: value,
      latenessMinutes: 0,
    };
  }

  if (typeof value !== 'object') {
    return null;
  }

  return {
    deliveredAt:
      typeof value.deliveredAt === 'string'
        ? value.deliveredAt
        : new Date().toISOString(),
    latenessMinutes: Number.isFinite(Number(value.latenessMinutes))
      ? Number(value.latenessMinutes)
      : 0,
  };
}

function normalizeDeliveredLateReminders(deliveredLateReminders) {
  const normalized = {};

  for (const [sessionId, value] of Object.entries(deliveredLateReminders || {})) {
    const record = normalizeLateReminderRecord(value);
    if (record) {
      normalized[String(sessionId)] = record;
    }
  }

  return normalized;
}

export function createEmptyNotificationState() {
  return {
    scheduledReminders: {},
    deliveredLateReminders: {},
  };
}

export function buildReminderKey(sessionId, reminderType) {
  return `${sessionId}:${reminderType}`;
}

export function getLateReminderRecord(existingState, sessionId) {
  return (
    normalizeLateReminderRecord(
      existingState.deliveredLateReminders?.[String(sessionId)],
    ) ?? null
  );
}

export function clearScheduledReminder(existingState, sessionId, reminderType) {
  const nextScheduledReminders = { ...(existingState.scheduledReminders ?? {}) };
  delete nextScheduledReminders[buildReminderKey(sessionId, reminderType)];

  return {
    ...existingState,
    scheduledReminders: nextScheduledReminders,
  };
}

export function reconcileStoredReminders(existingState, desiredReminders) {
  const desiredMap = Object.fromEntries(
    desiredReminders.map((reminder) => [
      buildReminderKey(reminder.sessionId, reminder.eventType),
      reminder,
    ]),
  );
  const toSchedule = [];
  const toCancel = [];
  const nextScheduledReminders = {};
  const scheduledKeys = new Set();

  for (const [key, existingReminder] of Object.entries(
    existingState.scheduledReminders ?? {},
  )) {
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

export function markLateReminderDelivered(
  existingState,
  sessionId,
  deliveredAt = new Date().toISOString(),
  latenessMinutes = 0,
) {
  return {
    ...existingState,
    deliveredLateReminders: {
      ...normalizeDeliveredLateReminders(existingState.deliveredLateReminders),
      [String(sessionId)]: {
        deliveredAt,
        latenessMinutes,
      },
    },
  };
}

export function hasDeliveredLateReminder(
  existingState,
  sessionId,
  latenessMinutes = null,
) {
  const record = getLateReminderRecord(existingState, sessionId);
  if (!record) {
    return false;
  }

  if (!Number.isFinite(Number(latenessMinutes))) {
    return true;
  }

  return Number(record.latenessMinutes || 0) >= Number(latenessMinutes);
}

export function pruneInactiveLateReminders(
  existingState,
  sessions,
  now = new Date(),
) {
  const activeLateSessionIds = new Set(
    (sessions || [])
      .filter((session) => {
        const status = String(session?.status ?? 'planned').toLowerCase();
        if (status !== 'planned') {
          return false;
        }

        const plannedEnd = new Date(session.plannedEnd);
        return plannedEnd.getTime() > now.getTime();
      })
      .map((session) => String(session.id)),
  );

  const nextDeliveredLateReminders = {};
  for (const [sessionId, value] of Object.entries(
    normalizeDeliveredLateReminders(existingState.deliveredLateReminders),
  )) {
    if (activeLateSessionIds.has(String(sessionId))) {
      nextDeliveredLateReminders[String(sessionId)] = value;
    }
  }

  return {
    ...existingState,
    deliveredLateReminders: nextDeliveredLateReminders,
  };
}

export function clearSessionNotificationState(existingState, sessionId) {
  const clearedPreReminder = clearScheduledReminder(existingState, sessionId, 'pre');
  const clearedScheduledReminders = clearScheduledReminder(
    clearedPreReminder,
    sessionId,
    'start',
  );

  const nextDeliveredLateReminders = normalizeDeliveredLateReminders(
    existingState.deliveredLateReminders,
  );
  delete nextDeliveredLateReminders[String(sessionId)];

  return {
    ...clearedScheduledReminders,
    deliveredLateReminders: nextDeliveredLateReminders,
  };
}

export async function createNotificationStorage() {
  try {
    if (typeof window !== 'undefined') {
      const localStorageRef = window.localStorage;
      if (localStorageRef) {
        const probeKey = '__weekly_execution_storage_probe__';
        localStorageRef.setItem(probeKey, '1');
        localStorageRef.removeItem(probeKey);
        logNotificationStateInfo('storage/bootstrap logic', {
          backend: 'localStorage',
        });
        return {
          async getItem(key) {
            return localStorageRef.getItem(key);
          },
          async setItem(key, value) {
            localStorageRef.setItem(key, value);
          },
          async removeItem(key) {
            localStorageRef.removeItem(key);
          },
        };
      }
    }
  } catch (nextError) {
    logNotificationStateError('localStorage unavailable', nextError);
  }

  if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
    logNotificationStateInfo('storage/bootstrap logic', {
      backend: 'async-storage',
    });
    return AsyncStorage;
  }

  logNotificationStateInfo('storage/bootstrap logic fallback', {
    backend: 'memory',
  });
  return getInMemoryNotificationStorage();
}

export async function loadNotificationState(storage) {
  const raw = await storage.getItem(NOTIFICATION_STATE_KEY);

  if (!raw) {
    return createEmptyNotificationState();
  }

  try {
    const parsed = { ...createEmptyNotificationState(), ...JSON.parse(raw) };
    return {
      ...parsed,
      deliveredLateReminders: normalizeDeliveredLateReminders(
        parsed.deliveredLateReminders,
      ),
    };
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
  const resolvedStorage = storage ?? (await createNotificationStorage());

  for (const key of LOCAL_APP_STATE_KEYS) {
    await resolvedStorage.removeItem(key);
  }

  return createEmptyNotificationState();
}
