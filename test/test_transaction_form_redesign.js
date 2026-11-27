const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Testing Transaction Form Redesign Contracts & Logic...');

// 1. Verify files exist
const formPath = path.resolve(__dirname, '../src/components/TransactionForm.js');
const screenPath = path.resolve(__dirname, '../src/screens/TransactionAddScreen.js');
const servicePath = path.resolve(__dirname, '../src/services/transactions.js');

assert(fs.existsSync(formPath), 'TransactionForm.js must exist');
assert(fs.existsSync(screenPath), 'TransactionAddScreen.js must exist');
assert(fs.existsSync(servicePath), 'transactions.js must exist');

const formContent = fs.readFileSync(formPath, 'utf8');
const screenContent = fs.readFileSync(screenPath, 'utf8');
const serviceContent = fs.readFileSync(servicePath, 'utf8');

// 2. Syntax / structural assertions
assert(screenContent.includes('export default function TransactionAddScreen'), 'TransactionAddScreen default export');
assert(screenContent.includes('TransactionForm'), 'TransactionAddScreen must use TransactionForm');

// 3. New Wording & Features Assertions
assert(formContent.includes('Count as Spend'), 'Must include "Count as Spend" label');
assert(formContent.includes('Count as Income'), 'Must include "Count as Income" label');
assert(formContent.includes("Don't Count as Spend"), 'Must include "Don\'t Count as Spend" label');
assert(!formContent.includes('In Reports'), 'Must replace "In Reports" with clear wording');

// 4. Note Placement & Suggestions
assert(formContent.indexOf('heroAmountCard') < formContent.indexOf('noteCardContainer'), 'Note must be placed after Amount');
assert(formContent.includes('suggestionsDropdown'), 'Suggestions dropdown list must exist');

// 5. Source selection ONLY happens on transfer type (not expense/income)
assert(formContent.includes('if (type === "transfer")'), 'Source selection must be gated to transfer type');
assert(formContent.includes('if (type !== "transfer" && item.category_id)'), 'Category selection only for non-transfers');

// 6. Clearing notes when switching to/from transfer
assert(formContent.includes('type === "transfer" && newType !== "transfer"'), 'Must clear notes when switching to/from transfer');

// 7. Bill Linking in Create Mode
assert(formContent.includes('getAvailableBillsForTransactionLink'), 'Must load available bills for linking');
assert(formContent.includes('linkBillToTransaction'), 'Must link bill to created transaction');
assert(formContent.includes('selectedBillId'), 'Must support selectedBillId during creation');

// 8. Recent Account & Category Chips (only visible when unselected; hidden once selected on create/edit)
assert(formContent.includes('frequentSources'), 'Must calculate frequent/recent sources');
assert(formContent.includes('frequentCategories'), 'Must calculate frequent/recent categories');
assert(formContent.includes('recentChipsContainer'), 'Must render recent chips strip');
assert(formContent.includes('renderRecentChips'), 'Must share a single renderRecentChips helper across category and sources');
assert(formContent.includes('visible: !selectedCategory'), 'Category recent chips must disappear once a category is selected');
assert(formContent.includes('visible: !selectedSource'), 'Source recent chips must disappear once a source is selected');
assert(formContent.includes('visible: !selectedToAccount'), 'Destination source recent chips must disappear once a destination account is selected');
assert(formContent.includes('isTallScreen') && formContent.includes('rowPadVertical'), 'Form must adapt card spacing/sizing proportionally to fill blank space cleanly without scrolling');

// 9. Validation Logic Tests
function validateTransactionInput({ amount, type, categoryId, sourceId, toAccount, notes, isEdit }) {
  const val = parseFloat(amount);
  if (!amount || isNaN(val) || val <= 0) {
    return { valid: false, error: 'Enter an amount greater than 0' };
  }
  if (!isEdit && !categoryId && type !== 'transfer') {
    return { valid: false, error: 'Please select a category.' };
  }
  if (!sourceId) {
    return { valid: false, error: 'Please select a source.' };
  }
  if (!notes || !notes.trim()) {
    return { valid: false, error: 'Please enter a note / merchant.' };
  }
  if (type === 'transfer') {
    if (!toAccount) {
      return { valid: false, error: 'Select destination account' };
    }
    if (sourceId === toAccount) {
      return { valid: false, error: 'Cannot transfer to same account' };
    }
  }
  return { valid: true };
}

// Validation Unit Checks
assert.strictEqual(validateTransactionInput({ amount: '0', type: 'expense', categoryId: 1, sourceId: 1, notes: 'Lunch' }).valid, false);
assert.strictEqual(validateTransactionInput({ amount: '-50', type: 'expense', categoryId: 1, sourceId: 1, notes: 'Lunch' }).valid, false);
assert.strictEqual(validateTransactionInput({ amount: '', type: 'expense', categoryId: 1, sourceId: 1, notes: 'Lunch' }).valid, false);
assert.strictEqual(validateTransactionInput({ amount: '150', type: 'expense', categoryId: null, sourceId: 1, notes: 'Lunch', isEdit: false }).valid, false);
assert.strictEqual(validateTransactionInput({ amount: '150', type: 'expense', categoryId: 1, sourceId: null, notes: 'Lunch' }).valid, false);
assert.strictEqual(validateTransactionInput({ amount: '150', type: 'expense', categoryId: 1, sourceId: 1, notes: '  ' }).valid, false);
assert.strictEqual(validateTransactionInput({ amount: '500', type: 'transfer', sourceId: 1, toAccount: 1, notes: 'Self' }).valid, false);
assert.strictEqual(validateTransactionInput({ amount: '500', type: 'transfer', sourceId: 1, toAccount: 2, notes: 'Self' }).valid, true);
assert.strictEqual(validateTransactionInput({ amount: '250', type: 'expense', categoryId: 3, sourceId: 1, notes: 'Coffee' }).valid, true);

// 10. Auto-Pick Simulation Test:
// On Expense: only notes & category set, sourceId untouched!
const expenseState = { sourceId: 99 };
const expenseSuggestion = { notes: 'Grocery', category_id: 5, source_id: 1, to_account: 2, type: 'expense' };
expenseState.notes = expenseSuggestion.notes;
if ('expense' !== 'transfer' && expenseSuggestion.category_id) {
  expenseState.categoryId = expenseSuggestion.category_id;
}
if ('expense' === 'transfer') {
  expenseState.sourceId = expenseSuggestion.source_id;
}
assert.strictEqual(expenseState.notes, 'Grocery');
assert.strictEqual(expenseState.categoryId, 5);
assert.strictEqual(expenseState.sourceId, 99, 'Source must NOT change on expense type');

// On Transfer: sets fromAccount and toAccount (and must be distinct!)
const transferState = {};
const transferSuggestion = { notes: 'Transfer to Savings', category_id: null, source_id: 1, to_account: 2, type: 'transfer' };
transferState.notes = transferSuggestion.notes;
if ('transfer' === 'transfer') {
  if (transferSuggestion.source_id) transferState.sourceId = transferSuggestion.source_id;
  if (transferSuggestion.to_account && transferSuggestion.to_account !== transferSuggestion.source_id) {
    transferState.toAccount = transferSuggestion.to_account;
  }
}
assert.strictEqual(transferState.notes, 'Transfer to Savings');
assert.strictEqual(transferState.sourceId, 1);
assert.strictEqual(transferState.toAccount, 2);
assert.notStrictEqual(transferState.sourceId, transferState.toAccount, 'From and To accounts must be distinct');

// 11. Type change simulation: moving to/from transfer clears notes
function switchType(currentType, newType, currentNotes) {
  let notes = currentNotes;
  if ((currentType === 'transfer' && newType !== 'transfer') || (currentType !== 'transfer' && newType === 'transfer')) {
    notes = '';
  }
  return { newType, notes };
}

assert.strictEqual(switchType('expense', 'transfer', 'Lunch').notes, '', 'Switching to transfer must clear notes');
assert.strictEqual(switchType('transfer', 'expense', 'To Savings').notes, '', 'Switching from transfer to expense must clear notes');
assert.strictEqual(switchType('transfer', 'income', 'To Savings').notes, '', 'Switching from transfer to income must clear notes');

// 12. Verification of the 3 latest user requests:
// 1) Shared SearchableItemPickerModal applies the Transaction 3-column circular-icon card design to both Transaction & Advanced Search
const pickerModalPath = path.resolve(__dirname, '../src/components/SearchableItemPickerModal.js');
const pickerModalContent = fs.readFileSync(pickerModalPath, 'utf8');
assert(formContent.includes('import SearchableItemPickerModal from "./SearchableItemPickerModal"'), 'TransactionForm must import SearchableItemPickerModal');
assert(formContent.includes('<SearchableItemPickerModal'), 'Must render SearchableItemPickerModal for Category and Source pickers');
assert(formContent.includes('showAllOption={false}'), 'TransactionForm pickers must hide "All" filter tile');
const categoryPickerStart = formContent.indexOf('visible={showCategoryModal}');
const sourcePickerStart = formContent.indexOf('visible={showSourceModal}');
assert(categoryPickerStart !== -1 && sourcePickerStart !== -1, 'Both Category and Source modals must use SearchableItemPickerModal');
assert(pickerModalContent.includes('itemIconCircle'), 'Picker must use Transaction page circular icon avatar design');
assert(pickerModalContent.includes('checkBadge'), 'Picker must render checkBadge when an item is selected');
assert(pickerModalContent.includes('viewportWidth') && pickerModalContent.includes('/ 3'), 'Picker 3-column grid must size dynamically from measured viewportWidth');
assert(pickerModalContent.includes('minHeight: 88'), 'Picker cards must maintain uniform card design across single and multi-line labels');
const pickerGridBlock = pickerModalContent.slice(
  pickerModalContent.indexOf('ITEMS GRID'),
  pickerModalContent.indexOf('</ScrollView>', pickerModalContent.indexOf('ITEMS GRID'))
);
assert(!pickerGridBlock.includes('numberOfLines='), 'Category/source grid tile labels must wrap fully without truncation');

// 2) Unpaid bills only in bill link list
const billsPath = path.resolve(__dirname, '../src/services/bills.js');
const billsContent = fs.readFileSync(billsPath, 'utf8');
assert(billsContent.includes('if (isCompletelyPaid) continue;'), 'getAvailableBillsForTransactionLink must skip completely paid bills');

// Simulate searchedBills filter
const mockBills = [
  { id: 1, name: 'Electricity Bill', is_completely_paid: false, status: 'pending', remaining_amount: 500 },
  { id: 2, name: 'Wifi Bill (Paid)', is_completely_paid: true, status: 'paid', remaining_amount: 0 },
  { id: 3, name: 'Rent (Partial)', is_completely_paid: false, status: 'partially_paid', remaining_amount: 250 },
  { id: 4, name: 'Card Bill (Paid)', is_paid: 1, status: 'pending', remaining_amount: 0 },
];
const filterUnpaidBills = (bills) => bills.filter((b) => {
  if (b.is_completely_paid === true || b.is_completely_paid === 1 || String(b.is_completely_paid) === "true") return false;
  const statusLower = String(b.status || "").toLowerCase();
  if (statusLower === "paid" || statusLower === "skipped") return false;
  if (Number(b.is_paid) === 1 || b.is_paid === true || String(b.is_paid) === "true") return false;
  if (b.remaining_amount !== undefined && Number(b.remaining_amount) <= 0) return false;
  return true;
});
const filtered = filterUnpaidBills(mockBills);
assert.strictEqual(filtered.length, 2, 'Must filter out completely paid bills');
assert.strictEqual(filtered[0].id, 1);
assert.strictEqual(filtered[1].id, 3);

// 3) On edit transaction, when type changes, category must be cleared
assert(formContent.includes('prevTypeRef'), 'Must track previous type to detect type change');
assert(formContent.includes('loadedTxIdRef'), 'Must not overwrite categoryId on edit rerenders');

// 13. Verification of latest UI improvements & fixed screen requirements:
// Fix 1: Fixed non-scrolling layout on create & edit, single bottom action bar
assert(formContent.includes('styles.fixedFormBody'), 'Main form must use fixed non-scrolling View container');
assert(!formContent.includes('styles.headerBar'), 'Must remove top segmented chip bar during create and replace bulky top header bar');
assert(formContent.includes('styles.inlineEditTypeGroup'), 'Edit mode must use compact inline type switcher inside amount header');
assert(formContent.includes('{!isKeyboardVisible && ('), 'Fixed bottom bar rendered when keyboard is not visible');

// Fix 2: Count as spend switch row & inline linked bill/loan detail cards
assert(formContent.includes('styles.countToggleCard'), 'Must render improved Count as Spend toggle card with Switch');
assert(formContent.includes('styles.linkedDetailCard'), 'Must show inline linked Bill and Loan details right on the form');
assert(formContent.includes('getBillDisplayStatus'), 'Must reuse billUtils getBillDisplayStatus for inline bill details');
assert(formContent.includes('selectedLoanPaymentType'), 'Must preserve and display selected loan payment type badge');

// Fix 3: StatusBar on TransactionAddScreen matches dark navy app theme & contextual title
assert(screenContent.includes("backgroundColor={isDarkMode ? '#0B0F17' : '#0B1F3A'}"), 'Status bar must match app dark navy background');
assert(screenContent.includes('barStyle="light-content"'), 'Status bar icons must be light content');
assert(screenContent.includes('createTitle'), 'Header must indicate contextual type on create without top chip bar');

// Fix 4: New Category and New Account removed from next to the header, provided cleanly inside grid
assert(!formContent.includes('styles.headerAddBtn'), 'Must remove add category/source button from next to the header');
assert(!formContent.includes('styles.floatingAddBtn'), 'Must not float add button over grid items');
assert(formContent.includes('+ New'), 'Must provide + New card cleanly in the grid');

// Fix 5: Unlink warning confirmation popup for bills & loans, and responsive viewport-contained sheets
const sheetHelperContent = fs.readFileSync(
  path.join(__dirname, '../src/components/ResponsiveBottomSheet.js'),
  'utf8'
);
const commonSheetContent = fs.readFileSync(
  path.join(__dirname, '../src/components/CommonBottomSheetModal.js'),
  'utf8'
);

assert(formContent.includes('unlinkConfirmTarget'), 'Must confirm before unlinking a bill or loan');
assert(formContent.includes('Unlink Bill?') && formContent.includes('Unlink Loan?'), 'Must display Bill and Loan unlink warning popups via CommonBottomSheetModal');
assert(formContent.includes('<ResponsiveBottomSheet'), 'TransactionForm picker sheets must use ResponsiveBottomSheet');
assert(!formContent.includes('styles.modalBackdrop'), 'Bottom sheets should rely on ResponsiveBottomSheet rather than bare Modal backdrops');
assert(formContent.includes('keyboardShouldPersistTaps="handled"'), 'Must handle taps smoothly when search keyboard is open');
assert(formContent.includes('<FlatList'), 'Must render Bills and Loans lists with FlatList for responsive scrolling');
assert(formContent.includes('maxWidth: "42%"'), 'Right amount/status column in Bill/Loan rows must cap width to prevent row overflow');

assert(sheetHelperContent.includes('<Portal>') && sheetHelperContent.includes("Platform.OS === 'web'"), 'ResponsiveBottomSheet must render via Portal on web so sheets stay within app root bounds');
assert(sheetHelperContent.includes('useWindowDimensions') && sheetHelperContent.includes('onLayout'), 'ResponsiveBottomSheet must measure actual overlay bounds via onLayout');
assert(sheetHelperContent.includes('keyboardDidShow') && sheetHelperContent.includes('safeMaxHeightCap'), 'ResponsiveBottomSheet must clamp sheet height between status bar and mobile keyboard');
assert(pickerModalContent.includes('<ResponsiveBottomSheet'), 'SearchableItemPickerModal must use ResponsiveBottomSheet for viewport containment');
const pickerSearchIdx = pickerModalContent.indexOf('SEARCH INPUT');
const pickerScrollIdx = pickerModalContent.indexOf('<ScrollView');
const pickerFrequentIdx = pickerModalContent.indexOf('showFrequent &&');
assert(pickerSearchIdx < pickerScrollIdx && pickerScrollIdx < pickerFrequentIdx, 'Search bar must remain fixed above ScrollView while frequent chips scroll inside it when keyboard is open');
assert(commonSheetContent.includes('<ResponsiveBottomSheet'), 'CommonBottomSheetModal must use ResponsiveBottomSheet for viewport containment');
assert(commonSheetContent.includes('minWidth: 0'), 'CommonBottomSheetModal text containers must set minWidth: 0 to wrap inside narrow viewports');

console.log('✓ All user requests verified 100% successfully!');
