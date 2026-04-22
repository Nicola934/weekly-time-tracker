import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSessionCards,
  deleteSessionFlow,
  endSessionFlow,
  formatPunctualityLabel,
  formatStartDeltaLabel,
  formatTimeSpent,
  getCurrentSession,
  skipSessionFlow,
  startSessionFlow,
  submitMissedSessionFlow,
} from '../services/executionLoop.js';

test('session start and end flow call backend and refresh', async () => {
  const calls = [];
  const api = {
    startSession: async (payload) => calls.push(['start', payload]),
    endSession: async (payload) => {
      calls.push(['end', payload]);
      return { id: payload.session_id, actual_end: payload.actual_end };
    },
    deleteSession: async () => undefined,
    markSessionMissed: async () => undefined,
    refresh: async () => ({ ok: true }),
  };
  const sessionCard = {
    id: 9,
    taskId: 4,
    timezone: 'Africa/Johannesburg',
  };

  await startSessionFlow(api, sessionCard);
  const endResult = await endSessionFlow(
    api,
    { ...sessionCard, actualStart: '2026-03-21T10:00:00' },
    {
      completionPercent: 95,
      objectiveCompleted: false,
      outputNotes: 'Objective not completed from execution panel',
      reflectionNotes: 'Left the final edge case open',
      failureReason: 'Underestimated effort',
    },
  );

  assert.equal(calls[0][0], 'start');
  assert.equal(calls[0][1].task_id, 4);
  assert.equal(calls[0][1].session_id, 9);
  assert.equal(calls[0][1].schedule_block_id, null);
  assert.equal(calls[0][1].timezone, 'Africa/Johannesburg');
  assert.match(calls[0][1].actual_start, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);

  assert.equal(calls[1][0], 'end');
  assert.equal(calls[1][1].session_id, 9);
  assert.equal(calls[1][1].completion_percent, 95);
  assert.equal(calls[1][1].objective_completed, false);
  assert.equal(
    calls[1][1].output_notes,
    'Objective not completed from execution panel',
  );
  assert.equal(calls[1][1].reflection_notes, 'Left the final edge case open');
  assert.equal(calls[1][1].failure_reason, 'Underestimated effort');
  assert.match(calls[1][1].actual_end, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  assert.equal(endResult.session.id, 9);
  assert.match(endResult.spentLabel, /^\d+:\d{2}$/);
});

test('delete flow removes a planned session and refreshes state', async () => {
  const calls = [];
  const api = {
    startSession: async () => undefined,
    endSession: async () => undefined,
    deleteSession: async (sessionId) => calls.push(['delete', sessionId]),
    markSessionMissed: async () => undefined,
    refresh: async () => {
      calls.push(['refresh']);
      return { ok: true };
    },
  };

  await deleteSessionFlow(api, { id: 22 });

  assert.deepEqual(calls, [['delete', 22], ['refresh']]);
});

test('missed-session submission persists and refreshes', async () => {
  let refreshed = false;
  const api = {
    startSession: async () => undefined,
    endSession: async () => undefined,
    deleteSession: async () => undefined,
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

test('notification skip flow marks the session missed and refreshes state', async () => {
  const calls = [];
  const api = {
    startSession: async () => undefined,
    endSession: async () => undefined,
    deleteSession: async () => undefined,
    markSessionMissed: async (payload) => {
      calls.push(['missed', payload]);
    },
    refresh: async () => {
      calls.push(['refresh']);
      return { ok: true };
    },
  };

  await skipSessionFlow(api, { id: 41 });

  assert.equal(calls[0][0], 'missed');
  assert.equal(calls[0][1].session_id, 41);
  assert.equal(calls[0][1].reason_category, 'Unknown');
  assert.equal(calls[0][1].custom_reason, 'Skipped from notification');
  assert.deepEqual(calls[1], ['refresh']);
});

test('habit breakdown refresh uses backend data through refreshed state models', () => {
  const sessionCards = buildSessionCards({
    tasks: [{ id: 5, title: 'Focus Block', objective: 'Ship operator loop' }],
    sessions: [{
      id: 15,
      task_id: 5,
      planned_start: '2026-03-21T10:00:00',
      planned_end: '2026-03-21T11:00:00',
      actual_start: '2026-03-21T10:03:00',
      actual_end: null,
      timezone: 'Africa/Johannesburg',
      status: 'active',
      completion_percent: 0,
    }],
    now: new Date('2026-03-21T10:20:00'),
  });

  assert.equal(getCurrentSession(sessionCards)?.title, 'Focus Block');
  assert.equal(sessionCards[0].timingStatusLabel, 'Started 3 minutes late');
  assert.equal(sessionCards[0].plannedStart, '2026-03-21T10:00:00');
  assert.equal(sessionCards[0].reminderOffsetMinutes, null);
  assert.equal(sessionCards[0].spentLabel, null);
  assert.equal(sessionCards[0].objectiveCompleted, false);
  assert.equal(sessionCards[0].objectiveText, 'Ship operator loop');
  assert.deepEqual(sessionCards[0].availableActions, ['end']);
});

test('planned sessions keep delete available even while another session is active', () => {
  const sessionCards = buildSessionCards({
    tasks: [{ id: 5, title: 'Focus Block', objective: 'Ship operator loop' }],
    sessions: [
      {
        id: 15,
        task_id: 5,
        planned_start: '2026-03-21T10:00:00',
        planned_end: '2026-03-21T11:00:00',
        status: 'active',
        completion_percent: 0,
      },
      {
        id: 16,
        task_id: 5,
        planned_start: '2026-03-21T12:00:00',
        planned_end: '2026-03-21T13:00:00',
        status: 'planned',
        completion_percent: 0,
      },
    ],
    now: new Date('2026-03-21T10:20:00'),
  });

  assert.deepEqual(sessionCards[1].availableActions, ['edit', 'delete']);
});

test('sessions become startable one hour before the planned start while staying editable', () => {
  const sessionCards = buildSessionCards({
    tasks: [{ id: 5, title: 'Focus Block', objective: 'Ship operator loop' }],
    sessions: [{
      id: 17,
      task_id: 5,
      planned_start: '2026-03-21T11:00:00',
      planned_end: '2026-03-21T12:00:00',
      status: 'planned',
      completion_percent: 0,
    }],
    now: new Date('2026-03-21T10:15:00'),
  });

  assert.deepEqual(sessionCards[0].availableActions, ['start', 'edit', 'delete']);
  assert.equal(sessionCards[0].timingStatusLabel, 'Start window open');
});

test('sessions stay non-startable before the one-hour pre-start window opens', () => {
  const sessionCards = buildSessionCards({
    tasks: [{ id: 5, title: 'Focus Block', objective: 'Ship operator loop' }],
    sessions: [{
      id: 19,
      task_id: 5,
      planned_start: '2026-03-21T11:00:00',
      planned_end: '2026-03-21T12:00:00',
      status: 'planned',
      completion_percent: 0,
    }],
    now: new Date('2026-03-21T09:45:00'),
  });

  assert.deepEqual(sessionCards[0].availableActions, ['edit', 'delete']);
  assert.equal(sessionCards[0].timingStatusLabel, 'Scheduled');
});

test('current-window planned sessions only expose start and missed controls', () => {
  const sessionCards = buildSessionCards({
    tasks: [{ id: 5, title: 'Focus Block', objective: 'Ship operator loop' }],
    sessions: [{
      id: 21,
      task_id: 5,
      planned_start: '2026-03-21T10:00:00',
      planned_end: '2026-03-21T11:00:00',
      status: 'planned',
      completion_percent: 0,
    }],
    now: new Date('2026-03-21T10:20:00'),
  });

  assert.deepEqual(sessionCards[0].availableActions, ['start', 'missed']);
});

test('past planned sessions are locked for review', () => {
  const sessionCards = buildSessionCards({
    tasks: [{ id: 5, title: 'Focus Block', objective: 'Ship operator loop' }],
    sessions: [{
      id: 22,
      task_id: 5,
      planned_start: '2026-03-21T08:00:00',
      planned_end: '2026-03-21T09:00:00',
      status: 'planned',
      completion_percent: 0,
    }],
    now: new Date('2026-03-21T10:20:00'),
  });

  assert.deepEqual(sessionCards[0].availableActions, []);
  assert.equal(sessionCards[0].controlState, 'locked');
});

test('planner sessions preserve a stored reminder offset for runtime scheduling', () => {
  const sessionCards = buildSessionCards({
    tasks: [{ id: 7, title: 'Planning Block', objective: 'Lock the weekly brief' }],
    sessions: [{
      id: 18,
      task_id: 7,
      planned_start: '2026-03-21T14:00:00',
      planned_end: '2026-03-21T15:00:00',
      reminder_offset_minutes: 15,
      status: 'planned',
      completion_percent: 0,
    }],
    now: new Date('2026-03-21T10:20:00'),
  });

  assert.equal(sessionCards[0].reminderOffsetMinutes, 15);
});

test('buildSessionCards preserves early starts and completed time spent', () => {
  const sessionCards = buildSessionCards({
    tasks: [{ id: 7, title: 'Planning Block', objective: 'Lock the weekly brief' }],
    sessions: [{
      id: 18,
      task_id: 7,
      planned_start: '2026-03-21T14:00:00',
      planned_end: '2026-03-21T15:00:00',
      actual_start: '2026-03-21T13:55:00',
      actual_end: '2026-03-21T14:50:00',
      status: 'completed',
      completion_percent: 100,
    }],
    now: new Date('2026-03-21T15:00:00'),
  });

  assert.equal(sessionCards[0].timingStatusLabel, 'Started 5 minutes early');
  assert.equal(sessionCards[0].spentLabel, '00:55');
});

test('buildSessionCards preserves stored objective completion status', () => {
  const sessionCards = buildSessionCards({
    tasks: [{ id: 7, title: 'Planning Block', objective: 'Lock the weekly brief' }],
    sessions: [{
      id: 18,
      task_id: 7,
      planned_start: '2026-03-21T14:00:00',
      planned_end: '2026-03-21T15:00:00',
      actual_start: '2026-03-21T13:55:00',
      actual_end: '2026-03-21T14:50:00',
      status: 'completed',
      objective_completed: false,
      completion_percent: 0,
    }],
    now: new Date('2026-03-21T15:00:00'),
  });

  assert.equal(sessionCards[0].objectiveCompleted, false);
});

test('buildSessionCards resolves category and goal context from task and session metadata', () => {
  const sessionCards = buildSessionCards({
    tasks: [{
      id: 7,
      title: 'Planning Block',
      objective: 'Lock the weekly brief',
      category: 'Lionyx-E Automation Systems',
      long_term_goal: 'Launch Tenant Arrears Tracking system',
    }],
    sessions: [{
      id: 18,
      task_id: 7,
      planned_start: '2026-03-21T14:00:00',
      planned_end: '2026-03-21T15:00:00',
      status: 'planned',
      completion_percent: 0,
      goal_context: 'Generate R300 000 recurring revenue',
    }],
    now: new Date('2026-03-21T13:50:00'),
    categoryGoals: {
      'Lionyx-E Automation Systems': [
        'Generate R300 000 recurring revenue',
        'Launch Tenant Arrears Tracking system',
      ],
    },
  });

  assert.equal(sessionCards[0].category, 'Lionyx-E Automation Systems');
  assert.equal(
    sessionCards[0].goalContext,
    'Generate R300 000 recurring revenue',
  );
});

test('buildSessionCards keeps local task titles and sync state for offline planner records', () => {
  const sessionCards = buildSessionCards({
    tasks: [],
    sessions: [{
      id: -18,
      task_id: -7,
      planned_start: '2026-03-21T14:00:00',
      planned_end: '2026-03-21T15:00:00',
      status: 'planned',
      completion_percent: 0,
      local_task_title: 'Offline planning block',
      sync_state: 'pending_sync',
    }],
    now: new Date('2026-03-21T13:50:00'),
  });

  assert.equal(sessionCards[0].title, 'Offline planning block');
  assert.equal(sessionCards[0].syncState, 'pending_sync');
  assert.equal(sessionCards[0].syncStatusLabel, 'Pending sync');
});

test('endSessionFlow does not auto-mark the objective complete', async () => {
  const calls = [];
  const api = {
    endSession: async (payload) => {
      calls.push(payload);
      return payload;
    },
    refresh: async () => ({ ok: true }),
  };

  await endSessionFlow(
    api,
    {
      id: 12,
      actualStart: '2026-03-21T10:00:00',
    },
    100,
  );

  assert.equal(calls[0].objective_completed, false);
});

test('punctuality and time formatting preserve direction and elapsed time', () => {
  assert.equal(formatPunctualityLabel(-5), 'Started 5 minutes early');
  assert.equal(formatPunctualityLabel(0), 'Started on time');
  assert.equal(formatPunctualityLabel(5), 'Started 5 minutes late');
  assert.equal(formatStartDeltaLabel(-5), '+5 min early');
  assert.equal(formatStartDeltaLabel(0), 'On time');
  assert.equal(formatStartDeltaLabel(8), '-8 min late');
  assert.equal(
    formatTimeSpent('2026-03-21T10:00:00', '2026-03-21T11:05:00'),
    '01:05',
  );
});
