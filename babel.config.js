module.exports = function (api) {
  api.cache(true);

  // #region agent log
  try {
    const workletsPkg = require('react-native-worklets/package.json');
    const fs = require('fs');
    const path = require('path');
    const payload = {
      sessionId: 'faabf4',
      runId: 'post-fix',
      hypothesisId: 'A',
      location: 'babel.config.js:load',
      message: 'Babel config loaded; worklets package version',
      data: {
        workletsVersion: workletsPkg.version,
        cwd: process.cwd(),
        hasMetroCache: fs.existsSync(path.join(process.cwd(), 'node_modules', '.cache')),
        hasExpoCache: fs.existsSync(path.join(process.cwd(), '.expo')),
      },
      timestamp: Date.now(),
    };
    fs.appendFileSync(path.join(process.cwd(), 'debug-faabf4.log'), JSON.stringify(payload) + '\n');
    fetch('http://127.0.0.1:7505/ingest/3e833bab-0eef-4ca6-b95d-13fe03afcf14', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'faabf4' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch (_) {}
  // #endregion

  return {
    presets: [['babel-preset-expo'], 'nativewind/babel'],

    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],

          alias: {
            '@/assets': './assets',
            '@': './src',
            'tailwind.config': './tailwind.config.js',
          },
        },
      ],
      'react-native-worklets/plugin',
    ],
  };
};
