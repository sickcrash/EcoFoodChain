module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Enable absolute imports with `@/` mapped to project root
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './',
          },
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
        },
      ],
      // Keep at the end as required by the plugin
      'react-native-worklets/plugin',
    ],
  };
};
