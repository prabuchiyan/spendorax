import LocalLLM from './LocalLLM';

/**
 * Mock Web Implementation for Phase 1 of the AI integration.
 * In Phase 2, this will be replaced with an actual WebGPU/WASM LLM runtime.
 */
export default class LocalLLMWeb extends LocalLLM {
  constructor() {
    super();
    this._isReady = false;
  }

  async initialize() {
    // Simulate initialization delay
    return new Promise((resolve) => {
      setTimeout(() => {
        this._isReady = true;
        resolve();
      }, 1000);
    });
  }

  async generate(messages, options = {}) {
    if (!this._isReady) throw new Error('LLM is not ready');

    const lastMessage = messages[messages.length - 1].content.toLowerCase();

    // Mock intent routing for Phase 1 testing
    if (lastMessage.includes('spend') || lastMessage.includes('transaction')) {
      return JSON.stringify({
        type: 'tool_call',
        tool: 'get_category_spending',
        parameters: { category: 'Food', period: 'current_month' }
      });
    }

    if (lastMessage.includes('budget')) {
      return JSON.stringify({
        type: 'tool_call',
        tool: 'get_budget_status',
        parameters: {}
      });
    }
    
    if (lastMessage.includes('json_result')) {
       return JSON.stringify({
         type: 'response',
         message: 'You spent ₹8,420 on Food this month across 23 transactions.'
       });
    }

    return JSON.stringify({
      type: 'response',
      message: 'I can help you analyze your spending, check budgets, and more. Try asking "How much did I spend on food this month?"'
    });
  }

  async unload() {
    this._isReady = false;
    return Promise.resolve();
  }

  isReady() {
    return this._isReady;
  }
}
