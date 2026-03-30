import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractSpeechTextFromNotification,
  shouldAutoSpeakNotification,
} from '../services/notificationDelivery.js';

function buildNotification({
  identifier = 'notif-1',
  categoryIdentifier = 'weekly-execution-session-actions',
  body = 'Execution Block starts now.',
  data = {},
} = {}) {
  return {
    request: {
      identifier,
      content: {
        categoryIdentifier,
        body,
        data,
      },
    },
  };
}

test('extractSpeechTextFromNotification prefers voiceText from data', () => {
  const notification = buildNotification({
    body: 'Body fallback',
    data: { voiceText: 'Voice text wins' },
  });

  assert.equal(
    extractSpeechTextFromNotification(notification),
    'Voice text wins',
  );
});

test('extractSpeechTextFromNotification falls back to notification body', () => {
  const notification = buildNotification({
    body: 'Body fallback',
    data: {},
  });

  assert.equal(
    extractSpeechTextFromNotification(notification),
    'Body fallback',
  );
});

test('shouldAutoSpeakNotification accepts session reminder notifications', () => {
  const notification = buildNotification({
    data: {
      sessionId: 42,
      eventType: 'start',
      voiceText: 'Start now.',
    },
  });

  assert.equal(shouldAutoSpeakNotification(notification), true);
});

test('shouldAutoSpeakNotification rejects manual deliveries marked to skip auto speech', () => {
  const notification = buildNotification({
    data: {
      sessionId: 42,
      eventType: 'start',
      skipAutoSpeech: true,
      voiceText: 'Start now.',
    },
  });

  assert.equal(shouldAutoSpeakNotification(notification), false);
});
