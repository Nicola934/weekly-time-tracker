const fs = require('fs');
const path = require('path');
const { contextBridge } = require('electron');

const RUNTIME_CONFIG_WINDOW_KEY = '__LIONYX_E_RUNTIME_CONFIG__';

function normalizeBaseUrl(value) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized.replace(/\/+$/, '') : '';
}

function readJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    console.error('[electron] failed to read runtime config', {
      filePath,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function resolveRuntimeConfig() {
  const envApiBaseUrl = normalizeBaseUrl(
    process.env.DESKTOP_API_BASE_URL ||
      process.env.ELECTRON_API_BASE_URL ||
      process.env.EXPO_PUBLIC_API_BASE_URL,
  );

  if (process.env.ELECTRON_START_URL) {
    return {
      apiBaseUrl: envApiBaseUrl || null,
      source: envApiBaseUrl ? 'electron-dev-env' : 'electron-dev-default',
    };
  }

  const packagedRuntimeConfig = readJsonFile(
    path.join(__dirname, '..', 'dist', 'runtime-config.json'),
  );
  const packagedApiBaseUrl = normalizeBaseUrl(packagedRuntimeConfig?.apiBaseUrl);

  if (packagedApiBaseUrl) {
    return {
      apiBaseUrl: packagedApiBaseUrl,
      source: 'desktop-runtime-file',
    };
  }

  if (envApiBaseUrl) {
    return {
      apiBaseUrl: envApiBaseUrl,
      source: 'electron-env',
    };
  }

  return {
    apiBaseUrl: null,
    source: 'unconfigured',
  };
}

contextBridge.exposeInMainWorld(
  RUNTIME_CONFIG_WINDOW_KEY,
  Object.freeze(resolveRuntimeConfig()),
);
