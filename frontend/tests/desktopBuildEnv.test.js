import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  assertDesktopApiBaseUrl,
  isLocalApiBaseUrl,
  resolveDesktopApiBaseUrl,
} = require('../scripts/env-tools.cjs');

test('resolveDesktopApiBaseUrl prefers the dedicated desktop override', () => {
  assert.equal(
    resolveDesktopApiBaseUrl({
      DESKTOP_API_BASE_URL: 'https://weekly-time-tracker.onrender.com/',
      EXPO_PUBLIC_API_BASE_URL: 'http://localhost:8000',
    }),
    'https://weekly-time-tracker.onrender.com',
  );
});

test('assertDesktopApiBaseUrl rejects localhost packages by default', () => {
  assert.throws(
    () => assertDesktopApiBaseUrl('http://localhost:8000'),
    /refuses to ship a localhost backend url/i,
  );
});

test('assertDesktopApiBaseUrl accepts localhost when explicitly allowed', () => {
  assert.equal(
    assertDesktopApiBaseUrl('http://localhost:8000', { allowLocal: true }),
    'http://localhost:8000',
  );
});

test('isLocalApiBaseUrl matches localhost and 127.0.0.1 only', () => {
  assert.equal(isLocalApiBaseUrl('http://localhost:8000'), true);
  assert.equal(isLocalApiBaseUrl('http://127.0.0.1:8000'), true);
  assert.equal(
    isLocalApiBaseUrl('https://weekly-time-tracker.onrender.com'),
    false,
  );
});
