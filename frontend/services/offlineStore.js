import { createNotificationStorage } from './notificationState.js';

const OFFLINE_CACHE_PREFIX = 'weekly_execution_cache_v1';
const OFFLINE_QUEUE_PREFIX = 'weekly_execution_queue_v1';

function cacheKey(userId) {
  return `${OFFLINE_CACHE_PREFIX}:${userId}`;
}

function queueKey(userId) {
  return `${OFFLINE_QUEUE_PREFIX}:${userId}`;
}

export function createTemporaryId() {
  return -Math.floor(Date.now() + Math.random() * 10_000);
}

export function createEmptyOfflineSnapshot() {
  return {
    tasks: [],
    sessions: [],
    config: null,
    goalSettings: null,
    lastSyncedAt: null,
  };
}

async function readJson(storage, key, fallbackValue) {
  const raw = await storage.getItem(key);
  if (!raw) {
    return fallbackValue;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return fallbackValue;
  }
}

async function writeJson(storage, key, value) {
  await storage.setItem(key, JSON.stringify(value));
  return value;
}

function resolveNumericId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function replaceById(items, nextItem) {
  const nextId = resolveNumericId(nextItem?.id);
  if (nextId === null) {
    return items;
  }

  const index = items.findIndex((item) => resolveNumericId(item?.id) === nextId);
  if (index < 0) {
    return [...items, nextItem];
  }

  return items.map((item, itemIndex) => (itemIndex === index ? nextItem : item));
}

function resolveMappedId(value, mapping, label) {
  const resolvedValue = resolveNumericId(value);
  if (resolvedValue === null) {
    throw new Error(`${label} is missing`);
  }

  if (resolvedValue > 0) {
    return resolvedValue;
  }

  const mappedValue = mapping.get(resolvedValue);
  if (!mappedValue) {
    throw new Error(`${label} ${resolvedValue} has not synced yet`);
  }

  return mappedValue;
}

export function buildOfflineTask(taskPayload, localTaskId = createTemporaryId()) {
  return {
    id: localTaskId,
    title: String(taskPayload?.title || '').trim(),
    objective: String(taskPayload?.objective || '').trim(),
    category: String(taskPayload?.category || '').trim(),
    long_term_goal: String(taskPayload?.long_term_goal || '').trim(),
    priority: Number.isFinite(Number(taskPayload?.priority))
      ? Number(taskPayload.priority)
      : 3,
    estimated_hours: Number.isFinite(Number(taskPayload?.estimated_hours))
      ? Number(taskPayload.estimated_hours)
      : 0,
    created_at: new Date().toISOString(),
    is_local_only: true,
  };
}

export function buildOfflineSession(
  schedulePayload,
  selectedTask,
  localSessionId = createTemporaryId(),
) {
  return {
    id: localSessionId,
    task_id: resolveNumericId(schedulePayload?.task_id),
    planned_start: schedulePayload?.start_time,
    planned_end: schedulePayload?.end_time,
    reminder_offset_minutes:
      schedulePayload?.reminder_offset_minutes ?? null,
    actual_start: null,
    actual_end: null,
    completion_percent: 0,
    status: 'planned',
    objective: String(schedulePayload?.notes || '').trim() || null,
    goal_context: schedulePayload?.goal_context ?? null,
    objective_completed: false,
    objective_locked: false,
    reflection_notes: '',
    failure_reason: null,
    failure_reason_detail: null,
    distraction_category: null,
    start_delta_minutes: null,
    quality_score: 0,
    quality_label: 'failed',
    timezone: schedulePayload?.timezone || 'UTC',
    output_notes: String(schedulePayload?.notes || '').trim(),
    is_local_only: true,
    local_task_title: selectedTask?.title ?? '',
  };
}

export function applyOfflineSessionUpdate(existingSession, payload) {
  if (!existingSession) {
    return existingSession;
  }

  return {
    ...existingSession,
    task_id: resolveNumericId(payload?.task_id) ?? existingSession.task_id,
    planned_start: payload?.start_time ?? existingSession.planned_start,
    planned_end: payload?.end_time ?? existingSession.planned_end,
    reminder_offset_minutes:
      payload?.reminder_offset_minutes ?? existingSession.reminder_offset_minutes,
    objective: String(payload?.notes || '').trim() || null,
    goal_context: payload?.goal_context ?? existingSession.goal_context ?? null,
    output_notes: String(payload?.notes || '').trim(),
    timezone: payload?.timezone || existingSession.timezone || 'UTC',
  };
}

export function applyOfflineSessionStart(existingSession, payload) {
  if (!existingSession) {
    return existingSession;
  }

  return {
    ...existingSession,
    actual_start: payload?.actual_start ?? new Date().toISOString(),
    status: 'active',
  };
}

export function applyOfflineSessionEnd(existingSession, payload) {
  if (!existingSession) {
    return existingSession;
  }

  return {
    ...existingSession,
    actual_end: payload?.actual_end ?? new Date().toISOString(),
    status: 'completed',
    objective_completed: Boolean(payload?.objective_completed),
    objective_locked: true,
    completion_percent: Number.isFinite(Number(payload?.completion_percent))
      ? Number(payload.completion_percent)
      : existingSession.completion_percent ?? 0,
    output_notes: String(payload?.output_notes || '').trim(),
    reflection_notes: String(payload?.reflection_notes || '').trim(),
    failure_reason: payload?.failure_reason ?? null,
    failure_reason_detail: payload?.failure_reason_detail ?? null,
    distraction_category: payload?.distraction_category ?? null,
  };
}

export function applyOfflineSessionMissed(existingSession) {
  if (!existingSession) {
    return existingSession;
  }

  return {
    ...existingSession,
    status: 'missed',
    objective_completed: false,
    objective_locked: true,
    quality_score: 0,
    quality_label: 'failed',
  };
}

export async function loadOfflineSnapshot(userId) {
  const storage = await createNotificationStorage();
  return readJson(storage, cacheKey(userId), createEmptyOfflineSnapshot());
}

export async function saveOfflineSnapshot(userId, snapshot) {
  const storage = await createNotificationStorage();
  return writeJson(storage, cacheKey(userId), snapshot);
}

export async function loadOfflineQueue(userId) {
  const storage = await createNotificationStorage();
  return readJson(storage, queueKey(userId), []);
}

export async function enqueueOfflineOperation(userId, operation) {
  const storage = await createNotificationStorage();
  const currentQueue = await readJson(storage, queueKey(userId), []);
  const nextQueue = [
    ...currentQueue,
    {
      ...operation,
      createdAt: new Date().toISOString(),
    },
  ];
  await writeJson(storage, queueKey(userId), nextQueue);
  return nextQueue;
}

export async function replaceOfflineQueue(userId, nextQueue) {
  const storage = await createNotificationStorage();
  return writeJson(storage, queueKey(userId), nextQueue);
}

export async function getPendingOperationCount(userId) {
  const queue = await loadOfflineQueue(userId);
  return queue.length;
}

export async function flushOfflineQueue(userId, api) {
  const currentQueue = await loadOfflineQueue(userId);
  if (currentQueue.length === 0) {
    return { flushed: 0, remaining: 0 };
  }

  const taskIdMap = new Map();
  const sessionIdMap = new Map();
  let processedCount = 0;

  for (const operation of currentQueue) {
    if (operation.type === 'createTask') {
      const createdTask = await api.createTask(operation.payload);
      if (resolveNumericId(operation.localTaskId) < 0 && createdTask?.id) {
        taskIdMap.set(Number(operation.localTaskId), Number(createdTask.id));
      }
      processedCount += 1;
      continue;
    }

    if (operation.type === 'createSchedule') {
      const createdSchedule = await api.createSchedule({
        ...operation.payload,
        task_id: resolveMappedId(operation.payload?.task_id, taskIdMap, 'Task'),
      });
      const syncedSessionId = resolveNumericId(
        createdSchedule?.session_id ?? createdSchedule?.session?.id,
      );
      if (resolveNumericId(operation.localSessionId) < 0 && syncedSessionId) {
        sessionIdMap.set(Number(operation.localSessionId), syncedSessionId);
      }
      processedCount += 1;
      continue;
    }

    if (operation.type === 'updateSession') {
      await api.updateSession(
        resolveMappedId(operation.sessionId, sessionIdMap, 'Session'),
        {
          ...operation.payload,
          task_id: resolveMappedId(operation.payload?.task_id, taskIdMap, 'Task'),
        },
      );
      processedCount += 1;
      continue;
    }

    if (operation.type === 'deleteSession') {
      await api.deleteSession(resolveMappedId(operation.sessionId, sessionIdMap, 'Session'));
      processedCount += 1;
      continue;
    }

    if (operation.type === 'startSession') {
      await api.startSession({
        ...operation.payload,
        task_id: resolveMappedId(operation.payload?.task_id, taskIdMap, 'Task'),
        session_id: resolveMappedId(operation.payload?.session_id, sessionIdMap, 'Session'),
      });
      processedCount += 1;
      continue;
    }

    if (operation.type === 'endSession') {
      await api.endSession({
        ...operation.payload,
        session_id: resolveMappedId(operation.payload?.session_id, sessionIdMap, 'Session'),
      });
      processedCount += 1;
      continue;
    }

    if (operation.type === 'markSessionMissed') {
      await api.markSessionMissed({
        ...operation.payload,
        session_id: resolveMappedId(operation.payload?.session_id, sessionIdMap, 'Session'),
      });
      processedCount += 1;
      continue;
    }

    throw new Error(`Unsupported offline operation: ${operation.type}`);
  }

  if (processedCount > 0) {
    await replaceOfflineQueue(userId, currentQueue.slice(processedCount));
  }

  return {
    flushed: processedCount,
    remaining: Math.max(currentQueue.length - processedCount, 0),
  };
}

export function upsertTaskCollection(tasks, task) {
  return replaceById(tasks, task);
}

export function upsertSessionCollection(sessions, session) {
  return replaceById(sessions, session);
}
