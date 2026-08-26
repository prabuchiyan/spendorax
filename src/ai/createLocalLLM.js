import { Platform } from 'react-native';
import LocalLLMWeb from './LocalLLMWeb';
import LocalLLMMock from './LocalLLMMock';

/**
 * Creates the best available LocalLLM implementation for the current platform.
 * Web tries WebGPU/WebLLM first, then falls back to the rule-based mock.
 * Native uses the mock until the Android runtime is implemented.
 */
export default async function createLocalLLM(initProgressCallback = null) {
  if (Platform.OS === 'web') {
    const webLLM = new LocalLLMWeb();

    try {
      await webLLM.initialize(initProgressCallback);
      return webLLM;
    } catch (error) {
      // Surface the real reason in the UI, not just console
      const reason = error?.message || 'WebLLM initialization failed';
      console.warn('[createLocalLLM] Falling back to mock. Reason:', reason);

      if (initProgressCallback) {
        initProgressCallback({ text: `⚠️ On-device model unavailable: ${reason}` });
      }

      const mock = new LocalLLMMock();
      mock.setFallbackReason(reason);
      await mock.initialize(initProgressCallback);
      return mock;
    }
  }

  // Android — mock until Phase 7
  const mock = new LocalLLMMock();
  mock.setFallbackReason('Android native runtime not yet implemented (Phase 7).');
  await mock.initialize(initProgressCallback);
  return mock;
}
