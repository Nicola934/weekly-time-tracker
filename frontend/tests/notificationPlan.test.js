import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNotificationPayload,
  buildSessionReminderPlan,
  getLateSessions,
} from '../services/notificationPlan.js';

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
  objectiveText: 'Send the next client batch',
  category: 'Lionyx-E Automation Systems',
  goalContext: 'Generate R300 000 recurring revenue',
  plannedStart: '2026-03-21T10:00:00.000Z',
  plannedEnd: '2026-03-21T10:30:00.000Z',
  status: 'planned',
};

test('buildNotificationPayload uses configured display name instead of a hardcoded user name', () => {
  const payload = buildNotificationPayload(session, config, 'pre', config.display_name);
  assert.equal(payload.title, 'Execution Block starts soon');
  assert.equal(payload.body, 'Execution Block starts in 5 minutes.');
  assert.equal(payload.data.eventType, 'pre');
  assert.equal(payload.data.sessionId, 7);
  assert.equal(payload.data.taskId, 3);
  assert.equal(payload.data.voiceText, payload.body);
});

test('buildNotificationPayload keeps start voice direct and late voice goal-aware', () => {
  const startPayload = buildNotificationPayload(
    session,
    config,
    'start',
    config.display_name,
  );
  const latePayload = buildNotificationPayload(
    session,
    config,
    'late',
    config.display_name,
    { latenessMinutes: 5 },
  );

  assert.equal(startPayload.body, 'Execution Block starts now.');
  assert.match(latePayload.body, /Execution Block/);
  assert.match(latePayload.body, /Send the next client batch/);
  assert.match(latePayload.body, /Generate R300 000 recurring revenue/);
  assert.equal(
    latePayload.data.goalContext,
    'Generate R300 000 recurring revenue',
  );
});

test('buildSessionReminderPlan returns pre and start reminders when session is in future', () => {
  const reminders = buildSessionReminderPlan(
    session,
    config,
    new Date('2026-03-21T09:00:00.000Z'),
    config.display_name,
  );
  assert.equal(reminders.length, 2);
  assert.equal(reminders[0].eventType, 'pre');
  assert.equal(reminders[1].eventType, 'start');
});

test('buildSessionReminderPlan uses a session-specific reminder offset when provided', () => {
  const reminders = buildSessionReminderPlan(
    { ...session, reminderOffsetMinutes: 15 },
    config,
    new Date('2026-03-21T09:00:00.000Z'),
    config.display_name,
  );

  assert.equal(reminders[0].triggerAt, '2026-03-21T09:45:00.000Z');
  assert.equal(reminders[0].payload.data.reminderLeadMinutes, 15);
});

test('buildSessionReminderPlan allows reminder timing to disable pre-start reminders', () => {
  const reminders = buildSessionReminderPlan(
    { ...session, reminderOffsetMinutes: 0 },
    config,
    new Date('2026-03-21T09:00:00.000Z'),
    config.display_name,
  );

  assert.deepEqual(reminders.map((item) => item.eventType), ['start']);
});

test('buildSessionReminderPlan skips non-planned sessions during re-arm', () => {
  const reminders = buildSessionReminderPlan(
    { ...session, status: 'active' },
    config,
    new Date('2026-03-21T09:00:00.000Z'),
    config.display_name,
  );

  assert.deepEqual(reminders, []);
});

test('buildSessionReminderPlan keeps the start reminder deliverable during the exact start window', () => {
  const reminders = buildSessionReminderPlan(
    session,
    config,
    new Date('2026-03-21T10:00:30.000Z'),
    config.display_name,
  );

  assert.deepEqual(reminders.map((item) => item.eventType), ['start']);
});

test('getLateSessions identifies overdue sessions only and stops once the session window expires', () => {
  const lateSessions = getLateSessions(
    [
      session,
      { ...session, id: 8, status: 'completed' },
      { ...session, id: 9, plannedStart: '2026-03-21T09:30:00.000Z', status: 'planned' },
      {
        ...session,
        id: 10,
        plannedStart: '2026-03-21T09:00:00.000Z',
        plannedEnd: '2026-03-21T09:30:00.000Z',
        status: 'planned',
      },
    ],
    new Date('2026-03-21T09:45:00.000Z'),
    5,
  );

  assert.deepEqual(lateSessions.map((item) => item.id), [9]);
});
