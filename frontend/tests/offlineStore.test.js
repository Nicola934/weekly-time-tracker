import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyCompletedOperationsToSnapshot,
  enqueueOfflineOperation,
  flushOfflineQueue,
  loadOfflineQueue,
  loadOfflineSnapshot,
  mergeOfflineSnapshot,
  replaceOfflineQueue,
  saveOfflineSnapshot,
} from '../services/offlineStore.js';

test('offline snapshot persistence keeps cached planned sessions available across restarts', async () => {
  const userId = 91;
  const snapshot = {
    tasks: [
      {
        id: 11,
        title: 'Cached task',
        objective: 'Keep the planner visible offline',
      },
    ],
    sessions: [
      {
        id: 21,
        task_id: 11,
        planned_start: '2026-04-23T09:00:00',
        planned_end: '2026-04-23T10:00:00',
        status: 'planned',
      },
    ],
    config: { enabled: true },
    goalSettings: { category_goals: {} },
    lastSyncedAt: '2026-04-22T08:00:00Z',
    lastSeenSyncEventId: 7,
  };

  await saveOfflineSnapshot(userId, snapshot);
  const restored = await loadOfflineSnapshot(userId);

  assert.equal(restored.sessions.length, 1);
  assert.equal(restored.sessions[0].id, 21);
  assert.equal(restored.lastSeenSyncEventId, 7);
});

test('flushOfflineQueue remaps temporary task and session ids before syncing dependent operations', async () => {
  const userId = 77;
  const apiCalls = [];

  await replaceOfflineQueue(userId, []);
  await enqueueOfflineOperation(userId, {
    type: 'createTask',
    localTaskId: -101,
    payload: {
      title: 'Offline task',
      objective: 'Persist local work',
      category: 'Offline',
      long_term_goal: 'Stay productive',
    },
  });
  await enqueueOfflineOperation(userId, {
    type: 'createSchedule',
    localSessionId: -202,
    payload: {
      task_id: -101,
      start_time: '2026-03-30T09:00:00',
      end_time: '2026-03-30T10:00:00',
      timezone: 'Africa/Johannesburg',
      notes: 'Offline block',
      goal_context: 'Stay productive',
    },
  });
  await enqueueOfflineOperation(userId, {
    type: 'updateSession',
    sessionId: -202,
    payload: {
      task_id: -101,
      start_time: '2026-03-30T09:30:00',
      end_time: '2026-03-30T10:30:00',
      timezone: 'Africa/Johannesburg',
      notes: 'Adjusted offline block',
      goal_context: 'Stay productive',
    },
  });

  const result = await flushOfflineQueue(userId, {
    async createTask(payload) {
      apiCalls.push(['createTask', payload]);
      return { id: 501, ...payload };
    },
    async createSchedule(payload) {
      apiCalls.push(['createSchedule', payload]);
      return {
        id: 601,
        session_id: 701,
        session: { id: 701, task_id: payload.task_id, status: 'planned' },
        ...payload,
      };
    },
    async updateSession(sessionId, payload) {
      apiCalls.push(['updateSession', sessionId, payload]);
      return { id: sessionId, ...payload };
    },
    async deleteSession() {
      throw new Error('not used');
    },
    async startSession() {
      throw new Error('not used');
    },
    async endSession() {
      throw new Error('not used');
    },
    async markSessionMissed() {
      throw new Error('not used');
    },
  });

  assert.equal(result.flushed, 3);
  assert.equal(result.remaining, 0);
  assert.deepEqual(result.taskIdMap, { '-101': 501 });
  assert.deepEqual(result.sessionIdMap, { '-202': 701 });
  assert.deepEqual(apiCalls, [
    [
      'createTask',
      {
        title: 'Offline task',
        objective: 'Persist local work',
        category: 'Offline',
        long_term_goal: 'Stay productive',
      },
    ],
    [
      'createSchedule',
      {
        task_id: 501,
        start_time: '2026-03-30T09:00:00',
        end_time: '2026-03-30T10:00:00',
        timezone: 'Africa/Johannesburg',
        notes: 'Offline block',
        goal_context: 'Stay productive',
      },
    ],
    [
      'updateSession',
      701,
      {
        task_id: 501,
        start_time: '2026-03-30T09:30:00',
        end_time: '2026-03-30T10:30:00',
        timezone: 'Africa/Johannesburg',
        notes: 'Adjusted offline block',
        goal_context: 'Stay productive',
      },
    ],
  ]);
  assert.deepEqual(await loadOfflineQueue(userId), []);
});

test('applyCompletedOperationsToSnapshot replaces temporary ids with canonical records', () => {
  const snapshot = {
    tasks: [
      {
        id: -101,
        title: 'Offline task',
        objective: 'Protect local durability',
        is_local_only: true,
      },
    ],
    sessions: [
      {
        id: -202,
        task_id: -101,
        planned_start: '2026-03-30T09:00:00',
        planned_end: '2026-03-30T10:00:00',
        status: 'planned',
        is_local_only: true,
      },
    ],
  };
  const reconciled = applyCompletedOperationsToSnapshot(snapshot, [
    {
      type: 'createTask',
      localTaskId: -101,
      resolvedTaskId: 501,
      result: {
        id: 501,
        title: 'Offline task',
        objective: 'Protect local durability',
      },
    },
    {
      type: 'createSchedule',
      localSessionId: -202,
      resolvedTaskId: 501,
      result: {
        id: 601,
        session_id: 701,
        session: {
          id: 701,
          task_id: 501,
          planned_start: '2026-03-30T09:00:00',
          planned_end: '2026-03-30T10:00:00',
          status: 'planned',
        },
      },
    },
  ]);

  assert.equal(reconciled.tasks[0].id, 501);
  assert.equal(reconciled.sessions[0].id, 701);
  assert.equal(reconciled.sessions[0].task_id, 501);
  assert.equal(reconciled.sessions[0].is_local_only, false);
});

test('mergeOfflineSnapshot keeps pending local session edits over stale remote data', () => {
  const merged = mergeOfflineSnapshot(
    {
      tasks: [{ id: 11, title: 'Focus block', objective: 'Protect local state' }],
      sessions: [
        {
          id: 21,
          task_id: 11,
          planned_start: '2026-04-23T09:00:00',
          planned_end: '2026-04-23T10:30:00',
          status: 'planned',
          objective: 'Local edit should survive',
          sync_state: 'pending_sync',
        },
      ],
      config: { enabled: true },
      goalSettings: { category_goals: {} },
      lastSyncedAt: '2026-04-22T08:00:00Z',
    },
    {
      tasks: [{ id: 11, title: 'Focus block', objective: 'Protect local state' }],
      sessions: [
        {
          id: 21,
          task_id: 11,
          planned_start: '2026-04-23T09:00:00',
          planned_end: '2026-04-23T10:00:00',
          status: 'planned',
          objective: 'Stale remote copy',
        },
        {
          id: 22,
          task_id: 11,
          planned_start: '2026-04-23T11:00:00',
          planned_end: '2026-04-23T12:00:00',
          status: 'planned',
          objective: 'Remote device session',
        },
      ],
      config: { enabled: true },
      goalSettings: { category_goals: {} },
      lastSyncedAt: '2026-04-22T09:00:00Z',
    },
    [
      {
        type: 'updateSession',
        sessionId: 21,
        payload: {
          task_id: 11,
          start_time: '2026-04-23T09:00:00',
          end_time: '2026-04-23T10:30:00',
        },
        syncState: 'pending_sync',
      },
    ],
  );

  assert.equal(merged.sessions.length, 2);
  assert.equal(merged.sessions[0].objective, 'Local edit should survive');
  assert.equal(merged.sessions[0].sync_state, 'pending_sync');
  assert.equal(merged.sessions[1].id, 22);
});
