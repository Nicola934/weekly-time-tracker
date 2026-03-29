import { createNotificationStorage } from './notificationState.js';

const AUTH_SESSION_KEY = 'weekly_execution_auth_session_v1';

export async function loadStoredAuthSession() {
  const storage = await createNotificationStorage();
  const raw = await storage.getItem(AUTH_SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.user?.id) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveStoredAuthSession(session) {
  const storage = await createNotificationStorage();
  await storage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function clearStoredAuthSession() {
  const storage = await createNotificationStorage();
  await storage.removeItem(AUTH_SESSION_KEY);
}
