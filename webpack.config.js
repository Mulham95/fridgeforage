const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Enable wasm loading for expo-sqlite web support.
  config.resolve.extensions.push('.wasm');
  config.module.rules.push({
    test: /\.wasm$/,
    type: 'webassembly/experimental',
  });

  return config;
};
