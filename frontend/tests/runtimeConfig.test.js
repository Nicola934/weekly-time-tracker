import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveApiRuntimeConfig } from '../services/runtimeConfig.js';

function restoreGlobalWindow(originalWindow) {
  if (typeof originalWindow === 'undefined') {
    delete global.window;
    return;
  }

  global.window = originalWindow;
}

test('resolveApiRuntimeConfig prefers the Electron runtime override', () => {
  const originalWindow = global.window;
  const originalApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  try {
    global.window = {
      __LIONYX_E_RUNTIME_CONFIG__: {
        apiBaseUrl: 'https://weekly-time-tracker.onrender.com/',
        source: 'desktop-runtime-file',
      },
    };
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://env.example.com';

    assert.deepEqual(resolveApiRuntimeConfig(), {
      apiBaseUrl: 'https://weekly-time-tracker.onrender.com',
      source: 'desktop-runtime-file',
    });
  } finally {
    restoreGlobalWindow(originalWindow);

    if (typeof originalApiBaseUrl === 'undefined') {
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }
  }
});

test('resolveApiRuntimeConfig falls back to the Expo public env', () => {
  const originalWindow = global.window;
  const originalApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  try {
    delete global.window;
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://weekly-time-tracker.onrender.com/';

    assert.deepEqual(resolveApiRuntimeConfig(), {
      apiBaseUrl: 'https://weekly-time-tracker.onrender.com',
      source: 'expo-public-env',
    });
  } finally {
    restoreGlobalWindow(originalWindow);

    if (typeof originalApiBaseUrl === 'undefined') {
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }
  }
});

test('resolveApiRuntimeConfig falls back to localhost only when nothing else is configured', () => {
  const originalWindow = global.window;
  const originalApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  try {
    delete global.window;
    delete process.env.EXPO_PUBLIC_API_BASE_URL;

    assert.deepEqual(resolveApiRuntimeConfig(), {
      apiBaseUrl: 'http://localhost:8000',
      source: 'local-default',
    });
  } finally {
    restoreGlobalWindow(originalWindow);

    if (typeof originalApiBaseUrl === 'undefined') {
      delete process.env.EXPO_PUBLIC_API_BASE_URL;
    } else {
      process.env.EXPO_PUBLIC_API_BASE_URL = originalApiBaseUrl;
    }
  }
});
