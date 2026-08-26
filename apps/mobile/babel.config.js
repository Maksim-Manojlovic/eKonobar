module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo already includes the Reanimated plugin for SDK 50+,
    // so adding it by hand here would run the transform twice.
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
