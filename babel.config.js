module.exports = function (api) {
  const isTest = api.env("test");

  // Invalidate Babel's config cache when worklets changes so the plugin
  // version stays in sync with the JS package (avoids 0.10.1 vs 0.10.0).
  // Also key on test vs app so Jest does not reuse the NativeWind preset.
  api.cache.using(
    () =>
      `${require("react-native-worklets/package.json").version}:${isTest ? "test" : "app"}`,
  );

  return {
    // NativeWind rewrites react-native imports to react-native-css, which
    // breaks under Jest — keep it for the app only.
    presets: isTest
      ? [["babel-preset-expo"]]
      : [["babel-preset-expo"], "nativewind/babel"],

    plugins: [
      [
        "module-resolver",
        {
          root: ["./"],

          alias: {
            "@/assets": "./assets",
            "@": "./src",
            "tailwind.config": "./tailwind.config.js",
          },
        },
      ],
    ],
  };
};
