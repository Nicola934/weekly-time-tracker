import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearApiAuthToken,
  createTask,
  deleteSession,
  fetchCurrentUser,
  fetchGoalContextSettings,
  fetchPendingSyncEvents,
  setApiAuthToken,
} from '../services/api.js';

function createJsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return String(name).toLowerCase() === 'content-type'
          ? 'application/json'
          : null;
      },
    },
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

test('createTask returns a usable numeric id from response.id', async () => {
  const originalFetch = global.fetch;

  try {
    global.fetch = async () =>
      createJsonResponse({
        id: '17',
        title: 'Planner Block',
        objective: 'Lock the weekly plan',
        category: 'Weekly execution consistency',
        long_term_goal: 'Protect focus time',
      });

    const createdTask = await createTask({
      title: 'Planner Block',
      objective: 'Lock the weekly plan',
      category: 'Weekly execution consistency',
      long_term_goal: 'Protect focus time',
      priority: 3,
      estimated_hours: 1,
    });

    assert.equal(createdTask.id, 17);
  } finally {
    global.fetch = originalFetch;
  }
});

test('createTask fails clearly when POST /tasks returns no usable id', async () => {
  const originalFetch = global.fetch;

  try {
    global.fetch = async () =>
      createJsonResponse({
        title: 'Planner Block',
        objective: 'Lock the weekly plan',
        category: 'Weekly execution consistency',
        long_term_goal: 'Protect focus time',
      });

    await assert.rejects(
      createTask({
        title: 'Planner Block',
        objective: 'Lock the weekly plan',
        category: 'Weekly execution consistency',
        long_term_goal: 'Protect focus time',
        priority: 3,
        estimated_hours: 1,
      }),
      /invalid task payload without id/i,
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('createTask recovers from GET /tasks when POST /tasks body is empty', async () => {
  const originalFetch = global.fetch;
  const calls = [];

  try {
    global.fetch = async (url) => {
      calls.push(String(url));

      if (String(url).endsWith('/tasks') && calls.length === 1) {
        return createJsonResponse({});
      }

      return createJsonResponse([
        {
          id: 21,
          title: 'Planner Block',
          objective: 'Lock the weekly plan',
          category: 'Weekly execution consistency',
          long_term_goal: 'Protect focus time',
          priority: 3,
          estimated_hours: 1,
        },
      ]);
    };

    const createdTask = await createTask({
      title: 'Planner Block',
      objective: 'Lock the weekly plan',
      category: 'Weekly execution consistency',
      long_term_goal: 'Protect focus time',
      priority: 3,
      estimated_hours: 1,
    });

    assert.equal(createdTask.id, 21);
    assert.equal(calls.length, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test('fetchGoalContextSettings loads remote backend settings by default', async () => {
  const originalFetch = global.fetch;

  try {
    global.fetch = async () =>
      createJsonResponse({
        category_goals: {
          Focus: ['Protect deep work'],
        },
        categories: ['Focus'],
        goals: ['Protect deep work'],
        updated_at: null,
      });

    const result = await fetchGoalContextSettings('https://weekly-time-tracker.onrender.com');
    assert.deepEqual(result, {
      category_goals: {
        Focus: ['Protect deep work'],
      },
      categories: ['Focus'],
      goals: ['Protect deep work'],
      updated_at: null,
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('deleteSession trims trailing slashes from the configured API base URL', async () => {
  const originalFetch = global.fetch;
  const calls = [];

  try {
    global.fetch = async (url) => {
      calls.push(String(url));
      return createJsonResponse({ deleted: true, session_id: 22 });
    };

    await deleteSession(22, 'http://localhost:8000///');

    assert.deepEqual(calls, ['http://localhost:8000/sessions/22']);
  } finally {
    global.fetch = originalFetch;
  }
});

test('deleteSession retries the legacy singular route after a generic 404', async () => {
  const originalFetch = global.fetch;
  const calls = [];

  try {
    global.fetch = async (url) => {
      calls.push(String(url));

      if (calls.length === 1) {
        return createJsonResponse({ detail: 'Not Found' }, 404);
      }

      return createJsonResponse({ deleted: true, session_id: 31 });
    };

    const result = await deleteSession(31, 'http://localhost:8000');

    assert.equal(result.deleted, true);
    assert.deepEqual(calls, [
      'http://localhost:8000/sessions/31',
      'http://localhost:8000/session/31',
    ]);
  } finally {
    global.fetch = originalFetch;
  }
});

test('fetchCurrentUser sends the bearer token after auth is configured', async () => {
  const originalFetch = global.fetch;
  const calls = [];

  try {
    setApiAuthToken('token-123');
    global.fetch = async (url, init) => {
      calls.push({
        url: String(url),
        authorization:
          init?.headers?.Authorization ?? init?.headers?.authorization ?? null,
      });
      return createJsonResponse({
        id: 7,
        name: 'Operator',
        email: 'operator@example.com',
      });
    };

    const profile = await fetchCurrentUser('https://weekly-time-tracker.onrender.com');

    assert.equal(profile.id, 7);
    assert.deepEqual(calls, [
      {
        url: 'https://weekly-time-tracker.onrender.com/auth/me',
        authorization: 'Bearer token-123',
      },
    ]);
  } finally {
    clearApiAuthToken();
    global.fetch = originalFetch;
  }
});

test('fetchPendingSyncEvents returns the remote sync event list', async () => {
  const originalFetch = global.fetch;

  try {
    setApiAuthToken('token-123');
    global.fetch = async () =>
      createJsonResponse([
        { id: 11, entity_type: 'session', entity_id: 4, action: 'update' },
      ]);

    const pendingEvents = await fetchPendingSyncEvents(
      'https://weekly-time-tracker.onrender.com',
    );

    assert.deepEqual(pendingEvents, [
      { id: 11, entity_type: 'session', entity_id: 4, action: 'update' },
    ]);
  } finally {
    clearApiAuthToken();
    global.fetch = originalFetch;
  }
});
