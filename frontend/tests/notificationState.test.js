import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearSessionNotificationState,
  createEmptyNotificationState,
  markLateReminderDelivered,
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

test('persistent late-reminder suppression is tracked in state', () => {
  const state = markLateReminderDelivered(createEmptyNotificationState(), 44, '2026-03-21T10:15:00.000Z');
  assert.equal(state.deliveredLateReminders['44'], '2026-03-21T10:15:00.000Z');
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
    deliveredLateReminders: { '9': '2026-03-21T10:20:00.000Z' },
  };

  const cleaned = clearSessionNotificationState(existingState, 9);
  assert.deepEqual(cleaned.scheduledReminders, {});
  assert.deepEqual(cleaned.deliveredLateReminders, {});
});
