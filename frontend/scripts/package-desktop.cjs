const path = require('path');

const {
  assertDesktopApiBaseUrl,
  frontendRoot,
  loadProjectEnv,
  resolveDesktopApiBaseUrl,
  runLocalBinary,
  writeJsonFile,
} = require('./env-tools.cjs');
const { runBuildWeb } = require('./build-web.cjs');

function writeDesktopRuntimeConfig(apiBaseUrl) {
  const runtimeConfigPath = path.join(frontendRoot, 'dist', 'runtime-config.json');

  writeJsonFile(runtimeConfigPath, {
    apiBaseUrl,
    source: 'desktop-package-script',
    generatedAt: new Date().toISOString(),
  });

  return runtimeConfigPath;
}

function packageDesktop({ validateOnly = false } = {}) {
  const projectEnv = loadProjectEnv();
  const allowLocalDesktopApi =
    String(projectEnv.ALLOW_LOCAL_DESKTOP_API || '').trim().toLowerCase() ===
    'true';
  const desktopApiBaseUrl = assertDesktopApiBaseUrl(
    resolveDesktopApiBaseUrl(projectEnv),
    { allowLocal: allowLocalDesktopApi },
  );
  const packagingEnv = loadProjectEnv({
    DESKTOP_API_BASE_URL: desktopApiBaseUrl,
    EXPO_PUBLIC_API_BASE_URL: desktopApiBaseUrl,
  });

  const buildExitCode = runBuildWeb({
    EXPO_PUBLIC_API_BASE_URL: desktopApiBaseUrl,
  });
  if (buildExitCode !== 0) {
    return buildExitCode;
  }

  const runtimeConfigPath = writeDesktopRuntimeConfig(desktopApiBaseUrl);
  console.info('[desktop-package] runtime config ready', {
    apiBaseUrl: desktopApiBaseUrl,
    runtimeConfigPath,
  });

  if (validateOnly) {
    console.info('[desktop-package] validation-only mode complete');
    return 0;
  }

  return runLocalBinary('electron-builder', ['--win', 'nsis'], {
    cwd: frontendRoot,
    env: packagingEnv,
  });
}

if (require.main === module) {
  process.exit(
    packageDesktop({
      validateOnly: process.argv.includes('--validate-only'),
    }),
  );
}

module.exports = {
  packageDesktop,
  writeDesktopRuntimeConfig,
};
