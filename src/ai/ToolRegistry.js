/**
 * Registry for all available AI tools.
 */
export default class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  /**
   * Register a new tool.
   * @param {Object} toolDefinition - { name, description, parameters, permission, execute }
   */
  register(toolDefinition) {
    if (!toolDefinition.name || !toolDefinition.execute) {
      throw new Error('Tool must have a name and an execute function');
    }
    this.tools.set(toolDefinition.name, toolDefinition);
  }

  /**
   * Get a tool by name.
   */
  get(name) {
    return this.tools.get(name);
  }

  /**
   * Execute a registered tool.
   */
  async executeTool(name, parameters) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    
    // In a real implementation, permission checks and parameter validation would happen here.
    return await tool.execute(parameters);
  }
}
