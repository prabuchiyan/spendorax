import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Share,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Colors } from '../components/Theme';
import { getAvailableMonths, getTransactionsByDateRange } from '../services/transactions';
import { getCategories } from '../services/categories';
import {
  calculateLedgerTotals,
  formatLedgerAmount,
  formatWhatsAppLedgerText,
  mapDbTransactionsToPaperItems,
} from '../utils/paperLedgerUtils';
import PaperAddRowModal from '../components/PaperAddRowModal';
import PaperMonthPickerModal from '../components/PaperMonthPickerModal';
import PaperSwipeableRow from '../components/PaperSwipeableRow';
import PaperDeleteConfirmModal from '../components/PaperDeleteConfirmModal';

export default function PaperLedgerScreen({ navigation }) {
  const { isDarkMode, theme } = useTheme();

  // Paper items state (pure scratchpad, not writing to DB)
  const [items, setItems] = useState([]);
  const [categoriesMap, setCategoriesMap] = useState({});
  const [availableMonths, setAvailableMonths] = useState([]);
  const [loadingMonths, setLoadingMonths] = useState(false);
  const [importing, setImporting] = useState(false);

  // Modals state
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isMonthModalVisible, setIsMonthModalVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [resetRowCallback, setResetRowCallback] = useState(null);

  // Multi-select state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Load categories and available months on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoadingMonths(true);
        const [cats, months] = await Promise.all([
          getCategories(true).catch(() => []),
          getAvailableMonths().catch(() => []),
        ]);

        if (!isMounted) return;

        const cmap = {};
        (cats || []).forEach((c) => {
          cmap[c.id] = c;
        });
        setCategoriesMap(cmap);
        setAvailableMonths(months || []);
      } catch (err) {
        console.warn('Failed to load initial ledger data', err);
      } finally {
        if (isMounted) setLoadingMonths(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Compute live totals
  const totals = useMemo(() => calculateLedgerTotals(items), [items]);

  // Handle adding custom row
  const handleAddRow = useCallback((newRow) => {
    const item = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: newRow.title,
      type: newRow.type,
      amount: newRow.amount,
      date: new Date().toISOString(),
    };
    setItems((prev) => [...prev, item]);
  }, []);

  // Handle deleting single row
  const handleDeleteRow = useCallback((rowId) => {
    setItems((prev) => prev.filter((it) => it.id !== rowId));
  }, []);

  // Multi-select handlers
  const handleToggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((it) => it.id)));
    }
  }, [selectedIds.size, items]);

  const handleEnterSelectionMode = useCallback((initialId = null) => {
    setIsSelectionMode(true);
    if (initialId) {
      setSelectedIds(new Set([initialId]));
    } else {
      setSelectedIds(new Set());
    }
  }, []);

  const handleExitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handlePromptDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const selectedItems = items.filter((it) => selectedIds.has(it.id));
    const selectedAmount = selectedItems.reduce(
      (acc, it) => acc + (Number(it.amount) || 0),
      0
    );

    setItemToDelete({
      isBatch: true,
      count: selectedIds.size,
      totalAmount: selectedAmount,
    });
  }, [selectedIds, items]);

  // Request delete with cross-platform confirmation dialog (works on Web, iOS, Android)
  const requestDeleteRow = useCallback((item, onCancel) => {
    setItemToDelete(item);
    setResetRowCallback(() => onCancel);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (itemToDelete) {
      if (itemToDelete.isBatch) {
        setItems((prev) => prev.filter((it) => !selectedIds.has(it.id)));
        setSelectedIds(new Set());
        setIsSelectionMode(false);
      } else {
        handleDeleteRow(itemToDelete.id);
      }
      setItemToDelete(null);
      setResetRowCallback(null);
    }
  }, [itemToDelete, selectedIds, handleDeleteRow]);

  const handleCancelDelete = useCallback(() => {
    if (resetRowCallback) {
      resetRowCallback();
    }
    setItemToDelete(null);
    setResetRowCallback(null);
  }, [resetRowCallback]);

  // Handle clearing entire ledger
  const handleClearAll = useCallback(() => {
    if (items.length === 0) return;
    Alert.alert(
      'Clear Paper Ledger',
      'Are you sure you want to remove all calculation entries from this sheet?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => setItems([]),
        },
      ]
    );
  }, [items.length]);

  // Import transactions for a specific month (YYYY-MM)
  const handleImportMonth = useCallback(
    async (monthStr) => {
      try {
        setImporting(true);
        const parts = monthStr.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);

        // Compute start and end ISO dates for the chosen month
        const lastDay = new Date(year, month, 0).getDate();
        const startStr = `${monthStr}-01T00:00:00`;
        const endStr = `${monthStr}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`;

        const txs = await getTransactionsByDateRange(null, startStr, endStr);
        // Keep only income and expense
        const validTxs = (txs || []).filter(
          (t) =>
            t.type &&
            (t.type.toLowerCase() === 'income' || t.type.toLowerCase() === 'expense')
        );

        if (validTxs.length === 0) {
          Alert.alert('No Transactions', `No income or expenses found for ${monthStr}.`);
          return;
        }

        const newItems = mapDbTransactionsToPaperItems(validTxs, categoriesMap);
        setItems((prev) => [...prev, ...newItems]);
        Alert.alert(
          'Transactions Imported',
          `Successfully loaded ${newItems.length} transactions from ${monthStr}.`
        );
      } catch (err) {
        console.error('Error importing month transactions:', err);
        Alert.alert('Error', 'Failed to import transactions from database.');
      } finally {
        setImporting(false);
      }
    },
    [categoriesMap]
  );

  // Import all available months
  const handleImportAll = useCallback(async () => {
    if (availableMonths.length === 0) {
      Alert.alert('No Months', 'No past transaction months found to import.');
      return;
    }
    try {
      setImporting(true);
      // Fetch transactions across earliest to latest month
      const sortedMonths = [...availableMonths].sort();
      const firstMonth = sortedMonths[0];
      const lastMonth = sortedMonths[sortedMonths.length - 1];

      const parts = lastMonth.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const lastDay = new Date(year, month, 0).getDate();

      const startStr = `${firstMonth}-01T00:00:00`;
      const endStr = `${lastMonth}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`;

      const txs = await getTransactionsByDateRange(null, startStr, endStr);
      const validTxs = (txs || []).filter(
        (t) =>
          t.type &&
          (t.type.toLowerCase() === 'income' || t.type.toLowerCase() === 'expense')
      );

      const newItems = mapDbTransactionsToPaperItems(validTxs, categoriesMap);
      setItems((prev) => [...prev, ...newItems]);
      Alert.alert('Imported All', `Added ${newItems.length} transactions across all months.`);
    } catch (err) {
      console.error('Error importing all transactions:', err);
      Alert.alert('Error', 'Failed to import all transactions.');
    } finally {
      setImporting(false);
    }
  }, [availableMonths, categoriesMap]);

  // Share formatted calculation to WhatsApp
  const handleShareToWhatsApp = useCallback(async () => {
    if (items.length === 0) {
      Alert.alert('Empty Paper', 'Add or import transactions before sharing.');
      return;
    }

    const shareText = formatWhatsAppLedgerText(items, totals.netTotal);
    const encodedText = encodeURIComponent(shareText);
    const whatsappUrl = `whatsapp://send?text=${encodedText}`;

    try {
      if (Platform.OS === 'web') {
        const webUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
        window.open(webUrl, '_blank');
        return;
      }

      const supported = await Linking.canOpenURL(whatsappUrl);
      if (supported) {
        await Linking.openURL(whatsappUrl);
      } else {
        // Fallback to standard React Native Share sheet
        await Share.share({
          message: shareText,
          title: 'SpendoraX Paper Ledger',
        });
      }
    } catch (error) {
      console.warn('WhatsApp direct open failed, falling back to Share sheet', error);
      try {
        await Share.share({
          message: shareText,
          title: 'SpendoraX Paper Ledger',
        });
      } catch (e) {
        Alert.alert('Share Failed', 'Unable to open share dialogue.');
      }
    }
  }, [items, totals.netTotal]);

  // Paper styling constants
  const paperBg = isDarkMode ? '#171B24' : '#FDFBF7';
  const paperBorder = isDarkMode ? '#283141' : '#E8E1D3';
  const ruledLineColor = isDarkMode ? '#222A38' : '#ECE5D8';
  const redMarginLine = isDarkMode ? '#F43F5E' : '#EF4444';
  const textColor = isDarkMode ? '#F1F5F9' : '#1E293B';
  const textMuted = isDarkMode ? '#8B9BB4' : '#64748B';

  return (
    <View style={[styles.screen, { backgroundColor: isDarkMode ? '#0F1218' : '#F1F4F9' }]}>
      {/* Top Toolbar Action Bar */}
      {isSelectionMode ? (
        <View
          style={[
            styles.toolbar,
            {
              backgroundColor: isDarkMode ? '#1E2533' : '#EFF6FF',
              borderBottomColor: isDarkMode ? '#2D3A50' : '#BFDBFE',
            },
          ]}
        >
          <View style={styles.toolbarLeft}>
            <TouchableOpacity
              style={[
                styles.toolButtonOutline,
                {
                  borderColor: isDarkMode ? '#3B4863' : '#CBD5E1',
                  backgroundColor: isDarkMode ? '#171E2B' : '#FFFFFF',
                },
              ]}
              onPress={handleExitSelectionMode}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="close" size={17} color={theme.textPrimary} />
              <Text style={[styles.toolButtonOutlineText, { color: theme.textPrimary }]}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.toolButtonOutline,
                {
                  borderColor: Colors.primary,
                  backgroundColor: isDarkMode ? '#172544' : '#DBEAFE',
                },
              ]}
              onPress={handleSelectAll}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name={
                  selectedIds.size === items.length && items.length > 0
                    ? 'checkbox-marked'
                    : 'checkbox-blank-outline'
                }
                size={17}
                color={Colors.primary}
              />
              <Text style={[styles.toolButtonOutlineText, { color: Colors.primary }]}>
                {selectedIds.size === items.length && items.length > 0
                  ? 'Deselect All'
                  : 'Select All'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.toolbarRight}>
            <Text style={[styles.selectionCountText, { color: theme.textSecondary }]}>
              {selectedIds.size} selected
            </Text>

            <TouchableOpacity
              style={[
                styles.deleteSelectedBtn,
                {
                  backgroundColor:
                    selectedIds.size > 0 ? '#EF4444' : isDarkMode ? '#332025' : '#FCA5A5',
                  opacity: selectedIds.size > 0 ? 1 : 0.6,
                },
              ]}
              onPress={handlePromptDeleteSelected}
              disabled={selectedIds.size === 0}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={16} color="#FFF" />
              <Text style={styles.deleteSelectedBtnText}>
                Delete ({selectedIds.size})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.toolbar,
            {
              backgroundColor: isDarkMode ? '#19202C' : '#FFFFFF',
              borderBottomColor: isDarkMode ? '#283244' : '#E2E8F0',
            },
          ]}
        >
          <View style={styles.toolbarLeft}>
            <TouchableOpacity
              style={[styles.toolButton, { backgroundColor: Colors.primary }]}
              onPress={() => setIsMonthModalVisible(true)}
              activeOpacity={0.8}
              disabled={importing}
            >
              {importing ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <MaterialCommunityIcons name="calendar-import" size={17} color="#FFF" />
              )}
              <Text style={styles.toolButtonText}>Import Month</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.toolButtonOutline,
                {
                  borderColor: Colors.primary,
                  backgroundColor: isDarkMode ? '#14223A' : '#EFF6FF',
                },
              ]}
              onPress={() => setIsAddModalVisible(true)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="plus" size={17} color={Colors.primary} />
              <Text style={[styles.toolButtonOutlineText, { color: Colors.primary }]}>
                Add Line
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.toolbarRight}>
            {items.length > 0 && (
              <TouchableOpacity
                style={[
                  styles.toolButtonOutline,
                  {
                    borderColor: isDarkMode ? '#374151' : '#CBD5E1',
                    backgroundColor: isDarkMode ? '#1F2937' : '#F8FAFC',
                  },
                ]}
                onPress={() => handleEnterSelectionMode()}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="checkbox-multiple-marked-outline"
                  size={16}
                  color={theme.textPrimary}
                />
                <Text style={[styles.toolButtonOutlineText, { color: theme.textPrimary }]}>
                  Select
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.shareBtn, { backgroundColor: '#25D366' }]}
              onPress={handleShareToWhatsApp}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="whatsapp" size={18} color="#FFF" />
              <Text style={styles.shareBtnText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main Notebook Paper Area */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.paperSheet,
            {
              backgroundColor: paperBg,
              borderColor: paperBorder,
            },
          ]}
        >
          {/* Top Binding Tape of Math Calc Book */}
          <View style={styles.notebookTape}>
            <View style={styles.tapeStitchRow}>
              {[...Array(14)].map((_, i) => (
                <View key={i} style={styles.tapeStitchDot} />
              ))}
            </View>
            <View style={styles.tapeTitleRow}>
              <Text style={styles.tapeTitle}>SPENDORAX MATH CALCULATION PAD</Text>
              <Text style={styles.tapeSub}>
                {isSelectionMode
                  ? `${selectedIds.size} of ${items.length} selected`
                  : `${items.length} ${items.length === 1 ? 'entry' : 'entries'} • Swipe row or tap Select`}
              </Text>
            </View>
          </View>

          {/* Paper Table Header (75% / 25%) */}
          <View
            style={[
              styles.tableRowHeader,
              {
                borderBottomColor: ruledLineColor,
                backgroundColor: isDarkMode ? '#131720' : '#F7F3EB',
              },
            ]}
          >
            {/* 75% Left Header */}
            <View
              style={[
                styles.col75,
                styles.headerCol,
                { borderRightColor: redMarginLine },
              ]}
            >
              <Text style={[styles.headerLabel, { color: textMuted }]}>
                PARTICULARS (INCOME & EXPENSE)
              </Text>
            </View>

            {/* 25% Right Header */}
            <View style={[styles.col25, styles.headerCol]}>
              <Text style={[styles.headerLabelRight, { color: textMuted }]}>AMOUNT</Text>
            </View>
          </View>

          {/* Paper Rows (80% / 20% split) */}
          {items.length === 0 ? (
            <View style={styles.emptyPaperNotice}>
              <MaterialCommunityIcons
                name="notebook-outline"
                size={44}
                color={textMuted}
                style={{ marginBottom: 10, opacity: 0.6 }}
              />
              <Text style={[styles.emptyPaperTitle, { color: textColor }]}>
                Clean Sheet Ready
              </Text>
              <Text style={[styles.emptyPaperDesc, { color: textMuted }]}>
                Tap "Import Month" to bring transactions from your records, or "+ Add Line" to jot
                down calculations.
              </Text>
            </View>
          ) : (
            items.map((item, index) => (
              <PaperSwipeableRow
                key={item.id}
                item={item}
                index={index}
                isIncome={item.type === 'income'}
                formatLedgerAmount={formatLedgerAmount}
                onRequestDelete={requestDeleteRow}
                paperBg={paperBg}
                ruledLineColor={ruledLineColor}
                redMarginLine={redMarginLine}
                textColor={textColor}
                textMuted={textMuted}
                isDarkMode={isDarkMode}
                isSelectionMode={isSelectionMode}
                isSelected={selectedIds.has(item.id)}
                onToggleSelect={handleToggleSelect}
                onLongPress={handleEnterSelectionMode}
              />
            ))
          )}

          {/* Additional ruled lines for notebook paper feel if few items */}
          {items.length > 0 && items.length < 5 && (
            [...Array(5 - items.length)].map((_, i) => (
              <View
                key={`empty-rule-${i}`}
                style={[
                  styles.tableRow,
                  { borderBottomColor: ruledLineColor, height: 44 },
                ]}
              >
                <View
                  style={[
                    styles.col75,
                    styles.cell75,
                    { borderRightColor: redMarginLine },
                  ]}
                />
                <View style={[styles.col25, styles.cell25]} />
              </View>
            ))
          )}

          {/* Bottom Total Row with continuing 75% / 25% vertical divide */}
          <View
            style={[
              styles.totalRow,
              {
                borderTopColor: isDarkMode ? '#283141' : '#D1C7B7',
                borderBottomColor: ruledLineColor,
                backgroundColor: isDarkMode ? '#131822' : '#F4EFE6',
              },
            ]}
          >
            {/* 75% Bottom: "Total" */}
            <View
              style={[
                styles.col75,
                styles.totalCol75,
                { borderRightColor: redMarginLine },
              ]}
            >
              <View>
                <Text style={[styles.totalLabel, { color: textColor }]}>Total</Text>
                <Text style={[styles.totalSub, { color: textMuted }]}>
                  (Income − Expenses)
                </Text>
              </View>
              <View style={styles.breakdownPillContainer}>
                <Text style={styles.breakdownIncome}>
                  {totals.totalIncome > 0 ? '+' : ''}{formatLedgerAmount(totals.totalIncome)}
                </Text>
                <Text style={styles.breakdownExpense}>
                  {totals.totalExpense > 0 ? '−' : ''}{formatLedgerAmount(totals.totalExpense)}
                </Text>
              </View>
            </View>

            {/* 25% Bottom: Net Total Amount */}
            <View style={[styles.col25, styles.totalCol25]}>
              <Text
                style={[
                  styles.totalAmountText,
                  {
                    color:
                      totals.netTotal > 0
                        ? '#10B981'
                        : totals.netTotal < 0
                          ? '#EF4444'
                          : textColor,
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
              >
                {totals.netTotal > 0 ? '+' : ''}
                {formatLedgerAmount(totals.netTotal)}
              </Text>
            </View>
          </View>

          {/* Double rule under Total row (classic accounting underline) */}
          <View
            style={[
              styles.doubleUnderline,
              { borderTopColor: isDarkMode ? '#283141' : '#D1C7B7' },
            ]}
          />
        </View>
      </ScrollView>

      {/* Modal: Add Custom Row */}
      <PaperAddRowModal
        visible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
        onAdd={handleAddRow}
      />

      {/* Modal: Month Picker */}
      <PaperMonthPickerModal
        visible={isMonthModalVisible}
        months={availableMonths}
        loading={loadingMonths}
        onClose={() => setIsMonthModalVisible(false)}
        onSelectMonth={handleImportMonth}
        onSelectAll={handleImportAll}
      />

      {/* Modal: Delete Confirmation (Cross-platform) */}
      <PaperDeleteConfirmModal
        visible={!!itemToDelete}
        item={itemToDelete}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  toolbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 5,
  },
  toolButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  toolButtonOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  toolButtonOutlineText: {
    fontSize: 13,
    fontWeight: '600',
  },
  selectionCountText: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
  },
  deleteSelectedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  deleteSelectedBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  iconActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 5,
  },
  shareBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 12,
    paddingBottom: 32,
  },
  paperSheet: {
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  notebookTape: {
    backgroundColor: '#854D0E',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  tapeStitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tapeStitchDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  tapeTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tapeTitle: {
    color: '#FEF3C7',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tapeSub: {
    color: 'rgba(254,243,199,0.8)',
    fontSize: 11,
    fontWeight: '600',
  },
  tableRowHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
  },
  headerCol: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  headerLabelRight: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textAlign: 'right',
  },
  col75: {
    width: '75%',
    borderRightWidth: 1.5,
  },
  col25: {
    width: '25%',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    minHeight: 52,
  },
  cell75: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  cell25: {
    paddingVertical: 8,
    paddingLeft: 2,
    paddingRight: 8,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  emptyPaperNotice: {
    paddingVertical: 44,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPaperTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyPaperDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 300,
  },
  totalRow: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  totalCol75: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  totalCol25: {
    paddingLeft: 2,
    paddingRight: 8,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  totalSub: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  breakdownPillContainer: {
    alignItems: 'flex-end',
  },
  breakdownIncome: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '600',
  },
  breakdownExpense: {
    fontSize: 10,
    color: '#EF4444',
    fontWeight: '600',
  },
  totalAmountText: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
  },
  doubleUnderline: {
    borderTopWidth: 2,
    height: 4,
  },
});

