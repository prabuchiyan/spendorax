/**
 * Base interface for the Local LLM runtime.
 * All actual implementations (Web, Android) must extend this class
 * or implement these methods.
 */
export default class LocalLLM {
  /**
   * Initializes the LLM.
   * Downloads or loads the model into memory.
   */
  async initialize() {
    throw new Error('initialize() must be implemented');
  }

  /**
   * Generates a response from the LLM based on messages.
   * @param {Array} messages - Array of message objects { role, content }
   * @param {Object} options - Options like temperature, max_tokens, etc.
   * @returns {Promise<String>} The generated response text
   */
  async generate(messages, options = {}) {
    throw new Error('generate() must be implemented');
  }

  /**
   * Unloads the model from memory.
   */
  async unload() {
    throw new Error('unload() must be implemented');
  }

  /**
   * Checks if the model is ready to generate responses.
   * @returns {boolean}
   */
  isReady() {
    throw new Error('isReady() must be implemented');
  }
}
