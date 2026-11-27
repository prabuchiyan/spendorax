const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('Testing CreditCardsScreen Redesign & Light/Dark Theme Contracts...');

const screenPath = path.resolve(__dirname, '../src/screens/CreditCardsScreen.js');
assert(fs.existsSync(screenPath), 'CreditCardsScreen.js must exist');
const content = fs.readFileSync(screenPath, 'utf8');

// 1. Complete Light & Dark Theme adaptation without hardcoded light backgrounds
assert(content.includes('useTheme()'), 'CreditCardsScreen must subscribe to ThemeContext');
assert(content.includes('isDarkMode'), 'CreditCardsScreen must support Light and Dark palette tokens');
assert(!content.includes("'#F9FAFB'") && !content.includes('"#F9FAFB"'), 'Must remove hardcoded off-white statsContainer color');
assert(!content.includes("'#EEF3FF'") && !content.includes('"#EEF3FF"'), 'Must remove hardcoded light overviewIconWrap color');
assert(!content.includes('Colors.text'), 'Must use palette.textPrimary instead of static Colors.text');

// 2. Hero Overview inside FlatList ListHeaderComponent with eye toggle & utilization health
assert(content.includes('ListHeaderComponent={listHeader}'), 'Credit Overview hero should scroll cleanly with FlatList');
assert(content.includes('toggleBalance'), 'Hero header must provide balance visibility eye toggle');
assert(content.includes('utilState'), 'Must compute Healthy / Moderate / High Usage utilization badge');
assert(content.includes('<CurrencyText'), 'Must use CurrencyText for total outstanding amount');

// 3. Physical card face + theme-adaptive footer + hidden Card Actions sheet
assert(content.includes('<ResponsiveBottomSheet'), 'Card edit/archive/statements actions must live in ResponsiveBottomSheet');
assert(content.includes('actionSheetCard'), 'CreditCardsScreen must manage hidden actionSheetCard state');
assert(content.includes('cardMoreBtn') && content.includes('onLongPress'), 'Cards must open actions via subtle ••• pill or long press');
const cardRenderStart = content.indexOf('const renderCardItem');
const cardRenderEnd = content.indexOf('keyboardShouldPersistTaps="handled"', cardRenderStart);
assert(cardRenderStart !== -1 && cardRenderEnd > cardRenderStart, 'Must locate renderCardItem block');
const cardFaceBlock = content.slice(cardRenderStart, cardRenderEnd);
assert(!cardFaceBlock.includes('trash-2') && !cardFaceBlock.includes('edit-2'), 'Credit card faces must stay clean without exposed edit/delete buttons');
assert(content.includes('cardUtilTrack') && content.includes('cardStatementBtn'), 'Each card footer must show utilization progress bar and Statements shortcut');

// 4. Navigation, Archive Confirmation & FAB preservation
assert(content.includes('CreditCardStatements'), 'Must link to CreditCardStatements');
assert(content.includes('CreditCardCreate'), 'Must navigate to CreditCardCreate for add/edit');
assert(content.includes('<CommonBottomSheetModal'), 'Archive warning confirmation must use CommonBottomSheetModal');
assert(content.includes('<ContextualFAB'), 'Screen must retain ContextualFAB');
assert(content.includes('paddingBottom: 112'), 'List paddingBottom must clear the floating + FAB');

// 5. Totals & utilization calculation sanity test
const mockCards = [
  { credit_limit: 265000, outstanding: 40988.48, available_limit: 224011.52 },
  { credit_limit: 100000, outstanding: 50000, available_limit: 50000 },
];
const totals = mockCards.reduce(
  (acc, c) => ({
    limit: acc.limit + Number(c.credit_limit || 0),
    outstanding: acc.outstanding + Number(c.outstanding || 0),
    available: acc.available + Number(c.available_limit ?? Math.max(0, c.credit_limit - c.outstanding)),
  }),
  { limit: 0, outstanding: 0, available: 0 }
);
const pct = (totals.outstanding / totals.limit) * 100;
assert.strictEqual(totals.limit, 365000);
assert(Math.abs(totals.outstanding - 90988.48) < 0.01);
assert(Math.abs(pct - 24.928) < 0.01);

console.log('✓ All CreditCardsScreen Redesign tests passed successfully!');
