import { resolveApiBaseUrl, resolveApiRuntimeConfig } from './runtimeConfig.js';

const DEFAULT_API_RUNTIME_CONFIG = resolveApiRuntimeConfig();

export const DEFAULT_API_BASE_URL = resolveApiBaseUrl();
const API_LOG_PREFIX = '[api]';
const STARTUP_RETRY_DELAYS_MS = [2000, 4000, 8000];
const DEFAULT_STARTUP_TIMEOUT_MS = 15000;
const DEFAULT_GOAL_CONTEXT_SETTINGS = {
  category_goals: {},
  categories: [],
  goals: [],
  updated_at: null,
};
const ENABLE_REMOTE_GOAL_CONTEXT_SETTINGS =
  process.env.EXPO_PUBLIC_ENABLE_REMOTE_GOAL_CONTEXT_SETTINGS !== 'false';
let apiInitLogged = false;
const skippedGoalContextBaseUrls = new Set();
let currentAuthToken = null;

function normalizeBaseUrl(baseUrl) {
  const normalized = String(baseUrl ?? DEFAULT_API_BASE_URL).trim();
  if (!normalized) {
    return DEFAULT_API_BASE_URL;
  }

  return normalized.replace(/\/+$/, '');
}

function logApiInfo(message, details) {
  if (details) {
    console.info(`${API_LOG_PREFIX} ${message}`, details);
    return;
  }

  console.info(`${API_LOG_PREFIX} ${message}`);
}

function logApiError(message, error, details) {
  if (details) {
    console.error(`${API_LOG_PREFIX} ${message}`, details, error);
    return;
  }

  console.error(`${API_LOG_PREFIX} ${message}`, error);
}

function ensureApiInitLogged(baseUrl) {
  if (apiInitLogged) {
    return;
  }

  apiInitLogged = true;
  logApiInfo('init', {
    baseUrl,
    source: DEFAULT_API_RUNTIME_CONFIG.source,
  });
}

function normalizeHeaders(existingHeaders) {
  const headers = {};

  if (existingHeaders instanceof Headers) {
    for (const [key, value] of existingHeaders.entries()) {
      headers[key] = value;
    }
  } else if (Array.isArray(existingHeaders)) {
    for (const [key, value] of existingHeaders) {
      headers[key] = value;
    }
  } else if (existingHeaders && typeof existingHeaders === 'object') {
    Object.assign(headers, existingHeaders);
  }

  if (currentAuthToken) {
    headers.Authorization = `Bearer ${currentAuthToken}`;
  }

  return headers;
}

function withAuthInit(init) {
  if (!currentAuthToken) {
    return init;
  }

  return {
    ...(init || {}),
    headers: normalizeHeaders(init?.headers),
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildApiError(
  message,
  {
    category = 'network error',
    detail = null,
    status = null,
    url = null,
    method = 'GET',
    baseUrl = DEFAULT_API_BASE_URL,
    cause,
  } = {},
) {
  const error = new Error(
    detail ? `${message} (${category}): ${detail}` : `${message} (${category})`,
  );
  error.category = category;
  error.detail = detail;
  error.status = Number.isFinite(Number(status)) ? Number(status) : null;
  error.url = url;
  error.method = method;
  error.baseUrl = baseUrl;

  if (typeof cause !== 'undefined') {
    error.cause = cause;
  }

  return error;
}

function classifyFetchError(error) {
  const message =
    error instanceof Error && typeof error.message === 'string'
      ? error.message.toLowerCase()
      : '';

  if (
    (error instanceof Error && error.name === 'AbortError') ||
    message.includes('timeout')
  ) {
    return 'timeout';
  }

  if (
    error instanceof TypeError ||
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('load failed')
  ) {
    return 'network error';
  }

  return 'network error';
}

function resolveFetchErrorDetail(error) {
  if (error instanceof Error && error.name === 'AbortError') {
    return 'Request timed out';
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Backend unavailable';
}

function resolveResponseDetail(payload, response) {
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim();
  }

  if (typeof payload?.detail === 'string' && payload.detail.trim()) {
    return payload.detail.trim();
  }

  if (typeof payload?.message === 'string' && payload.message.trim()) {
    return payload.message.trim();
  }

  return `HTTP ${response.status}`;
}

function createRequestInit(init, timeoutMs) {
  if (
    !Number.isFinite(Number(timeoutMs)) ||
    Number(timeoutMs) <= 0 ||
    typeof AbortController !== 'function' ||
    init?.signal
  ) {
    return {
      requestInit: init,
      cleanup: () => undefined,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Number(timeoutMs));

  return {
    requestInit: {
      ...init,
      signal: controller.signal,
    },
    cleanup: () => clearTimeout(timeoutId),
  };
}

function normalizePositiveId(value) {
  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

function describePayloadShape(payload) {
  if (payload === null) {
    return 'null';
  }

  if (typeof payload === 'undefined') {
    return 'undefined';
  }

  if (Array.isArray(payload)) {
    return `array(length=${payload.length})`;
  }

  if (typeof payload !== 'object') {
    return typeof payload;
  }

  const keys = Object.keys(payload).sort();
  return keys.length > 0 ? `object keys: ${keys.join(', ')}` : 'object with no keys';
}

export function setApiAuthToken(token) {
  const normalizedToken = String(token || '').trim();
  currentAuthToken = normalizedToken || null;
}

export function clearApiAuthToken() {
  currentAuthToken = null;
}

function extractCreatedTaskId(response) {
  return normalizePositiveId(response?.id);
}

function parseResponsePayload(responseText, contentType) {
  const normalizedText = typeof responseText === 'string' ? responseText.trim() : '';
  if (!normalizedText) {
    return null;
  }

  const shouldParseJson =
    String(contentType || '').toLowerCase().includes('application/json') ||
    normalizedText.startsWith('{') ||
    normalizedText.startsWith('[');

  if (shouldParseJson) {
    try {
      return JSON.parse(normalizedText);
    } catch {
      return responseText;
    }
  }

  return responseText;
}

function buildCreatedTaskRecord(payload, extractedTaskId) {
  return {
    id: extractedTaskId,
    title: typeof payload?.title === 'string' ? payload.title : '',
    objective: typeof payload?.objective === 'string' ? payload.objective : '',
    long_term_goal:
      typeof payload?.long_term_goal === 'string' ? payload.long_term_goal : '',
    priority: Number.isFinite(Number(payload?.priority))
      ? Number(payload.priority)
      : 3,
    estimated_hours: Number.isFinite(Number(payload?.estimated_hours))
      ? Number(payload.estimated_hours)
      : 0,
    category: typeof payload?.category === 'string' ? payload.category : '',
  };
}

function isLocalApiBaseUrl(baseUrl) {
  try {
    const hostname = new URL(baseUrl).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return /localhost|127\.0\.0\.1/i.test(String(baseUrl || ''));
  }
}

function findCreatedTaskMatch(tasks, payload) {
  const normalizedPayload = {
    title: String(payload?.title || '').trim(),
    objective: String(payload?.objective || '').trim(),
    category: String(payload?.category || '').trim(),
    longTermGoal: String(payload?.long_term_goal || '').trim(),
  };

  const exactMatches = tasks
    .filter((task) => {
      if (!task || typeof task !== 'object') {
        return false;
      }

      return (
        String(task.title || '').trim() === normalizedPayload.title &&
        String(task.objective || '').trim() === normalizedPayload.objective &&
        String(task.category || '').trim() === normalizedPayload.category &&
        String(task.long_term_goal || '').trim() === normalizedPayload.longTermGoal
      );
    })
    .sort(
      (left, right) =>
        Number(right?.id || 0) - Number(left?.id || 0),
    );

  if (exactMatches.length > 0) {
    return exactMatches[0];
  }

  const titleObjectiveMatches = tasks
    .filter((task) => {
      if (!task || typeof task !== 'object') {
        return false;
      }

      return (
        String(task.title || '').trim() === normalizedPayload.title &&
        String(task.objective || '').trim() === normalizedPayload.objective
      );
    })
    .sort(
      (left, right) =>
        Number(right?.id || 0) - Number(left?.id || 0),
    );

  return titleObjectiveMatches[0] ?? null;
}

function normalizeSession(session) {
  if (!session || typeof session !== 'object') {
    return session;
  }

  return {
    ...session,
    objective: typeof session.objective === 'string' ? session.objective : null,
    goal_context:
      typeof session.goal_context === 'string' ? session.goal_context : null,
    objective_completed: session.objective_completed === true,
    objective_locked: session.objective_locked === true,
    reflection_notes:
      typeof session.reflection_notes === 'string' ? session.reflection_notes : '',
    failure_reason:
      typeof session.failure_reason === 'string' ? session.failure_reason : null,
    failure_reason_detail:
      typeof session.failure_reason_detail === 'string'
        ? session.failure_reason_detail
        : null,
    distraction_category:
      typeof session.distraction_category === 'string'
        ? session.distraction_category
        : null,
    start_delta_minutes:
      Number.isFinite(Number(session.start_delta_minutes))
        ? Number(session.start_delta_minutes)
        : null,
    quality_score:
      Number.isFinite(Number(session.quality_score))
        ? Number(session.quality_score)
        : 0,
    quality_label:
      typeof session.quality_label === 'string' ? session.quality_label : 'Failed',
  };
}

function normalizeTask(task) {
  if (!task || typeof task !== 'object') {
    return task;
  }

  const normalizedId = normalizePositiveId(task.id);

  return {
    ...task,
    id: normalizedId,
    category: typeof task.category === 'string' ? task.category : '',
    long_term_goal:
      typeof task.long_term_goal === 'string' ? task.long_term_goal : '',
  };
}

async function parseJson(
  response,
  {
    message,
    url,
    method,
    baseUrl,
    debugResponseBodyLabel = null,
  },
) {
  const contentType = response.headers.get('content-type') || '';
  const responseText = await response.text().catch(() => '');

  if (debugResponseBodyLabel) {
    logApiInfo(`${debugResponseBodyLabel} raw response`, {
      status: response.status,
      contentType,
      responseText,
    });
  }

  const payload = parseResponsePayload(responseText, contentType);

  if (!response.ok) {
    throw buildApiError(message, {
      category: 'non-200',
      detail: resolveResponseDetail(payload, response),
      status: response.status,
      url,
      method,
      baseUrl,
    });
  }

  return payload;
}

async function requestJson(
  path,
  {
    baseUrl = DEFAULT_API_BASE_URL,
    init,
    message,
    retryDelaysMs = [],
    timeoutMs,
    debugResponseBodyLabel,
  } = {},
) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  ensureApiInitLogged(normalizedBaseUrl);
  const url = `${normalizedBaseUrl}${path}`;
  const method = init?.method || 'GET';
  const totalAttempts = retryDelaysMs.length + 1;
  let lastError = null;

  for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
    logApiInfo('request', {
      method,
      url,
      attempt: attempt + 1,
      totalAttempts,
    });

    const { requestInit, cleanup } = createRequestInit(
      withAuthInit(init),
      timeoutMs,
    );

    try {
      const response = await fetch(url, requestInit);
      cleanup();
      return await parseJson(response, {
        message,
        url,
        method,
        baseUrl: normalizedBaseUrl,
        debugResponseBodyLabel,
      });
    } catch (nextError) {
      cleanup();

      const error =
        nextError instanceof Error && typeof nextError.category === 'string'
          ? nextError
          : buildApiError(message, {
              category: classifyFetchError(nextError),
              detail: resolveFetchErrorDetail(nextError),
              url,
              method,
              baseUrl: normalizedBaseUrl,
              cause: nextError,
            });

      lastError = error;
      logApiError(
        attempt < totalAttempts - 1 ? 'request attempt failed' : 'request failed',
        error,
        {
          method,
          url,
          attempt: attempt + 1,
          totalAttempts,
          category: error.category,
          status: error.status ?? null,
        },
      );

      if (attempt >= totalAttempts - 1) {
        throw error;
      }

      const delayMs = retryDelaysMs[attempt];
      logApiInfo('request retry scheduled', {
        method,
        url,
        nextAttempt: attempt + 2,
        totalAttempts,
        delayMs,
        category: error.category,
      });
      await delay(delayMs);
    }
  }

  throw lastError;
}

export async function fetchHealth(baseUrl = DEFAULT_API_BASE_URL) {
  return requestJson('/health', {
    baseUrl,
    message: 'Backend health check failed',
    retryDelaysMs: STARTUP_RETRY_DELAYS_MS,
    timeoutMs: DEFAULT_STARTUP_TIMEOUT_MS,
  });
}

export async function registerUser(payload, baseUrl = DEFAULT_API_BASE_URL) {
  return requestJson('/auth/register', {
    baseUrl,
    message: 'Failed to register account',
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  });
}

export async function loginUser(payload, baseUrl = DEFAULT_API_BASE_URL) {
  return requestJson('/auth/login', {
    baseUrl,
    message: 'Failed to sign in',
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  });
}

export async function fetchCurrentUser(baseUrl = DEFAULT_API_BASE_URL) {
  return requestJson('/auth/me', {
    baseUrl,
    message: 'Failed to load account profile',
  });
}

export async function fetchNotificationConfig(baseUrl = DEFAULT_API_BASE_URL) {
  return requestJson('/notifications/templates', {
    baseUrl,
    message: 'Failed to load notification config',
  });
}

export async function fetchSessions(baseUrl = DEFAULT_API_BASE_URL) {
  const payload = await requestJson('/sessions', {
    baseUrl,
    message: 'Failed to load sessions',
    retryDelaysMs: STARTUP_RETRY_DELAYS_MS,
    timeoutMs: DEFAULT_STARTUP_TIMEOUT_MS,
  });
  return Array.isArray(payload) ? payload.map(normalizeSession) : [];
}

export async function fetchTasks(baseUrl = DEFAULT_API_BASE_URL) {
  const payload = await requestJson('/tasks', {
    baseUrl,
    message: 'Failed to load tasks',
    retryDelaysMs: STARTUP_RETRY_DELAYS_MS,
    timeoutMs: DEFAULT_STARTUP_TIMEOUT_MS,
  });
  return Array.isArray(payload) ? payload.map(normalizeTask) : [];
}

export async function fetchGoalContextSettings(baseUrl = DEFAULT_API_BASE_URL) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  if (skippedGoalContextBaseUrls.has(normalizedBaseUrl)) {
    return DEFAULT_GOAL_CONTEXT_SETTINGS;
  }

  if (
    !ENABLE_REMOTE_GOAL_CONTEXT_SETTINGS &&
    !isLocalApiBaseUrl(normalizedBaseUrl)
  ) {
    skippedGoalContextBaseUrls.add(normalizedBaseUrl);
    logApiInfo('goal context settings skipped for remote backend', {
      baseUrl: normalizedBaseUrl,
    });
    return DEFAULT_GOAL_CONTEXT_SETTINGS;
  }

  ensureApiInitLogged(normalizedBaseUrl);
  const url = `${normalizedBaseUrl}/settings/goal-context`;
  const method = 'GET';
  logApiInfo('request', {
    method,
    url,
    attempt: 1,
    totalAttempts: 1,
  });

  try {
    const response = await fetch(url, {
      headers: normalizeHeaders(),
    });
    const contentType = response.headers.get('content-type') || '';
    const responseText = await response.text().catch(() => '');
    const payload = parseResponsePayload(responseText, contentType);

    if (response.status === 404) {
      skippedGoalContextBaseUrls.add(normalizedBaseUrl);
      logApiInfo('goal context settings unavailable, using defaults', {
        status: response.status,
        url,
      });
      return DEFAULT_GOAL_CONTEXT_SETTINGS;
    }

    if (!response.ok) {
      throw buildApiError('Failed to load goal context settings', {
        category: 'non-200',
        detail: resolveResponseDetail(payload, response),
        status: response.status,
        url,
        method,
        baseUrl: normalizedBaseUrl,
      });
    }

    return payload ?? DEFAULT_GOAL_CONTEXT_SETTINGS;
  } catch (nextError) {
    const error =
      nextError instanceof Error && typeof nextError.category === 'string'
        ? nextError
        : buildApiError('Failed to load goal context settings', {
            category: classifyFetchError(nextError),
            detail: resolveFetchErrorDetail(nextError),
            url,
            method,
            baseUrl: normalizedBaseUrl,
            cause: nextError,
          });

    logApiError('request failed', error, {
      method,
      url,
      attempt: 1,
      totalAttempts: 1,
      category: error.category,
      status: error.status ?? null,
    });
    throw error;
  }
}

export async function fetchHabits(baseUrl = DEFAULT_API_BASE_URL) {
  return requestJson('/habits', {
    baseUrl,
    message: 'Failed to load habits',
  });
}

export async function fetchWeeklyReport(
  { start, end } = {},
  baseUrl = DEFAULT_API_BASE_URL,
) {
  const params = [];
  if (start) {
    params.push(`start=${encodeURIComponent(start)}`);
  }
  if (end) {
    params.push(`end=${encodeURIComponent(end)}`);
  }

  const query = params.length > 0 ? `?${params.join('&')}` : '';
  return requestJson(`/reports/weekly/json${query}`, {
    baseUrl,
    message: 'Failed to load weekly report',
  });
}

export async function createTask(payload, baseUrl = DEFAULT_API_BASE_URL) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  ensureApiInitLogged(normalizedBaseUrl);
  const url = `${normalizedBaseUrl}/tasks`;
  const method = 'POST';
  const init = {
    method,
    headers: normalizeHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  };

  logApiInfo('request', {
    method,
    url,
    attempt: 1,
    totalAttempts: 1,
  });

  const { requestInit, cleanup } = createRequestInit(init);

  try {
    const response = await fetch(url, requestInit);
    cleanup();

    const contentType = response.headers.get('content-type') || '';
    const responseText = await response.text().catch(() => '');

    logApiInfo('createTask raw response', {
      status: response.status,
      contentType,
      responseText,
    });

    const parsedCreateTaskResponse = parseResponsePayload(responseText, contentType);

    logApiInfo('createTask parsed payload', {
      parsedCreateTaskResponse,
    });

    if (!response.ok) {
      throw buildApiError('Failed to create task', {
        category: 'non-200',
        detail: resolveResponseDetail(parsedCreateTaskResponse, response),
        status: response.status,
        url,
        method,
        baseUrl: normalizedBaseUrl,
      });
    }

    const extractedTaskId = extractCreatedTaskId(parsedCreateTaskResponse);
    logApiInfo('createTask response', {
      rawCreateTaskResponse: parsedCreateTaskResponse,
      extractedTaskId,
    });

    if (extractedTaskId === null) {
      logApiInfo('createTask payload missing id, attempting recovery from tasks list', {
        rawCreateTaskResponse: parsedCreateTaskResponse,
      });

      const latestTasks = await fetchTasks(normalizedBaseUrl);
      const recoveredTask = findCreatedTaskMatch(latestTasks, payload);

      if (recoveredTask?.id) {
        logApiInfo('createTask recovered from tasks list', {
          recoveredTask,
        });
        return recoveredTask;
      }

      const detail =
        `POST /tasks returned an invalid task payload without id. ` +
        `Response shape: ${describePayloadShape(parsedCreateTaskResponse)}`;
      const error = buildApiError('Failed to create task', {
        category: 'invalid payload',
        detail,
        url,
        method,
        baseUrl: normalizedBaseUrl,
      });

      logApiError('createTask invalid payload', error, {
        rawCreateTaskResponse: parsedCreateTaskResponse,
        latestTasks,
      });
      throw error;
    }

    return normalizeTask(
      buildCreatedTaskRecord(parsedCreateTaskResponse, extractedTaskId),
    );
  } catch (nextError) {
    cleanup();

    const error =
      nextError instanceof Error && typeof nextError.category === 'string'
        ? nextError
        : buildApiError('Failed to create task', {
            category: classifyFetchError(nextError),
            detail: resolveFetchErrorDetail(nextError),
            url,
            method,
            baseUrl: normalizedBaseUrl,
            cause: nextError,
          });

    if (error.category !== 'invalid payload') {
      logApiError('request failed', error, {
        method,
        url,
        attempt: 1,
        totalAttempts: 1,
        category: error.category,
        status: error.status ?? null,
      });
    }
    throw error;
  }
}

export async function createSchedule(payload, baseUrl = DEFAULT_API_BASE_URL) {
  return requestJson('/schedule', {
    baseUrl,
    message: 'Failed to create schedule block',
    init: {
      method: 'POST',
      headers: normalizeHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    },
  });
}

export async function startSession(payload, baseUrl = DEFAULT_API_BASE_URL) {
  return normalizeSession(
    await requestJson('/sessions/start', {
      baseUrl,
      message: 'Failed to start session',
      init: {
        method: 'POST',
        headers: normalizeHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      },
    }),
  );
}

export async function endSession(payload, baseUrl = DEFAULT_API_BASE_URL) {
  return normalizeSession(
    await requestJson('/sessions/end', {
      baseUrl,
      message: 'Failed to end session',
      init: {
        method: 'POST',
        headers: normalizeHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      },
    }),
  );
}

export async function deleteSession(sessionId, baseUrl = DEFAULT_API_BASE_URL) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const normalizedSessionId = normalizePositiveId(sessionId);

  if (normalizedSessionId === null) {
    throw buildApiError('Failed to delete session', {
      category: 'invalid payload',
      detail: 'Session id is missing or invalid',
      method: 'DELETE',
      baseUrl: normalizedBaseUrl,
      url: `${normalizedBaseUrl}/sessions/${sessionId}`,
    });
  }

  try {
    return await requestJson(`/sessions/${normalizedSessionId}`, {
      baseUrl: normalizedBaseUrl,
      message: 'Failed to delete session',
      init: {
        method: 'DELETE',
      },
    });
  } catch (nextError) {
    const detail = String(nextError?.detail || '').trim().toLowerCase();
    const shouldRetryLegacyDeleteRoute =
      nextError?.status === 404 &&
      (!detail || detail === 'not found' || detail === 'http 404');

    if (!shouldRetryLegacyDeleteRoute) {
      throw nextError;
    }

    logApiInfo('delete session retrying legacy route', {
      sessionId: normalizedSessionId,
      baseUrl: normalizedBaseUrl,
    });

    return requestJson(`/session/${normalizedSessionId}`, {
      baseUrl: normalizedBaseUrl,
      message: 'Failed to delete session',
      init: {
        method: 'DELETE',
      },
    });
  }
}

export async function updateSession(
  sessionId,
  payload,
  baseUrl = DEFAULT_API_BASE_URL,
) {
  return normalizeSession(
    await requestJson(`/sessions/${sessionId}`, {
      baseUrl,
      message: 'Failed to update session',
      init: {
        method: 'PUT',
        headers: normalizeHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      },
    }),
  );
}

export async function markSessionMissed(payload, baseUrl = DEFAULT_API_BASE_URL) {
  return requestJson('/sessions/missed', {
    baseUrl,
    message: 'Failed to mark session missed',
    init: {
      method: 'POST',
      headers: normalizeHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    },
  });
}
