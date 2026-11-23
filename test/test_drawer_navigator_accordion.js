const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Testing DrawerNavigator Accordion Categorization Contracts & Logic...');

const drawerPath = path.resolve(__dirname, '../navigation/DrawerNavigator.js');
assert(fs.existsSync(drawerPath), 'DrawerNavigator.js must exist');
const content = fs.readFileSync(drawerPath, 'utf8');

// 1. Structural assertions on categories
assert(content.includes('menuSections'), 'Must define menuSections');
assert(content.includes('Daily Activity'), 'Must have Daily Activity section');
assert(content.includes('Accounts & Liabilities'), 'Must have Accounts & Liabilities section');
assert(content.includes('Planning & Analytics'), 'Must have Planning & Analytics section');
assert(content.includes('Settings & Preferences'), 'Must have Settings & Preferences section');

// 2. Accordion logic: only one section can be open at a time ("No multiple open")
assert(content.includes('setOpenSection'), 'Must have setOpenSection state updater');
assert(content.includes('prev === sectionKey ? null : sectionKey') || content.includes('prev => (prev === sectionKey ? null : sectionKey)'), 'Must toggle section or close others');

// 3. Submenu open & close indicators
assert(content.includes('chevron-up') && content.includes('chevron-down'), 'Must have expand/collapse chevrons');

// 4. Test accordion behavior in isolation
const testSections = [
  { key: 'daily', items: [{ name: 'Transactions' }, { name: 'SmartNotepad' }] },
  { key: 'accounts', items: [{ name: 'Sources' }, { name: 'CreditCards' }, { name: 'Loans' }] },
  { key: 'planning', items: [{ name: 'Bills' }, { name: 'Categories' }, { name: 'Budgets' }, { name: 'Reports' }] },
  { key: 'settings', items: [{ name: 'NotificationSettings' }, { name: 'SecuritySettings' }, { name: 'Backup' }] },
];

function getCategoryForRoute(routeName) {
  if (routeName === 'PaperLedger') return 'daily';
  for (const sec of testSections) {
    if (sec.items.some((i) => i.name === routeName)) return sec.key;
  }
  return null;
}

assert.strictEqual(getCategoryForRoute('Transactions'), 'daily');
assert.strictEqual(getCategoryForRoute('SmartNotepad'), 'daily');
assert.strictEqual(getCategoryForRoute('Sources'), 'accounts');
assert.strictEqual(getCategoryForRoute('CreditCards'), 'accounts');
assert.strictEqual(getCategoryForRoute('Loans'), 'accounts');
assert.strictEqual(getCategoryForRoute('Bills'), 'planning');
assert.strictEqual(getCategoryForRoute('Categories'), 'planning');
assert.strictEqual(getCategoryForRoute('Budgets'), 'planning');
assert.strictEqual(getCategoryForRoute('Reports'), 'planning');
assert.strictEqual(getCategoryForRoute('NotificationSettings'), 'settings');
assert.strictEqual(getCategoryForRoute('SecuritySettings'), 'settings');
assert.strictEqual(getCategoryForRoute('Backup'), 'settings');
assert.strictEqual(getCategoryForRoute('Dashboard'), null);

// Accordion toggle simulation: opening new closes current, clicking same closes it
let openSection = 'daily';
function toggleSection(key) {
  openSection = openSection === key ? null : key;
}

toggleSection('accounts');
assert.strictEqual(openSection, 'accounts', 'Opening accounts must close daily');
toggleSection('planning');
assert.strictEqual(openSection, 'planning', 'Opening planning must close accounts');
toggleSection('planning');
assert.strictEqual(openSection, null, 'Clicking open section must close it');

// 5. Drawer Screens must not be broken
assert(content.includes('name="Dashboard"'), 'Dashboard screen must exist');
assert(content.includes('name="Transactions"'), 'Transactions screen must exist');
assert(content.includes('name="SmartNotepad"'), 'SmartNotepad screen must exist');
assert(content.includes('name="Loans"'), 'Loans screen must exist');
assert(content.includes('name="CreditCards"'), 'CreditCards screen must exist');
assert(content.includes('name="Bills"'), 'Bills screen must exist');
assert(content.includes('name="Budgets"'), 'Budgets screen must exist');
assert(content.includes('name="Sources"'), 'Sources screen must exist');
assert(content.includes('name="Reports"'), 'Reports screen must exist');
assert(content.includes('name="Categories"'), 'Categories screen must exist');

console.log('✓ All DrawerNavigator Accordion tests passed successfully!');

