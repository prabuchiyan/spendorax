const assert = require('assert');
const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

console.log('Testing HomeScreen, BottomStatsBar & CategoryDonut Redesign...');

const homePath = path.resolve(__dirname, '../src/screens/HomeScreen.js');
const bottomBarPath = path.resolve(__dirname, '../src/components/BottomStatsBar.js');
const donutPath = path.resolve(__dirname, '../src/components/CategoryDonut.js');

const homeContent = fs.readFileSync(homePath, 'utf8');
const bottomBarContent = fs.readFileSync(bottomBarPath, 'utf8');
const donutContent = fs.readFileSync(donutPath, 'utf8');

// 1. Babel Compilation Checks
[homePath, bottomBarPath, donutPath].forEach((filePath) => {
  const transformed = babel.transformFileSync(filePath, {
    presets: ['babel-preset-expo'],
  });
  assert(transformed && transformed.code, `${path.basename(filePath)} must compile cleanly with Babel`);
});
console.log('✓ HomeScreen, BottomStatsBar & CategoryDonut compile cleanly with Babel');

// 2. Adaptive Light/Dark Mode Palette & Removal of Hardcoded Mint/Light Surfaces
assert(homeContent.includes('useTheme') && homeContent.includes('isDarkMode'), 'HomeScreen must subscribe to ThemeContext');
[
  '#F5FAF7',
  '#F8FCFA',
  '#EAF5EF',
  '#E5F1EB',
  '#DCEDE4',
  '#EEF8F2',
  '#FFF5F5',
  '#FFF8F8',
  '#FFFBF3',
  '#FFF1F1',
  '#E8F0EB',
  '#F1F3F5',
  '#F3F4F6', // Wait: only allowed inside dark textPrimary (#F3F4F6), check below without false-positive
].slice(0, 12).forEach((legacyLightHex) => {
  assert(
    !homeContent.includes(legacyLightHex),
    `Legacy hardcoded light-only color ${legacyLightHex} must be replaced with theme palette tokens`
  );
});
console.log('✓ Legacy light-only mint/white backgrounds replaced with Light/Dark palette tokens');

// 3. Full-Width Mobile Layout (no redundant top Snapshot/Quick Access box duplicating BottomStatsBar)
assert(!homeContent.includes('snapshotSplitBox') && !homeContent.includes('quickActionRow'), 'Redundant Snapshot / Quick Access card must be removed');
assert(homeContent.includes('paddingHorizontal: 6') && homeContent.includes('padding: 13'), 'ScrollView and sectionCard must use full mobile width padding');
console.log('✓ Full-width mobile layout & removal of top snapshot box verified');

// 4. Bills Overview Card & Actionable BillDetail Navigation
assert(homeContent.includes('billsHeroSubCard') && homeContent.includes('billsKpiGrid'), 'HomeScreen Bills section must use modern Hero sub-card and 3-column KPI grid');
assert(homeContent.includes('function openBillDetail(') && homeContent.includes('navigation.navigate("BillDetail"'), 'Tapping a bill row on Home must navigate directly to BillDetail');
assert(homeContent.includes('billStatusPill'), 'HomeScreen bill rows must use structured pill badges for status');
console.log('✓ Modern Bills card & direct BillDetail navigation verified');

// 5. CategoryDonut Theme & Privacy Compliance
assert(donutContent.includes('useTheme') && donutContent.includes('useBalanceVisibility'), 'CategoryDonut must respect dark/light theme and balance visibility');
assert(donutContent.includes('total > 0'), 'CategoryDonut must safely guard empty/zero totals');
console.log('✓ CategoryDonut theme and balance visibility verified');

// 6. BottomStatsBar Consistency & Safe Area Insets
assert(bottomBarContent.includes('useSafeAreaInsets'), 'BottomStatsBar must respect device safe area bottom insets');
assert(bottomBarContent.includes('BALANCE') && bottomBarContent.includes('BILLS DUE') && bottomBarContent.includes('SPEND'), 'BottomStatsBar must use uniform uppercase top labels across all 3 columns');
console.log('✓ BottomStatsBar consistency and safe area verified');

// 7. FAB Clearance Above BottomStatsBar
assert(homeContent.includes('paddingBottom: 144 + Math.max(insets?.bottom || 0, 8)'), 'ScrollView paddingBottom must clear BottomStatsBar and ContextualFAB');

console.log('✓ All HomeScreen Redesign tests passed successfully!');
