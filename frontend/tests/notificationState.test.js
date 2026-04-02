import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearScheduledReminder,
  clearSessionNotificationState,
  createEmptyNotificationState,
  hasDeliveredLateReminder,
  markLateReminderDelivered,
  pruneInactiveLateReminders,
  reconcileStoredReminders,
} from '../services/notificationState.js';

const desired = [
  { sessionId: 12, eventType: 'pre', triggerAt: '2026-03-21T09:55:00.000Z', identifier: 'new-pre' },
  { sessionId: 12, eventType: 'start', triggerAt: '2026-03-21T10:00:00.000Z', identifier: 'new-start' },
];

test('deduplicated scheduling keeps matching reminders and avoids duplicate scheduling', () => {
  const existingState = {
    scheduledReminders: {
      '12:pre': { sessionId: 12, eventType: 'pre', triggerAt: '2026-03-21T09:55:00.000Z', identifier: 'existing-pre' },
    },
    deliveredLateReminders: {},
  };

  const result = reconcileStoredReminders(existingState, desired);
  assert.equal(result.toCancel.length, 0);
  assert.equal(result.toSchedule.length, 1);
  assert.equal(result.toSchedule[0].eventType, 'start');
});

test('delivered native reminders stay deduplicated across re-arm passes', () => {
  const existingState = {
    scheduledReminders: {
      '12:start': {
        sessionId: 12,
        eventType: 'start',
        triggerAt: '2026-03-21T10:00:00.000Z',
        identifier: null,
        deliveredAt: '2026-03-21T10:00:10.000Z',
      },
    },
    deliveredLateReminders: {},
  };

  const result = reconcileStoredReminders(existingState, desired);
  assert.equal(result.toCancel.length, 0);
  assert.equal(result.toSchedule.length, 1);
  assert.equal(result.toSchedule[0].eventType, 'pre');
  assert.equal(result.nextState.scheduledReminders['12:start'].identifier, null);
});

test('persistent late-reminder suppression is tracked in state', () => {
  const state = markLateReminderDelivered(
    createEmptyNotificationState(),
    44,
    '2026-03-21T10:15:00.000Z',
    10,
  );
  assert.deepEqual(state.deliveredLateReminders['44'], {
    deliveredAt: '2026-03-21T10:15:00.000Z',
    latenessMinutes: 10,
  });
  assert.equal(hasDeliveredLateReminder(state, 44, 10), true);
  assert.equal(hasDeliveredLateReminder(state, 44, 15), false);
});

test('rescheduling on config or session changes cancels stale reminders and schedules replacements', () => {
  const existingState = {
    scheduledReminders: {
      '12:pre': { sessionId: 12, eventType: 'pre', triggerAt: '2026-03-21T09:50:00.000Z', identifier: 'old-pre' },
      '13:start': { sessionId: 13, eventType: 'start', triggerAt: '2026-03-21T11:00:00.000Z', identifier: 'other-start' },
    },
    deliveredLateReminders: {},
  };

  const result = reconcileStoredReminders(existingState, desired);
  assert.deepEqual(result.toCancel.map((item) => item.identifier).sort(), ['old-pre', 'other-start']);
  assert.deepEqual(result.toSchedule.map((item) => item.eventType).sort(), ['pre', 'start']);
});

test('cleanup removes scheduled reminders and late state when a session ends or is missed', () => {
  const existingState = {
    scheduledReminders: {
      '9:pre': { sessionId: 9, eventType: 'pre', identifier: 'pre-9', triggerAt: '2026-03-21T09:55:00.000Z' },
      '9:start': { sessionId: 9, eventType: 'start', identifier: 'start-9', triggerAt: '2026-03-21T10:00:00.000Z' },
    },
    deliveredLateReminders: {
      '9': { deliveredAt: '2026-03-21T10:20:00.000Z', latenessMinutes: 20 },
    },
  };

  const cleaned = clearSessionNotificationState(existingState, 9);
  assert.deepEqual(cleaned.scheduledReminders, {});
  assert.deepEqual(cleaned.deliveredLateReminders, {});
});

test('single reminder cleanup preserves the other session reminder', () => {
  const existingState = {
    scheduledReminders: {
      '9:pre': { sessionId: 9, eventType: 'pre', identifier: 'pre-9', triggerAt: '2026-03-21T09:55:00.000Z' },
      '9:start': { sessionId: 9, eventType: 'start', identifier: 'start-9', triggerAt: '2026-03-21T10:00:00.000Z' },
    },
    deliveredLateReminders: {},
  };

  const cleaned = clearScheduledReminder(existingState, 9, 'pre');
  assert.deepEqual(Object.keys(cleaned.scheduledReminders), ['9:start']);
});

test('late reminder state is pruned once a session expires or leaves planned status', () => {
  const existingState = {
    scheduledReminders: {},
    deliveredLateReminders: {
      '9': { deliveredAt: '2026-03-21T10:20:00.000Z', latenessMinutes: 20 },
      '10': { deliveredAt: '2026-03-21T10:10:00.000Z', latenessMinutes: 10 },
    },
  };

  const cleaned = pruneInactiveLateReminders(
    existingState,
    [
      {
        id: 9,
        status: 'planned',
        plannedEnd: '2026-03-21T10:45:00.000Z',
      },
      {
        id: 10,
        status: 'missed',
        plannedEnd: '2026-03-21T10:45:00.000Z',
      },
    ],
    new Date('2026-03-21T10:30:00.000Z'),
  );

  assert.deepEqual(Object.keys(cleaned.deliveredLateReminders), ['9']);
});
