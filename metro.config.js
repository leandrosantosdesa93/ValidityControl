const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Adicione suporte para SVG
const { transformer, resolver } = config;
config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer'),
  unstable_allowRequireContext: true,
  minifierPath: 'metro-minify-terser',
  minifierConfig: {}
};

config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg', 'jsx', 'js', 'ts', 'tsx', 'json'],
  extraNodeModules: {
    '@': path.resolve(__dirname, 'src'),
    '@components': path.resolve(__dirname, 'components'),
    '@constants': path.resolve(__dirname, 'constants'),
    '@hooks': path.resolve(__dirname, 'hooks'),
    '@services': path.resolve(__dirname, 'src/services'),
    '@store': path.resolve(__dirname, 'src/store'),
    '@types': path.resolve(__dirname, 'src/types'),
    '@utils': path.resolve(__dirname, 'src/utils')
  }
};

module.exports = config; 