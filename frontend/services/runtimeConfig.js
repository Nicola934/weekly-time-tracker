const LOCAL_API_BASE_URL = 'http://localhost:8000';
const RUNTIME_CONFIG_WINDOW_KEY = '__LIONYX_E_RUNTIME_CONFIG__';

function normalizeBaseUrl(value) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized.replace(/\/+$/, '') : '';
}

function readWindowRuntimeConfig() {
  if (typeof window === 'undefined') {
    return null;
  }

  const runtimeConfig = window[RUNTIME_CONFIG_WINDOW_KEY];
  if (!runtimeConfig || typeof runtimeConfig !== 'object') {
    return null;
  }

  return runtimeConfig;
}

export function resolveApiRuntimeConfig() {
  const runtimeConfig = readWindowRuntimeConfig();
  const runtimeApiBaseUrl = normalizeBaseUrl(runtimeConfig?.apiBaseUrl);
  if (runtimeApiBaseUrl) {
    return {
      apiBaseUrl: runtimeApiBaseUrl,
      source:
        typeof runtimeConfig.source === 'string' && runtimeConfig.source.trim()
          ? runtimeConfig.source.trim()
          : 'electron-runtime-config',
    };
  }

  const buildApiBaseUrl = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
  if (buildApiBaseUrl) {
    return {
      apiBaseUrl: buildApiBaseUrl,
      source: 'expo-public-env',
    };
  }

  return {
    apiBaseUrl: LOCAL_API_BASE_URL,
    source: 'local-default',
  };
}

export function resolveApiBaseUrl() {
  return resolveApiRuntimeConfig().apiBaseUrl;
}

export { LOCAL_API_BASE_URL, RUNTIME_CONFIG_WINDOW_KEY };
