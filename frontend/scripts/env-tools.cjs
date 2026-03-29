const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..');

function parseDotenv(content) {
  const values = {};

  for (const rawLine of String(content || '').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const normalizedLine = line.startsWith('export ') ? line.slice(7).trim() : line;
    const separatorIndex = normalizedLine.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }

    let value = normalizedLine.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return parseDotenv(fs.readFileSync(filePath, 'utf8'));
}

function loadProjectEnv(overrides = {}) {
  const env = {};
  const envFiles = [
    path.join(repoRoot, '.env'),
    path.join(repoRoot, '.env.local'),
    path.join(frontendRoot, '.env'),
    path.join(frontendRoot, '.env.local'),
  ];

  for (const filePath of envFiles) {
    Object.assign(env, loadEnvFile(filePath));
  }

  return {
    ...env,
    ...process.env,
    ...overrides,
  };
}

function normalizeBaseUrl(value) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized.replace(/\/+$/, '') : '';
}

function isLocalApiBaseUrl(value) {
  const normalized = normalizeBaseUrl(value);
  if (!normalized) {
    return false;
  }

  try {
    const hostname = new URL(normalized).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return /localhost|127\.0\.0\.1/i.test(normalized);
  }
}

function resolveDesktopApiBaseUrl(env) {
  return normalizeBaseUrl(
    env.DESKTOP_API_BASE_URL ||
      env.ELECTRON_API_BASE_URL ||
      env.EXPO_PUBLIC_API_BASE_URL,
  );
}

function assertDesktopApiBaseUrl(apiBaseUrl, { allowLocal = false } = {}) {
  if (!apiBaseUrl) {
    throw new Error(
      'Desktop packaging requires DESKTOP_API_BASE_URL, ELECTRON_API_BASE_URL, or EXPO_PUBLIC_API_BASE_URL.',
    );
  }

  if (!allowLocal && isLocalApiBaseUrl(apiBaseUrl)) {
    throw new Error(
      `Desktop packaging refuses to ship a localhost backend URL (${apiBaseUrl}). Set DESKTOP_API_BASE_URL to your deployed backend or set ALLOW_LOCAL_DESKTOP_API=true when you really want a local-only desktop build.`,
    );
  }

  return apiBaseUrl;
}

function writeJsonFile(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function runLocalBinary(binaryName, args, { cwd = frontendRoot, env = process.env } = {}) {
  const binName =
    process.platform === 'win32' ? `${binaryName}.cmd` : binaryName;
  const binaryPath = path.join(frontendRoot, 'node_modules', '.bin', binName);
  const command = fs.existsSync(binaryPath) ? binaryPath : binaryName;
  const useShell =
    process.platform === 'win32' && String(command).toLowerCase().endsWith('.cmd');
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: useShell,
  });

  if (typeof result.status === 'number') {
    return result.status;
  }

  if (result.error) {
    throw result.error;
  }

  return 1;
}

module.exports = {
  assertDesktopApiBaseUrl,
  frontendRoot,
  isLocalApiBaseUrl,
  loadProjectEnv,
  normalizeBaseUrl,
  repoRoot,
  resolveDesktopApiBaseUrl,
  runLocalBinary,
  writeJsonFile,
};
