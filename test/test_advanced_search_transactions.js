const assert = require('assert');
const fs = require('fs');

const code = fs.readFileSync('src/services/transactions.js', 'utf8');

// Check that getAdvancedSearchTransactions destructures and uses categoryId and sourceId
const fnMatch = code.match(/export async function getAdvancedSearchTransactions\s*\(([^)]+)\)\s*\{([\s\S]*?)\n\}/);
assert.ok(fnMatch, 'getAdvancedSearchTransactions must exist');
const fnBody = fnMatch[2];

assert.ok(fnBody.includes('categoryId'), 'getAdvancedSearchTransactions body must reference categoryId');
assert.ok(fnBody.includes('sourceId'), 'getAdvancedSearchTransactions body must reference sourceId');

console.log('Task 2 tests passed!');
