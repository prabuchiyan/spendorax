import { Platform } from 'react-native';
import LocalLLM from './LocalLLM';

const DEFAULT_MODEL =
  'Qwen2-0.5B-Instruct-q4f16_1-MLC';

function formatInitProgress(progress) {
  if (typeof progress === 'string') {
    return progress;
  }

  if (progress?.text) {
    return progress.text;
  }

  if (progress?.progress !== undefined) {
    const pct = Math.round(
      Number(progress.progress) * 100
    );

    return `Loading model... ${pct}%`;
  }

  return 'Loading model...';
}

async function assertWebRuntimeReady() {
  if (typeof window === 'undefined') {
    throw new Error(
      'Web LLM requires a browser environment.'
    );
  }

  if (!navigator?.gpu) {
    throw new Error(
      'WebGPU is not supported. ' +
      'Use Chrome or Edge with hardware acceleration enabled.'
    );
  }

  let adapter;

  try {
    adapter =
      await navigator.gpu.requestAdapter();
  } catch (error) {
    throw new Error(
      `WebGPU requestAdapter() failed: ${error?.message || error
      }`
    );
  }

  if (!adapter) {
    throw new Error(
      'WebGPU adapter was not found. ' +
      'Enable hardware acceleration in Chrome/Edge and restart the browser.'
    );
  }
}

/**
 * Communicates with webllm.worker.js.
 */
class WorkerBridge {
  constructor(worker) {
    this.worker = worker;
    this.pending = new Map();
    this.onProgress = null;
    this._nextId = 1;

    worker.onmessage = (event) => {
      const {
        type,
        id,
        message,
        result,
        progress,
      } = event.data || {};

      if (type === 'progress') {
        this.onProgress?.(progress);
        return;
      }

      const pending =
        this.pending.get(id);

      if (!pending) {
        return;
      }

      this.pending.delete(id);

      if (type === 'error') {
        const error = new Error(
          message || 'Worker error'
        );

        if (event.data?.stack) {
          error.stack = event.data.stack;
        }

        pending.reject(error);
        return;
      }

      pending.resolve(result);
    };

    worker.onerror = (event) => {
      const message =
        event?.message ||
        event?.error?.message ||
        'WebLLM worker failed.';

      console.error(
        '[WorkerBridge] Worker error:',
        event
      );

      for (const [
        id,
        pending,
      ] of this.pending.entries()) {
        pending.reject(
          new Error(message)
        );
      }

      this.pending.clear();
    };

    worker.onmessageerror = (event) => {
      console.error(
        '[WorkerBridge] Message error:',
        event
      );
    };
  }

  send(type, payload = {}) {
    const id = this._nextId++;

    return new Promise(
      (resolve, reject) => {
        this.pending.set(id, {
          resolve,
          reject,
        });

        try {
          this.worker.postMessage({
            type,
            payload,
            id,
          });
        } catch (error) {
          this.pending.delete(id);
          reject(error);
        }
      }
    );
  }

  terminate() {
    for (const [
      ,
      pending,
    ] of this.pending.entries()) {
      pending.reject(
        new Error('Worker terminated.')
      );
    }

    this.pending.clear();

    this.worker?.terminate();
  }
}

export default class LocalLLMWeb extends LocalLLM {
  constructor() {
    super();

    this.bridge = null;
    this.worker = null;
    this._isReady = false;
    this.modelId = DEFAULT_MODEL;
  }

  getRuntimeInfo() {
    return {
      mode: 'web-llm',
      label:
        `On-device model (${this.modelId})`,
      modelId: this.modelId,
    };
  }

  async initialize(
    initProgressCallback = null
  ) {
    if (Platform.OS !== 'web') {
      throw new Error(
        'LocalLLMWeb can only be used on the web platform.'
      );
    }

    await assertWebRuntimeReady();

    if (this._isReady && this.bridge) {
      return;
    }

    const notifyProgress = (progress) => {
      initProgressCallback?.({
        text:
          formatInitProgress(progress),
      });
    };

    notifyProgress({
      text:
        'Starting on-device AI worker...',
    });

    try {
      /**
       * IMPORTANT:
       *
       * Do not use import.meta.url here.
       *
       * Expo/Metro web worker resolution
       * uses window.location.href.
       */
      const workerUrl = '/webllm.worker.js';

      console.log(
        '[LocalLLMWeb] Worker URL:',
        workerUrl
      );

      const worker = new Worker(workerUrl, {
        type: 'module',
      });

      this.worker = worker;

      this.bridge =
        new WorkerBridge(worker);

      this.bridge.onProgress = notifyProgress;

      console.log(
        '[LocalLLMWeb] Worker created:',
        worker
      );

      this.bridge.onProgress =
        notifyProgress;

      notifyProgress({
        text:
          `Loading ${this.modelId}...`,
      });

      await this.bridge.send('init', {
        modelId: this.modelId,
      });

      this._isReady = true;

      notifyProgress({
        text: 'Model ready.',
      });

      const result = await this.bridge.send('test');

      console.log('[LocalLLMWeb] Worker test result:', result);

      throw new Error(
        'WORKER_TEST_COMPLETE: Worker communication is working.'
      );
      this._isReady = true;

      notifyProgress({
        text: 'Model ready.',
      });
    } catch (error) {
      console.error(
        '[LocalLLMWeb] Initialization failed:',
        error
      );

      this._isReady = false;

      this.bridge?.terminate();

      this.bridge = null;
      this.worker = null;

      throw new Error(
        error?.message ||
        'Failed to initialize WebLLM.'
      );
    }
  }

  async generate(
    messages,
    options = {}
  ) {
    if (
      !this._isReady ||
      !this.bridge
    ) {
      throw new Error(
        'Local AI model is not ready.'
      );
    }

    return this.bridge.send(
      'generate',
      {
        messages,
        temperature:
          options.temperature ?? 0.1,
      }
    );
  }

  async unload() {
    if (this.bridge) {
      try {
        await this.bridge.send(
          'unload'
        );
      } catch (error) {
        console.warn(
          '[LocalLLMWeb] Unload error:',
          error
        );
      }

      this.bridge.terminate();
    }

    this.bridge = null;
    this.worker = null;
    this._isReady = false;
  }

  isReady() {
    return this._isReady;
  }
}