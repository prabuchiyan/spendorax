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
    this.toolRegistry.register(analyticsTools.getTopExpensesTool);
  }

  getSystemPrompt() {
    const tools = Array.from(this.toolRegistry.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }));

    return `You are a helpful, local financial AI assistant for SpendoraX. 
You MUST ALWAYS respond with a strict JSON object. Do not include markdown formatting like \`\`\`json. 

If you want to talk to the user, respond with:
{
  "type": "response",
  "message": "Your conversational response here"
}

If the user asks a question that requires data, you must call a tool. Respond with:
{
  "type": "tool_call",
  "tool": "tool_name",
  "parameters": {
    "key": "value"
  }
}

Available tools:
${JSON.stringify(tools, null, 2)}

Do NOT perform financial calculations yourself. Let the tools do that.`;
  }

  async initialize(initProgressCallback = null) {
    await this.llm.initialize(initProgressCallback);
  }

  /**
   * Processes a user message and returns the Agent's response string.
   */
  async sendMessage(userText) {
    this.conversationHistory.push({ role: 'user', content: userText });

    try {
      const messagesWithSystem = [
        { role: 'system', content: this.getSystemPrompt() },
        ...this.conversationHistory
      ];

      const llmOutput = await this.llm.generate(messagesWithSystem);
      const routeResult = await this.router.route(llmOutput);

      if (routeResult.type === 'response') {
        this.conversationHistory.push({ role: 'assistant', content: routeResult.message });
        return routeResult.message;
      }

      if (routeResult.type === 'tool_result') {
        // Feed tool result back to LLM to generate natural language response
        this.conversationHistory.push({ 
          role: 'user', 
          content: `Tool executed successfully. Result: ${JSON.stringify(routeResult.result)}. Please summarize this for me.` 
        });
        
        const finalMessagesWithSystem = [
          { role: 'system', content: this.getSystemPrompt() },
          ...this.conversationHistory
        ];

        const finalOutput = await this.llm.generate(finalMessagesWithSystem);
        const finalRoute = await this.router.route(finalOutput);
        
        if (finalRoute.type === 'response') {
          this.conversationHistory.push({ role: 'assistant', content: finalRoute.message });
          return finalRoute.message;
        } else {
           // Fallback in case the model keeps trying to call tools recursively inappropriately in this prototype
           return "I retrieved the data but had trouble formatting it: " + JSON.stringify(routeResult.result);
        }
      }

      return "I'm not sure how to handle that right now.";
    } catch (e) {
      console.error('Agent error:', e);
      return "Sorry, I encountered an error processing your request.";
    }
  }
}
