import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOverlapErrorMessage,
  findOverlappingSession,
  validateSessionTimeRange,
} from '../services/plannerValidation.js';

const sessions = [
  {
    id: 101,
    title: 'Deep work',
    plannedStart: '2026-04-23T09:00:00',
    plannedEnd: '2026-04-23T10:00:00',
    status: 'planned',
  },
  {
    id: 102,
    title: 'Review',
    plannedStart: '2026-04-23T11:00:00',
    plannedEnd: '2026-04-23T12:00:00',
    status: 'planned',
  },
];

test('findOverlappingSession rejects intersecting create ranges', () => {
  const conflict = findOverlappingSession(sessions, {
    startIso: '2026-04-23T09:30:00',
    endIso: '2026-04-23T10:30:00',
  });

  assert.equal(conflict?.id, 101);
  assert.match(buildOverlapErrorMessage(conflict), /Deep work/);
});

test('validateSessionTimeRange ignores the current session when editing', () => {
  const validationError = validateSessionTimeRange(sessions, {
    startIso: '2026-04-23T09:15:00',
    endIso: '2026-04-23T09:45:00',
    excludeSessionId: 101,
  });

  assert.equal(validationError, null);
});

test('validateSessionTimeRange allows non-overlapping reschedules', () => {
  const validationError = validateSessionTimeRange(sessions, {
    startIso: '2026-04-23T12:15:00',
    endIso: '2026-04-23T13:00:00',
    excludeSessionId: 102,
  });

  assert.equal(validationError, null);
});

test('validateSessionTimeRange ignores locally cancelled sessions', () => {
  const validationError = validateSessionTimeRange(
    [
      ...sessions,
      {
        id: 103,
        title: 'Cancelled block',
        plannedStart: '2026-04-23T12:00:00',
        plannedEnd: '2026-04-23T13:00:00',
        status: 'cancelled',
        local_deleted: true,
      },
    ],
    {
      startIso: '2026-04-23T12:15:00',
      endIso: '2026-04-23T12:45:00',
    },
  );

  assert.equal(validationError, null);
});
