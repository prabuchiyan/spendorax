/**
 * Router for the AI Agent.
 * Takes the raw output from the LLM, validates it, and routes it to the appropriate tool.
 */
export default class AgentRouter {
  constructor(toolRegistry) {
    this.toolRegistry = toolRegistry;
  }

  /**
   * Processes the LLM output and executes tools if necessary.
   * @param {String} llmOutput - Raw JSON string from the LLM
   * @returns {Object} Result of the routing
   */
  async route(llmOutput) {
    let parsed;
    try {
      parsed = JSON.parse(llmOutput);
    } catch (e) {
      return { type: 'error', message: 'Failed to parse LLM output.' };
    }

    if (parsed.type === 'response') {
      return { type: 'response', message: parsed.message };
    }

    if (parsed.type === 'tool_call') {
      try {
        const result = await this.toolRegistry.executeTool(parsed.tool, parsed.parameters);
        return { type: 'tool_result', tool: parsed.tool, result };
      } catch (e) {
        return { type: 'error', message: `Tool execution failed: ${e.message}` };
      }
    }

    if (parsed.type === 'confirmation_required') {
      return { 
        type: 'confirmation_required', 
        action: parsed.action, 
        parameters: parsed.parameters 
      };
    }

    return { type: 'error', message: 'Unknown action type.' };
  }
}
