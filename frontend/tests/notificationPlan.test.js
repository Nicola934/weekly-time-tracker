import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNotificationPayload, buildSessionReminderPlan, getLateSessions } from '../services/notificationPlan.js';

const config = {
  tone: 'strict',
  display_name: 'Nadia',
  pre_session_minutes: 5,
  pre_script: 'session starts in {minutes} minutes.',
  start_script: 'session starts now.',
  late_script: 'you are now {minutes} minutes late. Start now.',
};

const session = {
  id: 7,
  taskId: 3,
  title: 'Execution Block',
  plannedStart: '2026-03-21T10:00:00.000Z',
  plannedEnd: '2026-03-21T11:00:00.000Z',
  status: 'planned',
};

test('buildNotificationPayload uses configured display name instead of a hardcoded user name', () => {
  const payload = buildNotificationPayload(session, config, 'pre', config.display_name);
  assert.equal(payload.title, 'Execution Block starts soon');
  assert.match(payload.body, /Nadia/);
  assert.equal(payload.data.eventType, 'pre');
});

test('buildSessionReminderPlan returns pre and start reminders when session is in future', () => {
  const reminders = buildSessionReminderPlan(session, config, new Date('2026-03-21T09:00:00.000Z'), config.display_name);
  assert.equal(reminders.length, 2);
  assert.equal(reminders[0].eventType, 'pre');
  assert.equal(reminders[1].eventType, 'start');
});

test('getLateSessions identifies overdue sessions only', () => {
  const lateSessions = getLateSessions(
    [
      session,
      { ...session, id: 8, status: 'completed' },
      { ...session, id: 9, plannedStart: '2026-03-21T09:30:00.000Z', status: 'planned' },
    ],
    new Date('2026-03-21T09:45:00.000Z'),
    10,
  );

  assert.deepEqual(lateSessions.map((item) => item.id), [9]);
});
