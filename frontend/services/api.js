<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
export const DEFAULT_API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000';
=======
export const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000';
>>>>>>> theirs
=======
export const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000';
>>>>>>> theirs
=======
export const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000';
>>>>>>> theirs
=======
export const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000';
>>>>>>> theirs
=======
export const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000';
>>>>>>> theirs
=======
export const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000';
>>>>>>> theirs
=======
export const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000';
>>>>>>> theirs
=======
export const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000';
>>>>>>> theirs
=======
export const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000';
>>>>>>> theirs
=======
export const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000';
>>>>>>> theirs
=======
export const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000';
>>>>>>> theirs
=======
export const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000';
>>>>>>> theirs
=======
export const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000';
>>>>>>> theirs

async function parseJson(response, message) {
  if (!response.ok) {
    throw new Error(`${message}: ${response.status}`);
  }
  return response.json();
}

export async function fetchHealth(baseUrl = DEFAULT_API_BASE_URL) {
  return parseJson(await fetch(`${baseUrl}/health`), 'Backend health check failed');
}

export async function fetchNotificationConfig(baseUrl = DEFAULT_API_BASE_URL) {
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
  return parseJson(
    await fetch(`${baseUrl}/notifications/templates`),
    'Failed to load notification config'
  );
=======
  return parseJson(await fetch(`${baseUrl}/notifications/templates`), 'Failed to load notification config');
>>>>>>> theirs
=======
  return parseJson(await fetch(`${baseUrl}/notifications/templates`), 'Failed to load notification config');
>>>>>>> theirs
=======
  return parseJson(await fetch(`${baseUrl}/notifications/templates`), 'Failed to load notification config');
>>>>>>> theirs
=======
  return parseJson(await fetch(`${baseUrl}/notifications/templates`), 'Failed to load notification config');
>>>>>>> theirs
=======
  return parseJson(await fetch(`${baseUrl}/notifications/templates`), 'Failed to load notification config');
>>>>>>> theirs
=======
  return parseJson(await fetch(`${baseUrl}/notifications/templates`), 'Failed to load notification config');
>>>>>>> theirs
=======
  return parseJson(await fetch(`${baseUrl}/notifications/templates`), 'Failed to load notification config');
>>>>>>> theirs
=======
  return parseJson(await fetch(`${baseUrl}/notifications/templates`), 'Failed to load notification config');
>>>>>>> theirs
=======
  return parseJson(await fetch(`${baseUrl}/notifications/templates`), 'Failed to load notification config');
>>>>>>> theirs
=======
  return parseJson(await fetch(`${baseUrl}/notifications/templates`), 'Failed to load notification config');
>>>>>>> theirs
=======
  return parseJson(await fetch(`${baseUrl}/notifications/templates`), 'Failed to load notification config');
>>>>>>> theirs
=======
=======
>>>>>>> theirs
  return parseJson(
    await fetch(`${baseUrl}/notifications/templates`),
    'Failed to load notification config',
  );
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
}

export async function fetchSessions(baseUrl = DEFAULT_API_BASE_URL) {
  return parseJson(await fetch(`${baseUrl}/sessions`), 'Failed to load sessions');
}

export async function fetchTasks(baseUrl = DEFAULT_API_BASE_URL) {
  return parseJson(await fetch(`${baseUrl}/tasks`), 'Failed to load tasks');
}

export async function fetchHabits(baseUrl = DEFAULT_API_BASE_URL) {
  return parseJson(await fetch(`${baseUrl}/habits`), 'Failed to load habits');
}

<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
=======
>>>>>>> theirs
export async function createTask(payload, baseUrl = DEFAULT_API_BASE_URL) {
  return parseJson(
    await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    'Failed to create task',
  );
}

<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
export async function createSchedule(payload, baseUrl = DEFAULT_API_BASE_URL) {
  return parseJson(
    await fetch(`${baseUrl}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    'Failed to create schedule block',
  );
}

<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
export async function startSession(payload, baseUrl = DEFAULT_API_BASE_URL) {
  return parseJson(
    await fetch(`${baseUrl}/sessions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
    'Failed to start session'
=======
    'Failed to start session',
>>>>>>> theirs
=======
    'Failed to start session',
>>>>>>> theirs
=======
    'Failed to start session',
>>>>>>> theirs
=======
    'Failed to start session',
>>>>>>> theirs
=======
    'Failed to start session',
>>>>>>> theirs
=======
    'Failed to start session',
>>>>>>> theirs
=======
    'Failed to start session',
>>>>>>> theirs
=======
    'Failed to start session',
>>>>>>> theirs
=======
    'Failed to start session',
>>>>>>> theirs
=======
    'Failed to start session',
>>>>>>> theirs
=======
    'Failed to start session',
>>>>>>> theirs
=======
    'Failed to start session',
>>>>>>> theirs
=======
    'Failed to start session',
>>>>>>> theirs
  );
}

export async function endSession(payload, baseUrl = DEFAULT_API_BASE_URL) {
  return parseJson(
    await fetch(`${baseUrl}/sessions/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
    'Failed to end session'
=======
    'Failed to end session',
>>>>>>> theirs
=======
    'Failed to end session',
>>>>>>> theirs
=======
    'Failed to end session',
>>>>>>> theirs
=======
    'Failed to end session',
>>>>>>> theirs
=======
    'Failed to end session',
>>>>>>> theirs
=======
    'Failed to end session',
>>>>>>> theirs
=======
    'Failed to end session',
>>>>>>> theirs
=======
    'Failed to end session',
>>>>>>> theirs
=======
    'Failed to end session',
>>>>>>> theirs
=======
    'Failed to end session',
>>>>>>> theirs
=======
    'Failed to end session',
>>>>>>> theirs
=======
    'Failed to end session',
>>>>>>> theirs
=======
    'Failed to end session',
>>>>>>> theirs
  );
}

export async function markSessionMissed(payload, baseUrl = DEFAULT_API_BASE_URL) {
  return parseJson(
    await fetch(`${baseUrl}/sessions/missed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
    'Failed to mark session missed'
  );
}
=======
    'Failed to mark session missed',
  );
}
>>>>>>> theirs
=======
    'Failed to mark session missed',
  );
}
>>>>>>> theirs
=======
    'Failed to mark session missed',
  );
}
>>>>>>> theirs
=======
    'Failed to mark session missed',
  );
}
>>>>>>> theirs
=======
    'Failed to mark session missed',
  );
}
>>>>>>> theirs
=======
    'Failed to mark session missed',
  );
}
>>>>>>> theirs
=======
    'Failed to mark session missed',
  );
}
>>>>>>> theirs
=======
    'Failed to mark session missed',
  );
}
>>>>>>> theirs
=======
    'Failed to mark session missed',
  );
}
>>>>>>> theirs
=======
    'Failed to mark session missed',
  );
}
>>>>>>> theirs
=======
    'Failed to mark session missed',
  );
}
>>>>>>> theirs
=======
    'Failed to mark session missed',
  );
}
>>>>>>> theirs
=======
    'Failed to mark session missed',
  );
}
>>>>>>> theirs
