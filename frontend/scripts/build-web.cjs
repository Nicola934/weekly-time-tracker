const fs = require('fs');
const path = require('path');

const { frontendRoot, loadProjectEnv, runLocalBinary } = require('./env-tools.cjs');

function runBuildWeb(overrides = {}) {
  const env = loadProjectEnv(overrides);
  fs.rmSync(path.join(frontendRoot, 'dist'), { force: true, recursive: true });
  return runLocalBinary(
    'expo',
    ['export', '--clear', '--platform', 'web', '--output-dir', 'dist'],
    { cwd: frontendRoot, env },
  );
}

if (require.main === module) {
  process.exit(runBuildWeb());
}

module.exports = {
  runBuildWeb,
};
