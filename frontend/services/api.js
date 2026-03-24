export const DEFAULT_API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8000';

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
  return parseJson(
    await fetch(`${baseUrl}/notifications/templates`),
    'Failed to load notification config'
  );
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

export async function startSession(payload, baseUrl = DEFAULT_API_BASE_URL) {
  return parseJson(
    await fetch(`${baseUrl}/sessions/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    'Failed to start session'
  );
}

export async function endSession(payload, baseUrl = DEFAULT_API_BASE_URL) {
  return parseJson(
    await fetch(`${baseUrl}/sessions/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    'Failed to end session'
  );
}

export async function markSessionMissed(payload, baseUrl = DEFAULT_API_BASE_URL) {
  return parseJson(
    await fetch(`${baseUrl}/sessions/missed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    'Failed to mark session missed'
  );
}