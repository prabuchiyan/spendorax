// public/webllm.worker.js

console.log('[WebLLM Worker] Static worker loaded successfully');

let engine = null;

function sendError(id, error) {
  const message = error?.message || String(error);

  console.error('[WebLLM Worker] Error:', error);

  self.postMessage({
    type: 'error',
    id,
    message,
    stack: error?.stack || null,
  });
}

async function loadWebLLM() {
  // Load WebLLM directly in the browser.
  // This avoids Expo/Metro trying to bundle WebLLM
  // into the worker.
  return await import(
    'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.82/lib/index.js'
  );
}

async function initializeEngine(id, payload) {
  try {
    console.log(
      '[WebLLM Worker] Initializing:',
      payload?.modelId
    );

    const webllm = await loadWebLLM();

    console.log(
      '[WebLLM Worker] WebLLM module loaded'
    );

    const createEngine =
      webllm.CreateMLCEngine ||
      webllm.CreateEngine;

    if (!createEngine) {
      throw new Error(
        'WebLLM engine factory was not found.'
      );
    }

    engine = await createEngine(
      payload.modelId,
      {
        initProgressCallback: (progress) => {
          self.postMessage({
            type: 'progress',
            progress,
          });
        },
      }
    );

    console.log(
      '[WebLLM Worker] Engine initialized'
    );

    self.postMessage({
      type: 'init_done',
      id,
    });

  } catch (error) {
    sendError(id, error);
  }
}

async function generate(id, payload) {
  try {
    if (!engine) {
      throw new Error(
        'WebLLM engine is not initialized.'
      );
    }

    const response =
      await engine.chat.completions.create({
        messages: payload.messages,
        temperature:
          payload.temperature ?? 0.1,
      });

    const content =
      response?.choices?.[0]?.message?.content || '';

    self.postMessage({
      type: 'generate_done',
      id,
      result: content,
    });

  } catch (error) {
    sendError(id, error);
  }
}

async function unload(id) {
  try {
    if (engine) {
      await engine.unload();
      engine = null;
    }

    self.postMessage({
      type: 'unload_done',
      id,
    });

  } catch (error) {
    sendError(id, error);
  }
}

self.onmessage = async (event) => {
  const {
    type,
    payload = {},
    id,
  } = event.data || {};

  console.log(
    '[WebLLM Worker] Message:',
    type
  );

  switch (type) {
    case 'init':
      await initializeEngine(
        id,
        payload
      );
      break;

    case 'generate':
      await generate(
        id,
        payload
      );
      break;

    case 'unload':
      await unload(id);
      break;

    case 'test':
      self.postMessage({
        type: 'test_done',
        id,
        result: 'STATIC_WORKER_OK',
      });
      break;

    default:
      sendError(
        id,
        new Error(
          `Unknown worker command: ${type}`
        )
      );
  }
};

self.onerror = (
  message,
  source,
  lineno,
  colno,
  error
) => {
  console.error(
    '[WebLLM Worker] FATAL ERROR:',
    {
      message,
      source,
      lineno,
      colno,
      error,
    }
  );
};

self.onunhandledrejection = (event) => {
  console.error(
    '[WebLLM Worker] Unhandled rejection:',
    event?.reason
  );
};