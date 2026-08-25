import { Platform } from 'react-native';
import LocalLLM from './LocalLLM';

/**
 * Web Implementation using WebLLM for the AI integration.
 */
export default class LocalLLMWeb extends LocalLLM {
  constructor() {
    super();
    this.engine = null;
    this._isReady = false;
  }

  async initialize(initProgressCallback = null) {
    if (Platform.OS !== 'web') {
      throw new Error('LocalLLMWeb can only be used on the web platform.');
    }

    try {
      // Dynamically import web-llm so it doesn't break React Native bundlers on native platforms
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm');

      const initProgressCallbackWrapper = (progress) => {
        if (initProgressCallback) {
          initProgressCallback(progress);
        }
      };

      // We'll use Qwen2.5-1.5B-Instruct-q4f16_1-MLC as it is small and capable
      const selectedModel = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';
      
      this.engine = await CreateMLCEngine(selectedModel, {
        initProgressCallback: initProgressCallbackWrapper,
      });

      this._isReady = true;
    } catch (e) {
      console.error('Failed to initialize WebLLM:', e);
      throw e;
    }
  }

  async generate(messages, options = {}) {
    if (!this._isReady || !this.engine) throw new Error('LLM is not ready');

    try {
      const response = await this.engine.chat.completions.create({
        messages,
        temperature: options.temperature || 0.1, // Keep it low for more deterministic JSON outputs
      });

      return response.choices[0].message.content;
    } catch (e) {
      console.error('Generation error:', e);
      throw e;
    }
  }

  async unload() {
    if (this.engine) {
      await this.engine.unload();
      this.engine = null;
    }
    this._isReady = false;
    return Promise.resolve();
  }

  isReady() {
    return this._isReady;
  }
}
