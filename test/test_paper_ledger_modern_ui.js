const assert = require('assert');

console.log('Testing Modern Fintech Paper Ledger UI Logic...');

// 1. Test serial number formatting helper
const formatSerial = (index) => {
  const num = index + 1;
  return `#${num < 10 ? '0' + num : num}`;
};

assert.strictEqual(formatSerial(0), '#01');
assert.strictEqual(formatSerial(8), '#09');
assert.strictEqual(formatSerial(9), '#10');
assert.strictEqual(formatSerial(99), '#100');
console.log('✓ Modern serial number formatting verified (#01, #02, etc.)');

// 2. Test modern fintech color scheme
const getFintechRowColors = (isIncome, isDarkMode) => {
  if (isIncome) {
    return {
      badgeBg: isDarkMode ? '#064E3B' : '#ECFDF5',
      badgeText: isDarkMode ? '#34D399' : '#059669',
      amountText: isDarkMode ? '#34D399' : '#10B981',
      prefix: '+',
      label: 'Inflow',
    };
  } else {
    return {
      badgeBg: isDarkMode ? '#4C0519' : '#FFF1F2',
      badgeText: isDarkMode ? '#FB7185' : '#E11D48',
      amountText: isDarkMode ? '#FB7185' : '#F43F5E',
      prefix: '−',
      label: 'Outflow',
    };
  }
};

const incomeLight = getFintechRowColors(true, false);
assert.strictEqual(incomeLight.prefix, '+');
assert.strictEqual(incomeLight.label, 'Inflow');
assert.strictEqual(incomeLight.amountText, '#10B981');

const expenseDark = getFintechRowColors(false, true);
assert.strictEqual(expenseDark.prefix, '−');
assert.strictEqual(expenseDark.label, 'Outflow');
assert.strictEqual(expenseDark.amountText, '#FB7185');
console.log('✓ Modern fintech Inflow/Outflow colors verified');

// 3. Test Net Balance status calculation
const getNetStatus = (netTotal) => {
  if (netTotal > 0) return { label: 'Surplus', color: '#10B981', icon: 'trending-up' };
  if (netTotal < 0) return { label: 'Deficit', color: '#F43F5E', icon: 'trending-down' };
  return { label: 'Balanced', color: '#64748B', icon: 'scale-balance' };
};

assert.strictEqual(getNetStatus(5000).label, 'Surplus');
assert.strictEqual(getNetStatus(-1200).label, 'Deficit');
assert.strictEqual(getNetStatus(0).label, 'Balanced');
console.log('✓ Modern Net Status indicator verified (Surplus / Deficit / Balanced)');

console.log('All Modern Fintech Paper Ledger Tests Passed Successfully!');
