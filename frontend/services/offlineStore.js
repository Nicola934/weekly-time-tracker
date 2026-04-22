import { createNotificationStorage } from './notificationState.js';

const OFFLINE_CACHE_PREFIX = 'weekly_execution_cache_v1';
const OFFLINE_QUEUE_PREFIX = 'weekly_execution_queue_v1';

export const SYNC_STATE_SYNCED = 'synced';
export const SYNC_STATE_PENDING = 'pending_sync';
export const SYNC_STATE_FAILED = 'sync_failed';

function cacheKey(userId) {
  return `${OFFLINE_CACHE_PREFIX}:${userId}`;
}

function queueKey(userId) {
  return `${OFFLINE_QUEUE_PREFIX}:${userId}`;
}

function nowIso() {
  return new Date().toISOString();
}

export function normalizeEntityId(value) {
  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) ? parsedValue : null;
}

function normalizePositiveId(value) {
  const parsedValue = normalizeEntityId(value);
  return parsedValue !== null && parsedValue > 0 ? parsedValue : null;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePendingOperationTypes(existingEntity, nextTypes = []) {
  const currentTypes = Array.isArray(existingEntity?.pending_operation_types)
    ? existingEntity.pending_operation_types
    : Array.isArray(existingEntity?.pendingOperationTypes)
      ? existingEntity.pendingOperationTypes
      : [];

  return Array.from(
    new Set(
      [...currentTypes, ...nextTypes]
        .map((item) => String(item || '').trim())
        .filter(Boolean),
    ),
  );
}

function withEntitySyncState(
  entity,
  {
    syncState = SYNC_STATE_SYNCED,
    pendingOperationTypes = [],
    syncError = null,
    isLocalOnly = Boolean(entity?.is_local_only),
    localDeleted = Boolean(entity?.local_deleted),
  } = {},
) {
  if (!entity || typeof entity !== 'object') {
    return entity;
  }

  return {
    ...entity,
    sync_state: syncState,
    pending_operation_types: normalizePendingOperationTypes(
      entity,
      pendingOperationTypes,
    ),
    sync_error:
      typeof syncError === 'string' && syncError.trim() ? syncError.trim() : null,
    is_local_only: Boolean(isLocalOnly),
    local_deleted: Boolean(localDeleted),
    local_updated_at: nowIso(),
  };
}

export function clearEntitySyncState(entity) {
  if (!entity || typeof entity !== 'object') {
    return entity;
  }

  return {
    ...entity,
    sync_state: SYNC_STATE_SYNCED,
    pending_operation_types: [],
    sync_error: null,
    is_local_only: false,
    local_deleted: false,
  };
}

export function markEntitySyncFailed(entity, operationType, error) {
  return withEntitySyncState(entity, {
    syncState: SYNC_STATE_FAILED,
    pendingOperationTypes: [operationType],
    syncError:
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Sync failed',
    isLocalOnly: Boolean(entity?.is_local_only),
    localDeleted: Boolean(entity?.local_deleted),
  });
}

export function markTaskPendingSync(task, operationType = 'createTask') {
  return withEntitySyncState(task, {
    syncState: SYNC_STATE_PENDING,
    pendingOperationTypes: [operationType],
    isLocalOnly: true,
  });
}

export function markSessionPendingSync(
  session,
  operationType,
  { localDeleted = Boolean(session?.local_deleted) } = {},
) {
  return withEntitySyncState(session, {
    syncState: SYNC_STATE_PENDING,
    pendingOperationTypes: [operationType],
    isLocalOnly:
      Boolean(session?.is_local_only) ||
      normalizeEntityId(session?.id) !== null && Number(session.id) < 0,
    localDeleted,
  });
}

export function markSessionPendingDelete(session) {
  return markSessionPendingSync(
    {
      ...session,
      status: 'cancelled',
    },
    'deleteSession',
    { localDeleted: true },
  );
}

function replaceById(items, nextItem, previousIds = []) {
  const nextId = normalizeEntityId(nextItem?.id);
  const candidateIds = new Set(
    [...previousIds, nextId]
      .map((value) => normalizeEntityId(value))
      .filter((value) => value !== null),
  );

  if (candidateIds.size === 0) {
    return items;
  }

  const nextItems = [];
  let replaced = false;

  for (const item of items) {
    const itemId = normalizeEntityId(item?.id);
    if (itemId !== null && candidateIds.has(itemId)) {
      if (!replaced) {
        nextItems.push(nextItem);
        replaced = true;
      }
      continue;
    }

    nextItems.push(item);
  }

  if (!replaced) {
    nextItems.push(nextItem);
  }

  return nextItems;
}

function removeById(items, idsToRemove) {
  const candidateIds = new Set(
    idsToRemove
      .map((value) => normalizeEntityId(value))
      .filter((value) => value !== null),
  );

  if (candidateIds.size === 0) {
    return items;
  }

  return items.filter((item) => {
    const itemId = normalizeEntityId(item?.id);
    return itemId === null || !candidateIds.has(itemId);
  });
}

function sortSessions(sessions) {
  return [...sessions].sort((left, right) => {
    const leftTime = new Date(left?.planned_start ?? left?.plannedStart ?? 0).getTime();
    const rightTime = new Date(right?.planned_start ?? right?.plannedStart ?? 0).getTime();
    return leftTime - rightTime;
  });
}

function createQueueOperation(operation) {
  return {
    ...operation,
    createdAt: operation?.createdAt ?? nowIso(),
    attemptCount: Number.isFinite(Number(operation?.attemptCount))
      ? Number(operation.attemptCount)
      : 0,
    lastAttemptAt:
      typeof operation?.lastAttemptAt === 'string' ? operation.lastAttemptAt : null,
    lastError:
      typeof operation?.lastError === 'string' && operation.lastError.trim()
        ? operation.lastError.trim()
        : null,
    syncState:
      String(operation?.syncState || SYNC_STATE_PENDING).toLowerCase() ===
      SYNC_STATE_FAILED
        ? SYNC_STATE_FAILED
        : SYNC_STATE_PENDING,
  };
}

function normalizeErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }

  return 'Sync failed';
}

function remapId(value, mapping) {
  const normalizedValue = normalizeEntityId(value);
  if (normalizedValue === null || normalizedValue > 0) {
    return value;
  }

  return mapping.get(normalizedValue) ?? value;
}

function remapOperationIdentifiers(operation, taskIdMap, sessionIdMap) {
  const nextOperation = {
    ...operation,
    payload:
      operation?.payload && typeof operation.payload === 'object'
        ? { ...operation.payload }
        : operation?.payload,
  };

  if (nextOperation.type === 'createSchedule') {
    if (nextOperation.payload) {
      nextOperation.payload.task_id = remapId(nextOperation.payload.task_id, taskIdMap);
    }
    return nextOperation;
  }

  if (nextOperation.type === 'updateSession') {
    nextOperation.sessionId = remapId(nextOperation.sessionId, sessionIdMap);
    if (nextOperation.payload) {
      nextOperation.payload.task_id = remapId(nextOperation.payload.task_id, taskIdMap);
    }
    return nextOperation;
  }

  if (nextOperation.type === 'deleteSession') {
    nextOperation.sessionId = remapId(nextOperation.sessionId, sessionIdMap);
    return nextOperation;
  }

  if (
    nextOperation.type === 'startSession' ||
    nextOperation.type === 'endSession' ||
    nextOperation.type === 'markSessionMissed'
  ) {
    if (nextOperation.payload) {
      nextOperation.payload.session_id = remapId(
        nextOperation.payload.session_id,
        sessionIdMap,
      );
      if (Object.hasOwn(nextOperation.payload, 'task_id')) {
        nextOperation.payload.task_id = remapId(
          nextOperation.payload.task_id,
          taskIdMap,
        );
      }
    }
    return nextOperation;
  }

  return nextOperation;
}

function remapQueueIdentifiers(queue, taskIdMap, sessionIdMap) {
  return queue.map((operation) =>
    createQueueOperation(
      remapOperationIdentifiers(operation, taskIdMap, sessionIdMap),
    ),
  );
}

function resolveMappedId(value, mapping, label) {
  const resolvedValue = normalizeEntityId(value);
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

function buildOperationResultSummary(operation, result, taskIdMap, sessionIdMap) {
  return {
    type: operation.type,
    localTaskId: normalizeEntityId(operation.localTaskId),
    localSessionId: normalizeEntityId(operation.localSessionId),
    resolvedTaskId:
      operation.type === 'createTask'
        ? normalizePositiveId(result?.id)
        : normalizeEntityId(
            operation?.payload?.task_id ??
              remapId(operation?.payload?.task_id, taskIdMap),
          ),
    resolvedSessionId:
      operation.type === 'createSchedule'
        ? normalizePositiveId(result?.session?.id ?? result?.session_id)
        : normalizeEntityId(
            operation?.payload?.session_id ??
              operation?.sessionId ??
              remapId(
                operation?.payload?.session_id ?? operation?.sessionId,
                sessionIdMap,
              ),
          ),
    result,
  };
}

function resolveCreatedScheduleSession(existingSession, operationSummary) {
  const mappedSessionId = normalizePositiveId(
    operationSummary?.result?.session?.id ?? operationSummary?.result?.session_id,
  );
  const mappedTaskId = normalizePositiveId(operationSummary?.resolvedTaskId);
  const normalizedNotes = String(operationSummary?.result?.notes || '').trim();

  if (
    operationSummary?.result?.session &&
    typeof operationSummary.result.session === 'object'
  ) {
    return clearEntitySyncState({
      ...existingSession,
      ...operationSummary.result.session,
      id: mappedSessionId ?? operationSummary.result.session.id,
      task_id: mappedTaskId ?? operationSummary.result.session.task_id,
      local_task_title:
        operationSummary.result.session.local_task_title ??
        existingSession?.local_task_title ??
        existingSession?.localTaskTitle ??
        null,
    });
  }

  if (!existingSession || mappedSessionId === null) {
    return null;
  }

  return clearEntitySyncState({
    ...existingSession,
    id: mappedSessionId,
    task_id: mappedTaskId ?? existingSession.task_id,
    schedule_block_id:
      normalizePositiveId(
        operationSummary?.result?.schedule_block_id ?? operationSummary?.result?.id,
      ) ?? existingSession.schedule_block_id ?? null,
    planned_start:
      operationSummary?.result?.start_time ?? existingSession.planned_start,
    planned_end: operationSummary?.result?.end_time ?? existingSession.planned_end,
    reminder_offset_minutes:
      existingSession.reminder_offset_minutes ??
      operationSummary?.result?.reminder_offset_minutes ??
      null,
    objective:
      existingSession.objective ?? (normalizedNotes || null),
    goal_context:
      existingSession.goal_context ??
      operationSummary?.result?.goal_context ??
      null,
    output_notes: existingSession.output_notes ?? normalizedNotes,
    timezone: operationSummary?.result?.timezone ?? existingSession.timezone,
  });
}

function buildQueueEntityState(queue) {
  const taskState = new Map();
  const sessionState = new Map();

  const appendState = (stateMap, entityId, operation) => {
    const normalizedId = normalizeEntityId(entityId);
    if (normalizedId === null) {
      return;
    }

    const key = String(normalizedId);
    const current =
      stateMap.get(key) ?? {
        pendingOperationTypes: new Set(),
        syncState: SYNC_STATE_PENDING,
        syncError: null,
      };
    current.pendingOperationTypes.add(operation.type);
    if (
      String(operation?.syncState || '').toLowerCase() === SYNC_STATE_FAILED ||
      String(operation?.lastError || '').trim()
    ) {
      current.syncState = SYNC_STATE_FAILED;
      current.syncError = normalizeErrorMessage(operation?.lastError);
    }
    stateMap.set(key, current);
  };

  for (const operation of queue) {
    if (operation.type === 'createTask') {
      appendState(taskState, operation.localTaskId, operation);
      continue;
    }

    if (operation.type === 'createSchedule') {
      appendState(sessionState, operation.localSessionId, operation);
      continue;
    }

    if (operation.type === 'updateSession' || operation.type === 'deleteSession') {
      appendState(sessionState, operation.sessionId, operation);
      continue;
    }

    if (
      operation.type === 'startSession' ||
      operation.type === 'endSession' ||
      operation.type === 'markSessionMissed'
    ) {
      appendState(sessionState, operation?.payload?.session_id, operation);
    }
  }

  return { taskState, sessionState };
}

function applyQueueState(entity, queueState) {
  if (!entity || typeof entity !== 'object') {
    return entity;
  }

  if (!queueState) {
    return clearEntitySyncState(entity);
  }

  return {
    ...entity,
    sync_state: queueState.syncState,
    pending_operation_types: Array.from(queueState.pendingOperationTypes),
    sync_error: queueState.syncError,
  };
}

function mergeCollection(localItems, remoteItems, queueStateMap) {
  const localMap = new Map(
    normalizeArray(localItems)
      .map((item) => [normalizeEntityId(item?.id), item])
      .filter(([id]) => id !== null),
  );
  const merged = [];
  const seenIds = new Set();

  for (const remoteItem of normalizeArray(remoteItems)) {
    const remoteId = normalizeEntityId(remoteItem?.id);
    if (remoteId === null) {
      continue;
    }

    const localItem = localMap.get(remoteId) ?? null;
    const queueState = queueStateMap.get(String(remoteId));
    const shouldProtectLocal =
      Boolean(queueState) ||
      Boolean(localItem?.local_deleted) ||
      Boolean(localItem?.is_local_only) ||
      remoteId < 0;

    merged.push(
      applyQueueState(shouldProtectLocal && localItem ? localItem : remoteItem, queueState),
    );
    seenIds.add(remoteId);
  }

  for (const localItem of normalizeArray(localItems)) {
    const localId = normalizeEntityId(localItem?.id);
    if (localId === null || seenIds.has(localId)) {
      continue;
    }

    const queueState = queueStateMap.get(String(localId));
    if (
      queueState ||
      Boolean(localItem?.local_deleted) ||
      Boolean(localItem?.is_local_only) ||
      localId < 0
    ) {
      merged.push(applyQueueState(localItem, queueState));
    }
  }

  return merged;
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
    lastSeenSyncEventId: 0,
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

export function buildOfflineTask(taskPayload, localTaskId = createTemporaryId()) {
  return markTaskPendingSync({
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
    created_at: nowIso(),
  });
}

export function buildOfflineSession(
  schedulePayload,
  selectedTask,
  localSessionId = createTemporaryId(),
) {
  return markSessionPendingSync({
    id: localSessionId,
    task_id: normalizeEntityId(schedulePayload?.task_id),
    planned_start: schedulePayload?.start_time,
    planned_end: schedulePayload?.end_time,
    reminder_offset_minutes: schedulePayload?.reminder_offset_minutes ?? null,
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
    local_task_title: selectedTask?.title ?? '',
    local_task_category: selectedTask?.category ?? '',
  }, 'createSchedule');
}

export function applyOfflineSessionUpdate(existingSession, payload) {
  if (!existingSession) {
    return existingSession;
  }

  return {
    ...existingSession,
    task_id: normalizeEntityId(payload?.task_id) ?? existingSession.task_id,
    planned_start: payload?.start_time ?? existingSession.planned_start,
    planned_end: payload?.end_time ?? existingSession.planned_end,
    reminder_offset_minutes:
      payload?.reminder_offset_minutes ?? existingSession.reminder_offset_minutes,
    objective: String(payload?.notes || '').trim() || null,
    goal_context: payload?.goal_context ?? existingSession.goal_context ?? null,
    output_notes: String(payload?.notes || '').trim(),
    timezone: payload?.timezone || existingSession.timezone || 'UTC',
    local_task_title:
      payload?.local_task_title ?? existingSession.local_task_title ?? '',
    local_task_category:
      payload?.local_task_category ?? existingSession.local_task_category ?? '',
  };
}

export function applyOfflineSessionStart(existingSession, payload) {
  if (!existingSession) {
    return existingSession;
  }

  return {
    ...existingSession,
    actual_start: payload?.actual_start ?? nowIso(),
    status: 'active',
  };
}

export function applyOfflineSessionEnd(existingSession, payload) {
  if (!existingSession) {
    return existingSession;
  }

  return {
    ...existingSession,
    actual_end: payload?.actual_end ?? nowIso(),
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
  const snapshot = await readJson(
    storage,
    cacheKey(userId),
    createEmptyOfflineSnapshot(),
  );

  return {
    ...createEmptyOfflineSnapshot(),
    ...(snapshot && typeof snapshot === 'object' ? snapshot : {}),
    tasks: normalizeArray(snapshot?.tasks),
    sessions: sortSessions(normalizeArray(snapshot?.sessions)),
    lastSeenSyncEventId: Number.isFinite(Number(snapshot?.lastSeenSyncEventId))
      ? Number(snapshot.lastSeenSyncEventId)
      : 0,
  };
}

export async function saveOfflineSnapshot(userId, snapshot) {
  const storage = await createNotificationStorage();
  const nextSnapshot = {
    ...createEmptyOfflineSnapshot(),
    ...(snapshot && typeof snapshot === 'object' ? snapshot : {}),
    tasks: normalizeArray(snapshot?.tasks),
    sessions: sortSessions(normalizeArray(snapshot?.sessions)),
    lastSeenSyncEventId: Number.isFinite(Number(snapshot?.lastSeenSyncEventId))
      ? Number(snapshot.lastSeenSyncEventId)
      : 0,
  };
  return writeJson(storage, cacheKey(userId), nextSnapshot);
}

export async function loadOfflineQueue(userId) {
  const storage = await createNotificationStorage();
  const queue = await readJson(storage, queueKey(userId), []);
  return normalizeArray(queue).map((operation) => createQueueOperation(operation));
}

export async function enqueueOfflineOperation(userId, operation) {
  const storage = await createNotificationStorage();
  const currentQueue = await readJson(storage, queueKey(userId), []);
  const nextQueue = [...normalizeArray(currentQueue), createQueueOperation(operation)];
  await writeJson(storage, queueKey(userId), nextQueue);
  return nextQueue;
}

export async function replaceOfflineQueue(userId, nextQueue) {
  const storage = await createNotificationStorage();
  return writeJson(
    storage,
    queueKey(userId),
    normalizeArray(nextQueue).map((operation) => createQueueOperation(operation)),
  );
}

export async function getPendingOperationCount(userId) {
  const queue = await loadOfflineQueue(userId);
  return queue.length;
}

export async function flushOfflineQueue(userId, api) {
  let remainingQueue = await loadOfflineQueue(userId);
  if (remainingQueue.length === 0) {
    return {
      flushed: 0,
      remaining: 0,
      completedOperations: [],
      taskIdMap: {},
      sessionIdMap: {},
    };
  }

  const taskIdMap = new Map();
  const sessionIdMap = new Map();
  const completedOperations = [];

  while (remainingQueue.length > 0) {
    const rawOperation = createQueueOperation(remainingQueue[0]);
    const operation = remapOperationIdentifiers(rawOperation, taskIdMap, sessionIdMap);

    try {
      let result = null;

      if (operation.type === 'createTask') {
        result = await api.createTask(operation.payload);
        const syncedTaskId = normalizePositiveId(result?.id);
        if (normalizeEntityId(rawOperation.localTaskId) < 0 && syncedTaskId) {
          taskIdMap.set(Number(rawOperation.localTaskId), syncedTaskId);
        }
      } else if (operation.type === 'createSchedule') {
        result = await api.createSchedule({
          ...operation.payload,
          task_id: resolveMappedId(operation.payload?.task_id, taskIdMap, 'Task'),
        });
        const syncedSessionId = normalizePositiveId(
          result?.session?.id ?? result?.session_id,
        );
        if (normalizeEntityId(rawOperation.localSessionId) < 0 && syncedSessionId) {
          sessionIdMap.set(Number(rawOperation.localSessionId), syncedSessionId);
        }
      } else if (operation.type === 'updateSession') {
        result = await api.updateSession(
          resolveMappedId(operation.sessionId, sessionIdMap, 'Session'),
          {
            ...operation.payload,
            task_id: resolveMappedId(operation.payload?.task_id, taskIdMap, 'Task'),
          },
        );
      } else if (operation.type === 'deleteSession') {
        result = await api.deleteSession(
          resolveMappedId(operation.sessionId, sessionIdMap, 'Session'),
        );
      } else if (operation.type === 'startSession') {
        result = await api.startSession({
          ...operation.payload,
          task_id: resolveMappedId(operation.payload?.task_id, taskIdMap, 'Task'),
          session_id: resolveMappedId(
            operation.payload?.session_id,
            sessionIdMap,
            'Session',
          ),
        });
      } else if (operation.type === 'endSession') {
        result = await api.endSession({
          ...operation.payload,
          session_id: resolveMappedId(
            operation.payload?.session_id,
            sessionIdMap,
            'Session',
          ),
        });
      } else if (operation.type === 'markSessionMissed') {
        result = await api.markSessionMissed({
          ...operation.payload,
          session_id: resolveMappedId(
            operation.payload?.session_id,
            sessionIdMap,
            'Session',
          ),
        });
      } else {
        throw new Error(`Unsupported offline operation: ${operation.type}`);
      }

      completedOperations.push(
        buildOperationResultSummary(rawOperation, result, taskIdMap, sessionIdMap),
      );

      remainingQueue = remapQueueIdentifiers(
        remainingQueue.slice(1),
        taskIdMap,
        sessionIdMap,
      );
      await replaceOfflineQueue(userId, remainingQueue);
    } catch (error) {
      const failedOperation = createQueueOperation({
        ...rawOperation,
        attemptCount: Number(rawOperation.attemptCount || 0) + 1,
        lastAttemptAt: nowIso(),
        lastError: normalizeErrorMessage(error),
        syncState: SYNC_STATE_FAILED,
      });
      remainingQueue = [failedOperation, ...remainingQueue.slice(1)];
      await replaceOfflineQueue(userId, remainingQueue);
      throw error;
    }
  }

  return {
    flushed: completedOperations.length,
    remaining: remainingQueue.length,
    completedOperations,
    taskIdMap: Object.fromEntries(taskIdMap),
    sessionIdMap: Object.fromEntries(sessionIdMap),
  };
}

export function applyCompletedOperationsToSnapshot(snapshot, completedOperations) {
  const nextSnapshot = {
    ...createEmptyOfflineSnapshot(),
    ...(snapshot && typeof snapshot === 'object' ? snapshot : {}),
    tasks: normalizeArray(snapshot?.tasks),
    sessions: normalizeArray(snapshot?.sessions),
  };

  let nextTasks = [...nextSnapshot.tasks];
  let nextSessions = [...nextSnapshot.sessions];

  for (const operationSummary of normalizeArray(completedOperations)) {
    if (operationSummary.type === 'createTask') {
      const createdTask = clearEntitySyncState(operationSummary.result);
      nextTasks = upsertTaskCollection(
        nextTasks,
        createdTask,
        [operationSummary.localTaskId],
      );
      nextSessions = nextSessions.map((session) => {
        if (normalizeEntityId(session?.task_id) !== operationSummary.localTaskId) {
          return session;
        }

        return {
          ...session,
          task_id: operationSummary.resolvedTaskId ?? session.task_id,
        };
      });
      continue;
    }

    if (operationSummary.type === 'createSchedule') {
      const existingSession =
        nextSessions.find(
          (session) =>
            normalizeEntityId(session?.id) === operationSummary.localSessionId,
        ) ?? null;
      const createdSession = resolveCreatedScheduleSession(
        existingSession,
        operationSummary,
      );
      if (createdSession) {
        nextSessions = upsertSessionCollection(
          nextSessions,
          createdSession,
          [operationSummary.localSessionId],
        );
      }
      continue;
    }

    if (
      operationSummary.type === 'updateSession' ||
      operationSummary.type === 'startSession' ||
      operationSummary.type === 'endSession' ||
      operationSummary.type === 'markSessionMissed'
    ) {
      nextSessions = upsertSessionCollection(
        nextSessions,
        clearEntitySyncState(operationSummary.result),
        [operationSummary.resolvedSessionId],
      );
      continue;
    }

    if (operationSummary.type === 'deleteSession') {
      nextSessions = removeById(nextSessions, [operationSummary.resolvedSessionId]);
    }
  }

  return {
    ...nextSnapshot,
    tasks: nextTasks,
    sessions: sortSessions(nextSessions),
  };
}

export function mergeOfflineSnapshot(localSnapshot, remoteSnapshot, queue) {
  const baseLocalSnapshot = {
    ...createEmptyOfflineSnapshot(),
    ...(localSnapshot && typeof localSnapshot === 'object' ? localSnapshot : {}),
  };
  const baseRemoteSnapshot = {
    ...createEmptyOfflineSnapshot(),
    ...(remoteSnapshot && typeof remoteSnapshot === 'object' ? remoteSnapshot : {}),
  };
  const { taskState, sessionState } = buildQueueEntityState(normalizeArray(queue));

  return {
    ...baseLocalSnapshot,
    tasks: mergeCollection(
      normalizeArray(baseLocalSnapshot.tasks),
      normalizeArray(baseRemoteSnapshot.tasks),
      taskState,
    ),
    sessions: sortSessions(
      mergeCollection(
        normalizeArray(baseLocalSnapshot.sessions),
        normalizeArray(baseRemoteSnapshot.sessions),
        sessionState,
      ),
    ),
    config: baseRemoteSnapshot.config ?? baseLocalSnapshot.config ?? null,
    goalSettings: baseRemoteSnapshot.goalSettings ?? baseLocalSnapshot.goalSettings ?? null,
    lastSyncedAt: baseRemoteSnapshot.lastSyncedAt ?? baseLocalSnapshot.lastSyncedAt ?? null,
    lastSeenSyncEventId: Number.isFinite(Number(baseRemoteSnapshot.lastSeenSyncEventId))
      ? Number(baseRemoteSnapshot.lastSeenSyncEventId)
      : Number.isFinite(Number(baseLocalSnapshot.lastSeenSyncEventId))
        ? Number(baseLocalSnapshot.lastSeenSyncEventId)
        : 0,
  };
}

export function upsertTaskCollection(tasks, task, previousIds = []) {
  return replaceById(tasks, task, previousIds);
}

export function upsertSessionCollection(sessions, session, previousIds = []) {
  return sortSessions(replaceById(sessions, session, previousIds));
}

export function removeSessionCollection(sessions, sessionIds) {
  return sortSessions(removeById(sessions, normalizeArray(sessionIds)));
}
