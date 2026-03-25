import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSessionCards,
  endSessionFlow,
  getCurrentSession,
  startSessionFlow,
  submitMissedSessionFlow,
} from '../services/executionLoop.js';

test('session start and end flow call backend and refresh', async () => {
  const calls = [];
  const api = {
    startSession: async (payload) => calls.push(['start', payload]),
    endSession: async (payload) => calls.push(['end', payload]),
    markSessionMissed: async () => undefined,
    refresh: async () => ({ ok: true }),
  };
  const sessionCard = { id: 9, taskId: 4 };

  await startSessionFlow(api, sessionCard);
  await endSessionFlow(api, sessionCard, 95);

  assert.deepEqual(calls[0], ['start', { task_id: 4, session_id: 9, schedule_block_id: null, timezone: 'UTC' }]);
  assert.deepEqual(calls[1], ['end', { session_id: 9, completion_percent: 95, output_notes: 'Completed from execution panel' }]);
});

test('missed-session submission persists and refreshes', async () => {
  let refreshed = false;
  const api = {
    startSession: async () => undefined,
    endSession: async () => undefined,
    markSessionMissed: async (payload) => {
      assert.equal(payload.reason_category, 'YouTube');
      assert.equal(payload.session_id, 11);
    },
    refresh: async () => {
      refreshed = true;
      return { habits: [{ category: 'YouTube', minutes_lost: 30, count: 1 }] };
    },
  };

  await submitMissedSessionFlow(api, { id: 11 }, 'YouTube', '');
  assert.equal(refreshed, true);
});

test('habit breakdown refresh uses backend data through refreshed state models', () => {
  const sessionCards = buildSessionCards({
    tasks: [{ id: 5, title: 'Focus Block', objective: 'Ship operator loop' }],
    sessions: [{
      id: 15,
      task_id: 5,
      planned_start: '2026-03-21T10:00:00.000Z',
      planned_end: '2026-03-21T11:00:00.000Z',
      actual_start: '2026-03-21T10:03:00.000Z',
      actual_end: null,
      status: 'active',
      completion_percent: 0,
    }],
    now: new Date('2026-03-21T10:20:00.000Z'),
  });

  assert.equal(getCurrentSession(sessionCards)?.title, 'Focus Block');
  assert.equal(sessionCards[0].latenessLabel, '3 min late');
});
