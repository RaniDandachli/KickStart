const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/**
 * react-native-css-interop (NativeWind) wraps Metro's resolveRequest. Relative
 * imports inside expo-gl's prebuilt files (./GLWorkletContextManager, …) must
 * resolve to sibling files under expo-gl/build. Compose this fix *before*
 * withNativeWind so css-interop chains to it (see react-native-css-interop doctor).
 */
function wrapResolveForExpoGl(prev) {
  return (context, moduleName, platform) => {
    const origin = context.originModulePath;
    if (
      origin &&
      moduleName.startsWith('./') &&
      !moduleName.includes('..')
    ) {
      const norm = origin.replace(/\\/g, '/');
      if (norm.includes('expo-gl') && norm.includes('/build/')) {
        const base = moduleName.slice(2);
        const candidate = path.join(path.dirname(origin), `${base}.js`);
        if (fs.existsSync(candidate)) {
          return { filePath: candidate, type: 'sourceFile' };
        }
      }
    }
    if (prev) {
      return prev(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);
config.resolver.resolveRequest = wrapResolveForExpoGl(config.resolver.resolveRequest);

module.exports = withNativeWind(config, { input: './global.css' });
