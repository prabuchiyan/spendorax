import LocalLLM from './LocalLLM';

/**
 * Rule-based offline LLM fallback for native platforms and web recovery.
 * Maps common financial questions to structured tool calls without a real model.
 */
export default class LocalLLMMock extends LocalLLM {
  constructor() {
    super();
    this._isReady = false;
    this.fallbackReason = null;
  }

  setFallbackReason(reason) {
    this.fallbackReason = reason;
  }

  getRuntimeInfo() {
    return {
      mode: 'mock',
      label: 'Rule-based assistant (no on-device model loaded)',
      fallbackReason: this.fallbackReason,
    };
  }

  async initialize(initProgressCallback = null) {
    if (initProgressCallback) {
      initProgressCallback({ text: 'Starting rule-based assistant...' });
    }
    this._isReady = true;
  }

  isReady() {
    return this._isReady;
  }

  async unload() {
    this._isReady = false;
  }

  async generate(messages) {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMessage) {
      return JSON.stringify({
        type: 'response',
        message: 'How can I help with your finances today?',
      });
    }

    const content = lastUserMessage.content;

    if (content.includes('Tool executed successfully')) {
      return JSON.stringify({
        type: 'response',
        message: this._summarizeToolResult(content),
      });
    }

    return JSON.stringify(this._routeIntent(content));
  }

  _routeIntent(text) {
    const lower = text.toLowerCase();

    if (this._matchesAny(lower, ['bill', 'due', 'upcoming bill', 'overdue'])) {
      return { type: 'tool_call', tool: 'get_upcoming_bills', parameters: {} };
    }

    if (this._matchesAny(lower, ['loan', 'emi', 'owe', 'outstanding', 'debt'])) {
      return { type: 'tool_call', tool: 'get_loan_summary', parameters: {} };
    }

    if (this._matchesAny(lower, ['budget', 'over budget', 'budget left', 'remaining budget'])) {
      return { type: 'tool_call', tool: 'get_budget_status', parameters: {} };
    }

    if (this._matchesAny(lower, ['top expense', 'biggest expense', 'largest expense', 'highest expense'])) {
      return {
        type: 'tool_call',
        tool: 'get_top_expenses',
        parameters: { period: this._extractPeriod(lower), limit: 5 },
      };
    }

    if (this._matchesAny(lower, ['spent on', 'spending on', 'spend on', 'how much on'])) {
      const category = this._extractCategory(lower);
      if (category) {
        return {
          type: 'tool_call',
          tool: 'get_category_spending',
          parameters: { category, period: this._extractPeriod(lower) },
        };
      }
    }

    if (this._matchesAny(lower, ['food', 'groceries', 'transport', 'shopping', 'entertainment', 'rent', 'utilities'])) {
      return {
        type: 'tool_call',
        tool: 'get_category_spending',
        parameters: {
          category: this._extractCategory(lower) || 'Food',
          period: this._extractPeriod(lower),
        },
      };
    }

    return {
      type: 'response',
      message:
        'I can help with spending, budgets, bills, and loans. Try asking something like "How much did I spend on food this month?" or "What bills are due?"',
    };
  }

  _matchesAny(text, keywords) {
    return keywords.some((keyword) => text.includes(keyword));
  }

  _extractPeriod(text) {
    if (text.includes('last month')) return 'last_month';
    if (text.includes('this year')) return 'this_year';
    if (text.includes('last week')) return 'last_week';
    if (text.includes('yesterday')) return 'yesterday';
    return 'current_month';
  }

  _extractCategory(text) {
    const categories = [
      'food',
      'groceries',
      'transport',
      'shopping',
      'entertainment',
      'rent',
      'utilities',
      'health',
      'education',
      'travel',
    ];

    for (const category of categories) {
      if (text.includes(category)) {
        return category.charAt(0).toUpperCase() + category.slice(1);
      }
    }

    const onMatch = text.match(/(?:spent|spend|spending)\s+on\s+([a-z\s]+?)(?:\s+this|\s+last|$|\?)/i);
    if (onMatch?.[1]) {
      return onMatch[1].trim().replace(/\b\w/g, (c) => c.toUpperCase());
    }

    return null;
  }

  _summarizeToolResult(content) {
    const jsonStart = content.indexOf('{');
    if (jsonStart === -1) {
      return 'I retrieved your data, but had trouble formatting the response.';
    }

    try {
      const result = JSON.parse(content.slice(jsonStart));
      return this._formatToolResult(result);
    } catch {
      return 'I retrieved your data, but had trouble formatting the response.';
    }
  }

  _formatToolResult(result) {
    if (Array.isArray(result)) {
      if (result.length === 0) {
        return 'I did not find any matching records.';
      }

      if (result[0]?.due_date !== undefined) {
        const lines = result.slice(0, 5).map((bill) => {
          const amount = this._formatCurrency(bill.amount);
          return `- ${bill.name}: ${amount} due ${bill.due_date || 'soon'}`;
        });
        return `You have ${result.length} upcoming bill(s):\n${lines.join('\n')}`;
      }

      if (result[0]?.description !== undefined) {
        const lines = result.map((item) => {
          return `- ${item.description}: ${this._formatCurrency(item.amount)} (${item.category || 'Uncategorized'})`;
        });
        return `Here are your top expenses:\n${lines.join('\n')}`;
      }
    }

    if (result.totalOutstanding !== undefined) {
      const lines = (result.loans || []).map((loan) => {
        return `- ${loan.loan_name}: ${this._formatCurrency(loan.outstanding_amount)} outstanding`;
      });
      return `Total outstanding loan balance: ${this._formatCurrency(result.totalOutstanding)} across ${result.activeLoansCount || 0} active loan(s).\n${lines.join('\n')}`.trim();
    }

    if (result.totalBudget !== undefined) {
      return `Budget status: spent ${this._formatCurrency(result.totalSpent)} of ${this._formatCurrency(result.totalBudget)} (${result.percentageUsed}% used). Remaining: ${this._formatCurrency(result.remaining)}.`;
    }

    if (result.total !== undefined && result.category) {
      return `You spent ${this._formatCurrency(result.total)} on ${result.category}${result.period ? ` (${result.period.replace(/_/g, ' ')})` : ''} across ${result.transactionCount || 0} transaction(s).`;
    }

    return `Here is what I found: ${JSON.stringify(result)}`;
  }

  _formatCurrency(amount) {
    const value = Number(amount || 0);
    return `₹${value.toLocaleString('en-IN')}`;
  }
}
