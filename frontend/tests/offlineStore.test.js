import test from 'node:test';
import assert from 'node:assert/strict';

import {
  enqueueOfflineOperation,
  flushOfflineQueue,
  replaceOfflineQueue,
} from '../services/offlineStore.js';

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
      return { id: 601, session_id: 701, ...payload };
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

  assert.deepEqual(result, { flushed: 3, remaining: 0 });
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
});
