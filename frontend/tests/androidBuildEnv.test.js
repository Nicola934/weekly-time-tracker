import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const testsRoot = path.dirname(currentFilePath);
const frontendRoot = path.resolve(testsRoot, '..');

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8'),
  );
}

test('apk build profile pins the production backend url', () => {
  const easConfig = readJson('eas.json');

  assert.equal(
    easConfig?.build?.apk?.env?.EXPO_PUBLIC_API_BASE_URL,
    'https://weekly-time-tracker.onrender.com',
  );
});

test('android release metadata advances past the broken v1 apk', () => {
  const appConfig = readJson('app.json');

  assert.equal(appConfig?.expo?.version, '0.2.0');
  assert.equal(appConfig?.expo?.android?.versionCode, 2);
});
