import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
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
  isTransferTransaction,
  parseNotepadLine,
} from '../utils/paperLedgerUtils';
import PaperAddRowModal from '../components/PaperAddRowModal';
import PaperMonthPickerModal from '../components/PaperMonthPickerModal';
import PaperSwipeableRow from '../components/PaperSwipeableRow';
import PaperDeleteConfirmModal from '../components/PaperDeleteConfirmModal';
import PaperConfirmModal from '../components/PaperConfirmModal';
import PaperSaveSheetModal from '../components/PaperSaveSheetModal';
import PaperSavedSheetsModal from '../components/PaperSavedSheetsModal';
import PaperImportSelectModal from '../components/PaperImportSelectModal';
import PaperToast from '../components/PaperToast';
import ContextualFAB from '../components/ContextualFAB';
import {
  savePaperLedger,
  getPaperLedgers,
  togglePinPaperLedger,
  deletePaperLedger,
} from '../services/paperLedgerService';

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
  const [editingItem, setEditingItem] = useState(null);
  const [resetEditRowCallback, setResetEditRowCallback] = useState(null);
  const [isMonthModalVisible, setIsMonthModalVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [resetRowCallback, setResetRowCallback] = useState(null);

  // Multi-select state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Saved Sheet Persistence State
  const [savedSheets, setSavedSheets] = useState([]);
  const [activeSheetId, setActiveSheetId] = useState(null);
  const [activeSheetTitle, setActiveSheetTitle] = useState(null);
  const [activeSheetLastUpdated, setActiveSheetLastUpdated] = useState(null);
  const [isSaveModalVisible, setIsSaveModalVisible] = useState(false);
  const [isSavedSheetsModalVisible, setIsSavedSheetsModalVisible] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState(null);

  // Notepad-style quick typing state (Option B)
  const notepadInputRef = useRef(null);
  const [notepadInput, setNotepadInput] = useState('');
  const [notepadType, setNotepadType] = useState('expense'); // 'expense' | 'income'

  // Modern Toast notification state
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const showToast = useCallback((message, type = 'success') => {
    setToast({ visible: true, message, type });
  }, []);
  const hideToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  // Selective Import Checklist Modal state
  const [isImportSelectModalVisible, setIsImportSelectModalVisible] = useState(false);
  const [candidateImportItems, setCandidateImportItems] = useState([]);
  const [importMonthLabel, setImportMonthLabel] = useState('');

  // Month label formatter (e.g. 2026-12 -> December 2026)
  const formatMonthYearLabel = useCallback((monthYearStr) => {
    if (!monthYearStr) return '';
    const parts = monthYearStr.split('-');
    if (parts.length < 2) return monthYearStr;
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[monthIdx] || parts[1]} ${year}`;
  }, []);

  // Cross-platform info alert helper (works on Web, iOS, Android)
  const showInfoAlert = useCallback((title, message) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.alert) {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  }, []);

  // Load saved sheets from database
  const loadSavedSheets = useCallback(async () => {
    try {
      const sheets = await getPaperLedgers();
      setSavedSheets(sheets || []);
    } catch (err) {
      console.warn('Failed to load saved sheets', err);
    }
  }, []);

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
        loadSavedSheets();
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

  // Handle adding custom row or saving edits
  const handleSaveRow = useCallback(
    (rowPayload) => {
      if (rowPayload.id) {
        // Updating existing row
        setItems((prev) =>
          prev.map((it) => (it.id === rowPayload.id ? { ...it, ...rowPayload } : it))
        );
        if (resetEditRowCallback) {
          resetEditRowCallback();
        }
      } else {
        // Adding new row
        const item = {
          id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          title: rowPayload.title,
          type: rowPayload.type,
          amount: rowPayload.amount,
          formula: rowPayload.formula || null,
          date: new Date().toISOString(),
        };
        setItems((prev) => [...prev, item]);
      }
      setEditingItem(null);
      setResetEditRowCallback(null);
    },
    [resetEditRowCallback]
  );

  // Commit freeform line typed directly like a notepad (Enter key or Add button)
  const handleCommitNotepadLine = useCallback(() => {
    const raw = (notepadInput || '').trim();
    if (!raw) return;

    const parsed = parseNotepadLine(raw, notepadType);
    if (!parsed) {
      showToast('Could not find amount in line. Try e.g. "Dinner 450"', 'error');
      return;
    }

    const newItem = {
      id: `notepad_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: parsed.title,
      type: parsed.type,
      amount: parsed.amount,
      formula: parsed.formula || null,
      date: new Date().toISOString(),
    };

    setItems((prev) => [...prev, newItem]);
    setNotepadInput('');
    showToast(`Added "${parsed.title}" (₹${formatLedgerAmount(parsed.amount)})`, 'success');

    // Keep input focused so the next line can be typed immediately
    setTimeout(() => {
      notepadInputRef.current?.focus();
    }, 60);
  }, [notepadInput, notepadType, showToast]);

  // Open edit modal for an existing row
  const handleOpenEdit = useCallback((item, onCancel) => {
    setEditingItem(item);
    setResetEditRowCallback(() => onCancel);
    setIsAddModalVisible(true);
  }, []);

  // Close add/edit modal and reset swiped row position if cancelled
  const handleCloseAddEditModal = useCallback(() => {
    if (resetEditRowCallback) {
      resetEditRowCallback();
    }
    setIsAddModalVisible(false);
    setEditingItem(null);
    setResetEditRowCallback(null);
  }, [resetEditRowCallback]);

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
    setConfirmModalConfig({
      title: 'Clear Paper Ledger',
      message: 'Are you sure you want to remove all calculation entries from this sheet?',
      confirmLabel: 'Clear All',
      confirmIcon: 'trash-can-outline',
      confirmColor: '#EF4444',
      isDestructive: true,
      onConfirm: () => {
        setItems([]);
        setConfirmModalConfig(null);
      },
    });
  }, [items.length]);

  // Handle prompt for saving
  const handlePromptSave = useCallback(() => {
    if (items.length === 0) {
      showToast('Please add calculation rows before saving', 'info');
      return;
    }
    setIsSaveModalVisible(true);
  }, [items.length, showToast]);

  // Handle saving sheet to DB (new or update)
  const handleSaveSheetSubmit = useCallback(
    async (titleToSave, asNew = false) => {
      try {
        const shouldCreateNew = asNew || !activeSheetId;
        const targetId = shouldCreateNew ? null : activeSheetId;

        const savedId = await savePaperLedger({
          id: targetId,
          title: titleToSave,
          items,
          totalIncome: totals.totalIncome,
          totalExpense: totals.totalExpense,
          netTotal: totals.netTotal,
        });

        setActiveSheetId(savedId);
        setActiveSheetTitle(titleToSave);
        setActiveSheetLastUpdated(new Date().toISOString());

        await loadSavedSheets();

        showToast(
          shouldCreateNew
            ? `Sheet "${titleToSave}" saved to records`
            : `Sheet "${titleToSave}" updated`,
          'success'
        );
      } catch (err) {
        console.error('Error saving paper ledger:', err);
        showToast('Failed to save sheet to database', 'error');
      }
    },
    [activeSheetId, items, totals, loadSavedSheets, showToast]
  );

  // Handle opening a saved sheet
  const handleSelectSheet = useCallback((sheet) => {
    setItems(sheet.items || []);
    setActiveSheetId(sheet.id);
    setActiveSheetTitle(sheet.title);
    setActiveSheetLastUpdated(sheet.updated_at);
  }, []);

  // Handle starting a fresh sheet
  const handleNewSheet = useCallback(() => {
    setItems([]);
    setActiveSheetId(null);
    setActiveSheetTitle(null);
    setActiveSheetLastUpdated(null);
  }, []);

  const handlePromptNewSheet = useCallback(() => {
    if (items.length > 0) {
      setConfirmModalConfig({
        title: 'Start New Sheet?',
        message: 'This will clear the current calculation entries and start a fresh sheet. Make sure your changes are saved.',
        confirmLabel: 'New Sheet',
        confirmIcon: 'plus-circle-outline',
        confirmColor: Colors.primary,
        onConfirm: () => {
          handleNewSheet();
          setConfirmModalConfig(null);
        },
      });
    } else {
      handleNewSheet();
    }
  }, [items.length, handleNewSheet]);

  // Handle pin toggle
  const handleTogglePinSheet = useCallback(
    async (id, currentPinned) => {
      try {
        await togglePinPaperLedger(id, !currentPinned);
        await loadSavedSheets();
      } catch (err) {
        console.warn('Failed to toggle pin state', err);
      }
    },
    [loadSavedSheets]
  );

  // Handle deleting saved sheet
  const handleDeleteSheet = useCallback(
    (sheet) => {
      setConfirmModalConfig({
        title: 'Delete Saved Ledger',
        message: `Are you sure you want to delete "${sheet.title}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        confirmIcon: 'trash-can-outline',
        confirmColor: '#EF4444',
        isDestructive: true,
        onConfirm: async () => {
          setConfirmModalConfig(null);
          try {
            await deletePaperLedger(sheet.id);
            if (activeSheetId === sheet.id) {
              handleNewSheet();
            }
            await loadSavedSheets();
          } catch (err) {
            console.error('Failed to delete saved ledger', err);
            showInfoAlert('Error', 'Failed to delete sheet.');
          }
        },
      });
    },
    [activeSheetId, handleNewSheet, loadSavedSheets, showInfoAlert]
  );

  // Import transactions for a specific month (YYYY-MM) via selective checklist modal
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
        // Exclude all transfer transactions and keep only genuine income and expense
        const validTxs = (txs || []).filter(
          (t) =>
            !isTransferTransaction(t) &&
            t.type &&
            (t.type.toLowerCase() === 'income' || t.type.toLowerCase() === 'expense')
        );

        if (validTxs.length === 0) {
          showToast(`No income or expenses found for ${formatMonthYearLabel(monthStr) || monthStr}`, 'info');
          return;
        }

        const newItems = mapDbTransactionsToPaperItems(validTxs, categoriesMap);
        setCandidateImportItems(newItems);
        setImportMonthLabel(formatMonthYearLabel(monthStr));
        setIsMonthModalVisible(false);
        setIsImportSelectModalVisible(true);
      } catch (err) {
        console.error('Error importing month transactions:', err);
        showToast('Failed to import transactions from database', 'error');
      } finally {
        setImporting(false);
      }
    },
    [categoriesMap, formatMonthYearLabel, showToast]
  );

  // Import all available months via selective checklist modal
  const handleImportAll = useCallback(async () => {
    if (availableMonths.length === 0) {
      showToast('No past transaction months found to import', 'info');
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
      // Exclude all transfer transactions and keep only genuine income and expense
      const validTxs = (txs || []).filter(
        (t) =>
          !isTransferTransaction(t) &&
          t.type &&
          (t.type.toLowerCase() === 'income' || t.type.toLowerCase() === 'expense')
      );

      if (validTxs.length === 0) {
        showToast('No income or expenses found across recorded months', 'info');
        return;
      }

      const newItems = mapDbTransactionsToPaperItems(validTxs, categoriesMap);
      setCandidateImportItems(newItems);
      setImportMonthLabel('All Recorded Months');
      setIsMonthModalVisible(false);
      setIsImportSelectModalVisible(true);
    } catch (err) {
      console.error('Error importing all transactions:', err);
      showToast('Failed to import all transactions', 'error');
    } finally {
      setImporting(false);
    }
  }, [availableMonths, categoriesMap, showToast]);

  // Handle confirming selected items from Selective Import modal
  const handleConfirmImportSelected = useCallback((selectedItems) => {
    if (!selectedItems || selectedItems.length === 0) return;
    setItems((prev) => [...prev, ...selectedItems]);
    setIsImportSelectModalVisible(false);
    setCandidateImportItems([]);
    showToast(`Imported ${selectedItems.length} transactions into paper ledger`, 'success');
  }, [showToast]);

  // Share formatted calculation to WhatsApp
  const handleShareToWhatsApp = useCallback(async () => {
    if (items.length === 0) {
      showToast('Add or import transactions before sharing', 'info');
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
        showInfoAlert('Share Failed', 'Unable to open share dialogue.');
      }
    }
  }, [items, totals.netTotal, showInfoAlert]);

  // Modern Fintech styling constants
  const screenBg = isDarkMode ? '#0B0F17' : '#F8FAFC';
  const cardBg = isDarkMode ? '#131926' : '#FFFFFF';
  const cardBorder = isDarkMode ? '#1F293D' : '#E2E8F0';
  const headerBg = isDarkMode ? '#162032' : '#F8FAFC';
  const headerBorder = isDarkMode ? '#1F293D' : '#E2E8F0';
  const tableHeaderBg = isDarkMode ? '#101622' : '#F8FAFC';
  const rowDividerColor = isDarkMode ? '#1F293D' : '#F1F5F9';
  const colDividerColor = isDarkMode ? '#1F293D' : '#F1F5F9';
  const textColor = isDarkMode ? '#F8FAFC' : '#0F172A';
  const textMuted = isDarkMode ? '#94A3B8' : '#64748B';

  const netStatus = useMemo(() => {
    if (totals.netTotal > 0) {
      return {
        label: 'Surplus',
        color: isDarkMode ? '#34D399' : '#059669',
        bg: isDarkMode ? '#064E3B' : '#ECFDF5',
        icon: 'trending-up',
      };
    }
    if (totals.netTotal < 0) {
      return {
        label: 'Deficit',
        color: isDarkMode ? '#FB7185' : '#E11D48',
        bg: isDarkMode ? '#4C0519' : '#FFF1F2',
        icon: 'trending-down',
      };
    }
    return {
      label: 'Balanced',
      color: textMuted,
      bg: isDarkMode ? '#1E293B' : '#F1F5F9',
      icon: 'scale-balance',
    };
  }, [totals.netTotal, isDarkMode, textMuted]);

  return (
    <View style={[styles.screen, { backgroundColor: screenBg }]}>
      {/* Top Action Bar (Horizontally scrollable, never cuts off) */}
      <View
        style={[
          styles.toolbarWrapper,
          {
            backgroundColor: isDarkMode ? '#19202C' : '#FFFFFF',
            borderBottomColor: isDarkMode ? '#283244' : '#E2E8F0',
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toolbarScrollContent}
        >
          {isSelectionMode ? (
            <>
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
                <MaterialCommunityIcons name="close" size={16} color={theme.textPrimary} />
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
                  size={16}
                  color={Colors.primary}
                />
                <Text style={[styles.toolButtonOutlineText, { color: Colors.primary }]}>
                  {selectedIds.size === items.length && items.length > 0
                    ? 'Deselect All'
                    : 'Select All'}
                </Text>
              </TouchableOpacity>

              <View style={styles.selectionCountPill}>
                <Text style={[styles.selectionCountText, { color: theme.textSecondary }]}>
                  {selectedIds.size} selected
                </Text>
              </View>

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
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.toolButton, { backgroundColor: Colors.primary }]}
                onPress={() => setIsMonthModalVisible(true)}
                activeOpacity={0.8}
                disabled={importing}
              >
                {importing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <MaterialCommunityIcons name="calendar-import" size={16} color="#FFF" />
                )}
                <Text style={styles.toolButtonText}>Import Month</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.toolButtonOutline,
                  {
                    borderColor: activeSheetId ? '#10B981' : Colors.primary,
                    backgroundColor: activeSheetId
                      ? isDarkMode ? '#0A2E20' : '#ECFDF5'
                      : isDarkMode ? '#14223A' : '#EFF6FF',
                  },
                ]}
                onPress={handlePromptSave}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name={activeSheetId ? 'content-save-check-outline' : 'content-save-outline'}
                  size={16}
                  color={activeSheetId ? '#10B981' : Colors.primary}
                />
                <Text
                  style={[
                    styles.toolButtonOutlineText,
                    { color: activeSheetId ? '#10B981' : Colors.primary },
                  ]}
                >
                  {activeSheetId ? 'Update' : 'Save'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.toolButtonOutline,
                  {
                    borderColor: isDarkMode ? '#3B4863' : '#CBD5E1',
                    backgroundColor: isDarkMode ? '#171E2B' : '#FFFFFF',
                  },
                ]}
                onPress={() => setIsSavedSheetsModalVisible(true)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="book-open-outline" size={16} color={theme.textPrimary} />
                <Text style={[styles.toolButtonOutlineText, { color: theme.textPrimary }]}>
                  Sheets ({savedSheets.length})
                </Text>
              </TouchableOpacity>


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
                <MaterialCommunityIcons name="whatsapp" size={16} color="#FFF" />
                <Text style={styles.shareBtnText}>Share</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>

      {/* Main Notebook Paper Area */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.fintechSheet,
            {
              backgroundColor: cardBg,
              borderColor: cardBorder,
            },
          ]}
        >
          {/* Top Fintech Card Header */}
          <View
            style={[
              styles.fintechHeader,
              {
                backgroundColor: headerBg,
                borderBottomColor: headerBorder,
              },
            ]}
          >
            <View style={styles.fintechHeaderMainRow}>
              <View style={styles.fintechTitleBlock}>
                <View
                  style={[
                    styles.titleIconBadge,
                    {
                      backgroundColor: isDarkMode ? '#172554' : '#EFF6FF',
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={activeSheetTitle ? 'bookmark-check' : 'calculator-variant-outline'}
                    size={16}
                    color={activeSheetTitle ? '#3B82F6' : '#6366F1'}
                  />
                </View>

                <Text
                  style={[styles.fintechSheetTitle, { color: textColor }]}
                  numberOfLines={1}
                >
                  {activeSheetTitle ? activeSheetTitle : 'Financial Calculation Sheet'}
                </Text>

                {activeSheetTitle && (
                  <TouchableOpacity
                    onPress={() => setIsSaveModalVisible(true)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={[
                      styles.editTitleBtn,
                      { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' },
                    ]}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name="pencil"
                      size={12}
                      color={isDarkMode ? '#94A3B8' : '#64748B'}
                    />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.fintechHeaderControls}>
                {(activeSheetTitle || items.length > 0) && (
                  <TouchableOpacity
                    style={[
                      styles.fintechNewBtn,
                      {
                        backgroundColor: isDarkMode ? '#172554' : '#EFF6FF',
                        borderColor: isDarkMode ? '#1E3A8A' : '#BFDBFE',
                      },
                    ]}
                    onPress={handlePromptNewSheet}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="plus" size={13} color="#3B82F6" />
                    <Text style={styles.fintechNewBtnText}>New</Text>
                  </TouchableOpacity>
                )}

                <View
                  style={[
                    styles.fintechCountBadge,
                    {
                      backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                    },
                  ]}
                >
                  <Text style={[styles.fintechCountText, { color: textMuted }]}>
                    {items.length} {items.length === 1 ? 'entry' : 'entries'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.fintechHeaderSubRow}>
              <Text style={[styles.fintechSubText, { color: textMuted }]} numberOfLines={1}>
                {isSelectionMode
                  ? `${selectedIds.size} of ${items.length} selected • Tap rows to toggle`
                  : activeSheetLastUpdated
                    ? `Saved Sheet • Updated ${new Date(activeSheetLastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} • Swipe L/R to edit or delete`
                    : 'Swipe right to delete • Swipe left to edit • Tap Save to keep in database'}
              </Text>
            </View>
          </View>

          {/* Table Column Header: 65% / 35% Grid */}
          <View
            style={[
              styles.tableRowHeader,
              {
                borderBottomColor: rowDividerColor,
                backgroundColor: tableHeaderBg,
              },
            ]}
          >
            {/* 65% Left Header */}
            <View
              style={[
                styles.col65,
                styles.headerCol,
                { borderRightColor: colDividerColor },
              ]}
            >
              <Text style={[styles.headerLabel, { color: textMuted }]}>
                TRANSACTION / FORMULA
              </Text>
            </View>

            {/* 35% Right Header */}
            <View style={[styles.col35, styles.headerColRight]}>
              <Text style={[styles.headerLabelRight, { color: textMuted }]}>
                AMOUNT (₹)
              </Text>
            </View>
          </View>

          {/* Rows */}
          {items.map((item, index) => (
            <PaperSwipeableRow
              key={item.id}
              item={item}
              index={index}
              isIncome={item.type === 'income'}
              formatLedgerAmount={formatLedgerAmount}
              onRequestDelete={requestDeleteRow}
              onRequestEdit={handleOpenEdit}
              paperBg={cardBg}
              rowDividerColor={rowDividerColor}
              columnDividerColor={colDividerColor}
              textColor={textColor}
              textMuted={textMuted}
              isDarkMode={isDarkMode}
              isSelectionMode={isSelectionMode}
              isSelected={selectedIds.has(item.id)}
              onToggleSelect={handleToggleSelect}
              onLongPress={handleEnterSelectionMode}
            />
          ))}

          {/* Empty state notice (if 0 items) */}
          {items.length === 0 && (
            <View style={styles.emptyNotice}>
              <View
                style={[
                  styles.emptyIconCircle,
                  { backgroundColor: isDarkMode ? '#172554' : '#EFF6FF' },
                ]}
              >
                <MaterialCommunityIcons
                  name="notebook-edit-outline"
                  size={36}
                  color={Colors.primary}
                />
              </View>
              <Text style={[styles.emptyTitle, { color: textColor }]}>
                Notepad Ledger Ready
              </Text>
              <Text style={[styles.emptyDesc, { color: textMuted }]}>
                Type directly below (e.g. Dinner 450 or Salary +50000) and press Enter ↵ to add rows instantly, or import from your database.
              </Text>
            </View>
          )}

          {/* Inline Notepad Quick-Entry Bar (Type directly & press Enter to advance) */}
          {!isSelectionMode && (
            <View
              style={[
                styles.notepadBar,
                {
                  backgroundColor: isDarkMode ? '#111827' : '#F8FAFC',
                  borderTopColor: rowDividerColor,
                  borderBottomColor: rowDividerColor,
                },
              ]}
            >
              {/* Type toggle pill (Inflow + / Outflow −) */}
              <TouchableOpacity
                style={[
                  styles.notepadTypeToggle,
                  {
                    backgroundColor:
                      notepadType === 'income'
                        ? (isDarkMode ? '#064E3B' : '#ECFDF5')
                        : (isDarkMode ? '#4C0519' : '#FFF1F2'),
                    borderColor:
                      notepadType === 'income'
                        ? (isDarkMode ? '#065F46' : '#A7F3D0')
                        : (isDarkMode ? '#881337' : '#FECDD3'),
                  },
                ]}
                onPress={() => setNotepadType((prev) => (prev === 'income' ? 'expense' : 'income'))}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons
                  name={notepadType === 'income' ? 'plus-circle' : 'minus-circle'}
                  size={14}
                  color={notepadType === 'income' ? '#10B981' : '#EF4444'}
                />
                <Text
                  style={[
                    styles.notepadTypeToggleText,
                    { color: notepadType === 'income' ? '#10B981' : '#EF4444' },
                  ]}
                >
                  {notepadType === 'income' ? '+ Inflow' : '− Outflow'}
                </Text>
              </TouchableOpacity>

              {/* Freeform Text Input */}
              <TextInput
                ref={notepadInputRef}
                style={[
                  styles.notepadTextInput,
                  {
                    color: textColor,
                  },
                ]}
                placeholder="Type note & amount (e.g. Dinner 450, Salary +50000, 100+25)..."
                placeholderTextColor={textMuted}
                value={notepadInput}
                onChangeText={setNotepadInput}
                onSubmitEditing={handleCommitNotepadLine}
                returnKeyType="next"
                blurOnSubmit={false}
              />

              {/* Enter / Add Button */}
              <TouchableOpacity
                style={[
                  styles.notepadAddBtn,
                  {
                    backgroundColor:
                      notepadInput.trim().length > 0
                        ? (theme.primary || Colors.primary)
                        : (isDarkMode ? '#1E293B' : '#E2E8F0'),
                  },
                ]}
                disabled={notepadInput.trim().length === 0}
                onPress={handleCommitNotepadLine}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="arrow-down-left"
                  size={14}
                  color={notepadInput.trim().length > 0 ? '#FFFFFF' : textMuted}
                />
                <Text
                  style={[
                    styles.notepadAddBtnText,
                    {
                      color: notepadInput.trim().length > 0 ? '#FFFFFF' : textMuted,
                    },
                  ]}
                >
                  ↵
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Modern Fintech Hero Balance Summary Card */}
          <View
            style={[
              styles.heroSummaryContainer,
              {
                borderTopColor: rowDividerColor,
                backgroundColor: isDarkMode ? '#0E1420' : '#F8FAFC',
              },
            ]}
          >
            {/* Breakdown Chips: Inflow & Outflow */}
            <View style={styles.breakdownRow}>
              <View
                style={[
                  styles.breakdownChip,
                  {
                    backgroundColor: isDarkMode ? '#064E3B' : '#ECFDF5',
                    borderColor: isDarkMode ? '#065F46' : '#A7F3D0',
                  },
                ]}
              >
                <View style={[styles.breakdownChipIcon, { backgroundColor: isDarkMode ? '#065F46' : '#D1FAE5' }]}>
                  <MaterialCommunityIcons name="arrow-bottom-left" size={13} color="#059669" />
                </View>
                <View>
                  <Text style={[styles.breakdownChipLabel, { color: isDarkMode ? '#6EE7B7' : '#059669' }]}>
                    Total Inflow
                  </Text>
                  <Text style={[styles.breakdownChipValue, { color: isDarkMode ? '#34D399' : '#059669' }]}>
                    {totals.totalIncome > 0 ? '+' : ''}
                    {formatLedgerAmount(totals.totalIncome)}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.breakdownChip,
                  {
                    backgroundColor: isDarkMode ? '#4C0519' : '#FFF1F2',
                    borderColor: isDarkMode ? '#881337' : '#FECDD3',
                  },
                ]}
              >
                <View style={[styles.breakdownChipIcon, { backgroundColor: isDarkMode ? '#881337' : '#FFE4E6' }]}>
                  <MaterialCommunityIcons name="arrow-top-right" size={13} color="#E11D48" />
                </View>
                <View>
                  <Text style={[styles.breakdownChipLabel, { color: isDarkMode ? '#FDA4AF' : '#E11D48' }]}>
                    Total Outflow
                  </Text>
                  <Text style={[styles.breakdownChipValue, { color: isDarkMode ? '#FB7185' : '#E11D48' }]}>
                    {totals.totalExpense > 0 ? '−' : ''}
                    {formatLedgerAmount(totals.totalExpense)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Hero Net Total Card */}
            <View
              style={[
                styles.netHeroCard,
                {
                  backgroundColor: isDarkMode ? '#131A27' : '#FFFFFF',
                  borderColor: isDarkMode ? '#1F2B3E' : '#E2E8F0',
                },
              ]}
            >
              <View style={styles.netHeroHeader}>
                <View style={styles.netHeroLabelRow}>
                  <MaterialCommunityIcons
                    name="scale-balance"
                    size={16}
                    color={Colors.primary}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.netHeroLabel, { color: textMuted }]}>
                    CALCULATED NET
                  </Text>
                </View>

                {/* Status Pill: Surplus / Deficit / Balanced */}
                <View style={[styles.netStatusPill, { backgroundColor: netStatus.bg }]}>
                  <MaterialCommunityIcons
                    name={netStatus.icon}
                    size={12}
                    color={netStatus.color}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.netStatusText, { color: netStatus.color }]}>
                    {netStatus.label}
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  styles.netHeroAmount,
                  {
                    color:
                      totals.netTotal > 0
                        ? isDarkMode ? '#34D399' : '#059669'
                        : totals.netTotal < 0
                          ? isDarkMode ? '#FB7185' : '#E11D48'
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
        </View>
      </ScrollView>

      {/* App Floating Action Button (FAB) to Add Calculation Line */}
      {!isSelectionMode && (
        <ContextualFAB
          icon="plus"
          onPress={() => {
            if (notepadInputRef.current) {
              notepadInputRef.current.focus();
            } else {
              setEditingItem(null);
              setIsAddModalVisible(true);
            }
          }}
        />
      )}

      {/* Modern Floating In-App Toast */}
      <PaperToast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={hideToast}
      />

      {/* Modal: Selective Import Checklist */}
      <PaperImportSelectModal
        visible={isImportSelectModalVisible}
        candidates={candidateImportItems}
        monthLabel={importMonthLabel}
        onClose={() => {
          setIsImportSelectModalVisible(false);
          setCandidateImportItems([]);
        }}
        onConfirmImport={handleConfirmImportSelected}
      />

      {/* Modal: Add/Edit Row */}
      <PaperAddRowModal
        visible={isAddModalVisible}
        onClose={handleCloseAddEditModal}
        onAdd={handleSaveRow}
        initialItem={editingItem}
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

      {/* Modal: Save / Update Sheet */}
      <PaperSaveSheetModal
        visible={isSaveModalVisible}
        currentTitle={activeSheetTitle || ''}
        isUpdating={!!activeSheetId}
        lastUpdated={activeSheetLastUpdated}
        onClose={() => setIsSaveModalVisible(false)}
        onSave={handleSaveSheetSubmit}
      />

      {/* Modal: Saved Sheets Browser with Pinning */}
      <PaperSavedSheetsModal
        visible={isSavedSheetsModalVisible}
        sheets={savedSheets}
        activeSheetId={activeSheetId}
        onClose={() => setIsSavedSheetsModalVisible(false)}
        onSelectSheet={handleSelectSheet}
        onTogglePin={handleTogglePinSheet}
        onDeleteSheet={handleDeleteSheet}
        onNewSheet={handleNewSheet}
      />

      {/* Modal: Action Confirmation (Cross-platform) */}
      <PaperConfirmModal
        visible={Boolean(confirmModalConfig)}
        title={confirmModalConfig?.title}
        message={confirmModalConfig?.message}
        confirmLabel={confirmModalConfig?.confirmLabel}
        confirmIcon={confirmModalConfig?.confirmIcon}
        confirmColor={confirmModalConfig?.confirmColor}
        isDestructive={confirmModalConfig?.isDestructive}
        onCancel={() => setConfirmModalConfig(null)}
        onConfirm={confirmModalConfig?.onConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  toolbarWrapper: {
    borderBottomWidth: 1,
  },
  toolbarScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
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
  selectionCountPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  selectionCountText: {
    fontSize: 13,
    fontWeight: '600',
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
    paddingBottom: 96,
  },
  fintechSheet: {
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  fintechHeader: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  fintechHeaderMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fintechTitleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
    gap: 8,
  },
  titleIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fintechSheetTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  editTitleBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fintechHeaderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fintechNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
    ...(Platform.OS === 'web' && { cursor: 'pointer' }),
  },
  fintechNewBtnText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '700',
  },
  fintechCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  fintechCountText: {
    fontSize: 11,
    fontWeight: '600',
  },
  fintechHeaderSubRow: {
    marginTop: 6,
  },
  fintechSubText: {
    fontSize: 11,
    fontWeight: '500',
  },
  tableRowHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  headerCol: {
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  headerColRight: {
    paddingVertical: 9,
    paddingRight: 14,
    paddingLeft: 6,
    alignItems: 'flex-end',
  },
  headerLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  headerLabelRight: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    textAlign: 'right',
  },
  col65: {
    width: '65%',
    borderRightWidth: 1,
  },
  col35: {
    width: '35%',
  },
  emptyNotice: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
    marginBottom: 16,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  emptyAddBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  heroSummaryContainer: {
    borderTopWidth: 1,
    padding: 14,
    gap: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    gap: 10,
  },
  breakdownChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  breakdownChipIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breakdownChipLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  breakdownChipValue: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 1,
  },
  netHeroCard: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  netHeroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  netHeroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  netHeroLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  netStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 12,
  },
  netStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  netHeroAmount: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  notepadBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    minHeight: 52,
    gap: 8,
  },
  notepadTypeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  notepadTypeToggleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  notepadTextInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    paddingHorizontal: 6,
  },
  notepadAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 2,
  },
  notepadAddBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

