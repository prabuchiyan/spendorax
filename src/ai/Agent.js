import LocalLLMWeb from './LocalLLMWeb';
import ToolRegistry from './ToolRegistry';
import AgentRouter from './AgentRouter';

// Stub tools import
import * as transactionTools from './tools/transactionTools';
import * as budgetTools from './tools/budgetTools';
import * as analyticsTools from './tools/analyticsTools';

/**
 * Main AI Agent facade.
 * Manages conversation history, the LLM instance, and routing.
 */
export default class Agent {
  constructor() {
    this.llm = new LocalLLMWeb();
    this.toolRegistry = new ToolRegistry();
    this.router = new AgentRouter(this.toolRegistry);
    this.conversationHistory = [];
    
    this._registerTools();
  }

  _registerTools() {
    this.toolRegistry.register(transactionTools.getCategorySpendingTool);
    this.toolRegistry.register(budgetTools.getBudgetStatusTool);
    // Add other mocked tools here as they are created
  }

  async initialize() {
    await this.llm.initialize();
  }

  /**
   * Processes a user message and returns the Agent's response string.
   */
  async sendMessage(userText) {
    this.conversationHistory.push({ role: 'user', content: userText });

    try {
      const llmOutput = await this.llm.generate(this.conversationHistory);
      const routeResult = await this.router.route(llmOutput);

      if (routeResult.type === 'response') {
        this.conversationHistory.push({ role: 'assistant', content: routeResult.message });
        return routeResult.message;
      }

      if (routeResult.type === 'tool_result') {
        // Feed tool result back to LLM to generate natural language response
        this.conversationHistory.push({ 
          role: 'tool', 
          content: JSON.stringify(routeResult.result) 
        });
        
        // For Phase 1 testing, we force a json_result keyword to trigger the mock LLM response
        this.conversationHistory.push({ role: 'system', content: 'json_result' });
        
        const finalOutput = await this.llm.generate(this.conversationHistory);
        const finalRoute = await this.router.route(finalOutput);
        
        if (finalRoute.type === 'response') {
          this.conversationHistory.push({ role: 'assistant', content: finalRoute.message });
          return finalRoute.message;
        }
      }

      return "I'm not sure how to handle that right now.";
    } catch (e) {
      console.error('Agent error:', e);
      return "Sorry, I encountered an error processing your request.";
    }
  }
}
