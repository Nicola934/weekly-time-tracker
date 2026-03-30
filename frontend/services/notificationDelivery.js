import { SESSION_NOTIFICATION_CATEGORY_ID } from './notificationPlan.js';

function normalizeNotificationData(notification) {
  const data = notification?.request?.content?.data;
  return data && typeof data === 'object' ? data : {};
}

export function extractSpeechTextFromNotification(notification) {
  const data = normalizeNotificationData(notification);
  if (typeof data.voiceText === 'string' && data.voiceText.trim()) {
    return data.voiceText.trim();
  }

  const body = notification?.request?.content?.body;
  if (typeof body === 'string' && body.trim()) {
    return body.trim();
  }

  return '';
}

export function shouldAutoSpeakNotification(notification) {
  const data = normalizeNotificationData(notification);
  const categoryIdentifier = notification?.request?.content?.categoryIdentifier;
  const eventType =
    typeof data.eventType === 'string' ? data.eventType.trim() : '';
  const sessionId = Number(data.sessionId);

  if (data.skipAutoSpeech === true || data.skipAutoSpeech === 'true') {
    return false;
  }

  if (categoryIdentifier === SESSION_NOTIFICATION_CATEGORY_ID) {
    return true;
  }

  return (
    Number.isInteger(sessionId) &&
    sessionId > 0 &&
    (eventType === 'pre' || eventType === 'start' || eventType === 'late')
  );
}
