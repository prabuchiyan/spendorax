const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Required for WebGPU in browser
config.server = config.server || {};
config.server.enhanceMiddleware = (metroMiddleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    return metroMiddleware(req, res, next);
  };
};

// Prevent Metro from trying to bundle modules it can't handle
const { resolveRequest } = config.resolver;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'perf_hooks' || moduleName === 'url') {
    return { type: 'empty' };
  }

  if (resolveRequest) {
    return resolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

// Block Metro from crawling @mlc-ai/web-llm entirely.
// It's loaded at runtime via esm.sh CDN in LocalLLMWeb.js.
config.resolver.blockList = [
  /node_modules[\\/]@mlc-ai[\\/]web-llm[\\/].*/,
];

module.exports = config;