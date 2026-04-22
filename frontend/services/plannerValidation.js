import { normalizeEntityId } from './offlineStore.js';

function getSessionDateValue(session, key) {
  if (!session || typeof session !== 'object') {
    return null;
  }

  if (key === 'start') {
    return session.planned_start ?? session.plannedStart ?? null;
  }

  return session.planned_end ?? session.plannedEnd ?? null;
}

function normalizeSessionStatus(session) {
  return String(session?.status || 'planned').trim().toLowerCase();
}

function isSchedulableSession(session) {
  const status = normalizeSessionStatus(session);
  return !session?.local_deleted && status !== 'cancelled';
}

function formatTimeRange(startValue, endValue) {
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  return `${start.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })} - ${end.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

export function findOverlappingSession(
  sessions,
  { startIso, endIso, excludeSessionId = null } = {},
) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return null;
  }

  const normalizedExcludeSessionId = normalizeEntityId(excludeSessionId);

  return (
    (Array.isArray(sessions) ? sessions : []).find((session) => {
      if (!isSchedulableSession(session)) {
        return false;
      }

      const sessionId = normalizeEntityId(session?.id);
      if (
        normalizedExcludeSessionId !== null &&
        sessionId === normalizedExcludeSessionId
      ) {
        return false;
      }

      const sessionStart = new Date(getSessionDateValue(session, 'start'));
      const sessionEnd = new Date(getSessionDateValue(session, 'end'));
      if (
        Number.isNaN(sessionStart.getTime()) ||
        Number.isNaN(sessionEnd.getTime())
      ) {
        return false;
      }

      return sessionStart < end && sessionEnd > start;
    }) ?? null
  );
}

export function buildOverlapErrorMessage(overlappingSession) {
  if (!overlappingSession) {
    return 'This session overlaps another planned session. Choose a different time.';
  }

  const title = String(
    overlappingSession?.title ||
      overlappingSession?.local_task_title ||
      overlappingSession?.localTaskTitle ||
      'another session',
  ).trim();
  const timeRange = formatTimeRange(
    getSessionDateValue(overlappingSession, 'start'),
    getSessionDateValue(overlappingSession, 'end'),
  );

  if (!timeRange) {
    return `This session overlaps ${title}. Choose a different time.`;
  }

  return `This session overlaps ${title} (${timeRange}). Choose a different time.`;
}

export function validateSessionTimeRange(
  sessions,
  { startIso, endIso, excludeSessionId = null } = {},
) {
  const overlappingSession = findOverlappingSession(sessions, {
    startIso,
    endIso,
    excludeSessionId,
  });

  if (!overlappingSession) {
    return null;
  }

  return buildOverlapErrorMessage(overlappingSession);
}
