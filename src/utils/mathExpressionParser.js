/**
 * Safe Math Expression Parser & Evaluator for SpendoraX Paper Ledger
 * Supports +, −, ×, ÷, % (percentage of base: A % B = A * (B / 100)), and parentheses ( ).
 * Does not use eval() or Function().
 */

/**
 * Normalizes expression string by replacing unicode symbols and trimming.
 */
function normalizeExpression(expr) {
  if (!expr || typeof expr !== 'string') return '';
  return expr
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenizes a math expression into numbers, operators, and parentheses.
 */
function tokenize(expression) {
  const tokens = [];
  let i = 0;
  const len = expression.length;

  while (i < len) {
    const char = expression[i];

    if (char === ' ') {
      i++;
      continue;
    }

    if (char === '(' || char === ')') {
      tokens.push({ type: 'paren', value: char });
      i++;
      continue;
    }

    if (char === '+' || char === '-' || char === '*' || char === '/' || char === '%') {
      // Check for unary minus: at start or after an operator or '('
      if (char === '-') {
        const prevToken = tokens[tokens.length - 1];
        if (!prevToken || prevToken.type === 'operator' || (prevToken.type === 'paren' && prevToken.value === '(')) {
          // Unary minus: treat next number as negative, or push 0 and '-'
          tokens.push({ type: 'number', value: 0 });
        }
      }
      tokens.push({ type: 'operator', value: char });
      i++;
      continue;
    }

    // Number (digits and decimal point)
    if (/[0-9.]/.test(char)) {
      let numStr = '';
      while (i < len && /[0-9.]/.test(expression[i])) {
        numStr += expression[i];
        i++;
      }
      const num = parseFloat(numStr);
      if (isNaN(num)) {
        return null; // Invalid number token
      }
      tokens.push({ type: 'number', value: num });
      continue;
    }

    // Any other character is invalid
    return null;
  }

  return tokens;
}

/**
 * Evaluates an arithmetic expression safely using Shunting-Yard algorithm.
 *
 * @param {string} rawExpr - The input expression (e.g. "100 + 25", "100 % 25")
 * @returns {{ isValid: boolean, result: number | null, hasOperator: boolean, error?: string }}
 */
function evaluateMathExpression(rawExpr) {
  const expr = normalizeExpression(rawExpr);
  if (!expr) {
    return { isValid: false, result: null, hasOperator: false };
  }

  const hasOperator = /[+\-*/%]/.test(expr);

  const tokens = tokenize(expr);
  if (!tokens || tokens.length === 0) {
    return { isValid: false, result: null, hasOperator };
  }

  // Operator precedence
  const precedence = {
    '+': 1,
    '-': 1,
    '*': 2,
    '/': 2,
    '%': 2,
  };

  const outputQueue = [];
  const operatorStack = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === 'number') {
      outputQueue.push(token.value);
    } else if (token.type === 'operator') {
      while (
        operatorStack.length > 0 &&
        operatorStack[operatorStack.length - 1] !== '(' &&
        precedence[operatorStack[operatorStack.length - 1]] >= precedence[token.value]
      ) {
        outputQueue.push(operatorStack.pop());
      }
      operatorStack.push(token.value);
    } else if (token.type === 'paren') {
      if (token.value === '(') {
        operatorStack.push('(');
      } else if (token.value === ')') {
        let foundOpen = false;
        while (operatorStack.length > 0) {
          const top = operatorStack.pop();
          if (top === '(') {
            foundOpen = true;
            break;
          }
          outputQueue.push(top);
        }
        if (!foundOpen) {
          return { isValid: false, result: null, hasOperator, error: 'Mismatched parentheses' };
        }
      }
    }
  }

  while (operatorStack.length > 0) {
    const top = operatorStack.pop();
    if (top === '(' || top === ')') {
      return { isValid: false, result: null, hasOperator, error: 'Mismatched parentheses' };
    }
    outputQueue.push(top);
  }

  // Evaluate RPN
  const evalStack = [];

  for (let i = 0; i < outputQueue.length; i++) {
    const item = outputQueue[i];

    if (typeof item === 'number') {
      evalStack.push(item);
    } else {
      // Operator
      if (evalStack.length < 2) {
        return { isValid: false, result: null, hasOperator, error: 'Incomplete expression' };
      }
      const b = evalStack.pop();
      const a = evalStack.pop();

      let res;
      switch (item) {
        case '+':
          res = a + b;
          break;
        case '-':
          res = a - b;
          break;
        case '*':
          res = a * b;
          break;
        case '/':
          if (b === 0) {
            return { isValid: false, result: null, hasOperator, error: 'Cannot divide by zero' };
          }
          res = a / b;
          break;
        case '%':
          // A % B means B percent of A: A * (B / 100)
          res = a * (b / 100);
          break;
        default:
          return { isValid: false, result: null, hasOperator, error: 'Unknown operator' };
      }
      evalStack.push(res);
    }
  }

  if (evalStack.length !== 1) {
    return { isValid: false, result: null, hasOperator, error: 'Invalid expression' };
  }

  const rawResult = evalStack[0];
  if (isNaN(rawResult) || !isFinite(rawResult)) {
    return { isValid: false, result: null, hasOperator, error: 'Calculation error' };
  }

  // Round to 4 decimal places to remove binary floating point artifacts
  const finalResult = Math.round(rawResult * 10000) / 10000;

  return {
    isValid: true,
    result: finalResult,
    hasOperator,
  };
}

module.exports = {
  normalizeExpression,
  tokenize,
  evaluateMathExpression,
};

