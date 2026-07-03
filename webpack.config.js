const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

module.exports = async function(env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);
  config.resolve = config.resolve || {};
  config.resolve.alias = config.resolve.alias || {};

  // Alias the RN asset registry to react-native-web's AssetRegistry
  try {
    config.resolve.alias['@react-native/assets-registry/registry'] = require.resolve('react-native-web/dist/modules/AssetRegistry/index.js');
  } catch (e) {}

  // Map material-design-icons request to Expo's MaterialCommunityIcons on web
  try {
    config.resolve.alias['@react-native-vector-icons/material-design-icons'] = require.resolve('@expo/vector-icons/MaterialCommunityIcons');
  } catch (e) {}

  return config;
};
