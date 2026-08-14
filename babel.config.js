module.exports = function (api) {
  // Invalidate Babel's config cache when worklets changes so the plugin
  // version stays in sync with the JS package (avoids 0.10.1 vs 0.10.0).
  api.cache.using(() => require('react-native-worklets/package.json').version);

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
    ],
  };
};
