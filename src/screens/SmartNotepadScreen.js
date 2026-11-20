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
  formatItemToFreeformLine,
  parseNotepadDocument,
  getNextCopyTitle,
} from '../utils/smartNotepadUtils';
import SmartNotepadMonthPickerModal from '../components/SmartNotepadMonthPickerModal';
import CommonBottomSheetModal from '../components/CommonBottomSheetModal';
import SmartNotepadSaveSheetModal from '../components/SmartNotepadSaveSheetModal';
import SmartNotepadSavedSheetsModal from '../components/SmartNotepadSavedSheetsModal';
import SmartNotepadImportSelectModal from '../components/SmartNotepadImportSelectModal';
import SmartNotepadToast from '../components/SmartNotepadToast';
import SmartNotepadGuideModal from '../components/SmartNotepadGuideModal';
import QlateNotepadSheet from '../components/QlateNotepadSheet';
import {
  savePaperLedger,
  getPaperLedgers,
  togglePinPaperLedger,
  deletePaperLedger,
} from '../services/smartNotepadService';

export default function SmartNotepadScreen({ navigation }) {
  const { isDarkMode, theme } = useTheme();

  // Qlate Continuous Notepad Document state
  const notepadRef = useRef(null);
  const [notepadText, setNotepadText] = useState('');

  // Live evaluation on every keystroke
  const evaluatedDoc = useMemo(() => parseNotepadDocument(notepadText), [notepadText]);
  const totals = {
    totalIncome: evaluatedDoc.totalIncome,
    totalExpense: evaluatedDoc.totalExpense,
    netTotal: evaluatedDoc.netTotal,
  };
  const items = evaluatedDoc.items;

  const [categoriesMap, setCategoriesMap] = useState({});
  const [availableMonths, setAvailableMonths] = useState([]);
  const [loadingMonths, setLoadingMonths] = useState(false);
  const [importing, setImporting] = useState(false);

  // Modals & Confirmation state (No modal for Add/Edit - 100% continuous document editing)
  const [isMonthModalVisible, setIsMonthModalVisible] = useState(false);

  // Saved Sheet Persistence State
  const [savedSheets, setSavedSheets] = useState([]);
  const [activeSheetId, setActiveSheetId] = useState(null);
  const [activeSheetTitle, setActiveSheetTitle] = useState(null);
  const [activeSheetLastUpdated, setActiveSheetLastUpdated] = useState(null);
  const [isSaveModalVisible, setIsSaveModalVisible] = useState(false);
  const [isSavedSheetsModalVisible, setIsSavedSheetsModalVisible] = useState(false);
  const [isGuideModalVisible, setIsGuideModalVisible] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState(null);

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

  // Handle clearing entire notepad
  const handleClearAll = useCallback(() => {
    if (!notepadText.trim()) return;
    setConfirmModalConfig({
      title: 'Clear Notepad?',
      subtitle: 'Are you sure you want to remove all notes and calculations from this sheet?',
      confirmLabel: 'Clear All',
      confirmIcon: 'trash-can-outline',
      type: 'danger',
      warnings: [
        { title: 'Unsaved Changes', text: 'All written calculations and notes will be cleared.' },
      ],
      onConfirm: () => {
        setNotepadText('');
        setConfirmModalConfig(null);
      },
    });
  }, [notepadText]);

  // Handle prompt for saving
  const handlePromptSave = useCallback(() => {
    if (!notepadText.trim()) {
      showToast('Please type some notes or calculations before saving', 'info');
      return;
    }
    setIsSaveModalVisible(true);
  }, [notepadText, showToast]);

  // Handle saving sheet to DB (new or update)
  const handleSaveSheetSubmit = useCallback(
    async (titleToSave, asNew = false) => {
      try {
        const shouldCreateNew = asNew || !activeSheetId;
        const targetId = shouldCreateNew ? null : activeSheetId;
        const finalTitle = asNew
          ? getNextCopyTitle(titleToSave || activeSheetTitle, savedSheets)
          : titleToSave;

        const savedId = await savePaperLedger({
          id: targetId,
          title: finalTitle,
          raw_text: notepadText,
          items: evaluatedDoc.items,
          totalIncome: totals.totalIncome,
          totalExpense: totals.totalExpense,
          netTotal: totals.netTotal,
        });

        setActiveSheetId(savedId);
        setActiveSheetTitle(finalTitle);
        setActiveSheetLastUpdated(new Date().toISOString());

        await loadSavedSheets();

        showToast(
          asNew
            ? `Saved copy as "${finalTitle}"`
            : (!activeSheetId ? `Sheet "${finalTitle}" saved to records` : `Sheet "${finalTitle}" updated`),
          'success'
        );
      } catch (err) {
        console.error('Error saving paper ledger:', err);
        showToast('Failed to save sheet to database', 'error');
      }
    },
    [activeSheetId, activeSheetTitle, savedSheets, notepadText, evaluatedDoc.items, totals, loadSavedSheets, showToast]
  );

  // Handle opening a saved sheet
  const handleSelectSheet = useCallback((sheet) => {
    if (sheet.raw_text !== undefined && sheet.raw_text !== null) {
      setNotepadText(sheet.raw_text);
    } else if (Array.isArray(sheet.items)) {
      setNotepadText(sheet.items.map(formatItemToFreeformLine).join('\n'));
    } else {
      setNotepadText('');
    }
    setActiveSheetId(sheet.id);
    setActiveSheetTitle(sheet.title);
    setActiveSheetLastUpdated(sheet.updated_at);
  }, []);

  // Handle starting a fresh sheet
  const handleNewSheet = useCallback(() => {
    setNotepadText('');
    setActiveSheetId(null);
    setActiveSheetTitle(null);
    setActiveSheetLastUpdated(null);
  }, []);

  const handlePromptNewSheet = useCallback(() => {
    if (notepadText.trim().length > 0) {
      setConfirmModalConfig({
        title: 'Start New Sheet?',
        subtitle: 'This will clear the current notepad and start a fresh sheet.',
        confirmLabel: 'Start New Sheet',
        confirmIcon: 'file-document-plus-outline',
        type: 'warning',
        warnings: [
          { title: 'Save Progress', text: 'Make sure your current sheet has been saved to records if needed.' },
        ],
        onConfirm: () => {
          handleNewSheet();
          setConfirmModalConfig(null);
        },
      });
    } else {
      handleNewSheet();
    }
  }, [notepadText, handleNewSheet]);

  // Configure top navigation header right with a '+' icon to start a new notepad
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={handlePromptNewSheet}
          style={{ marginRight: 16, padding: 4 }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="plus"
            size={26}
            color={isDarkMode ? '#60A5FA' : (Colors.primary || '#4B7CF3')}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, handlePromptNewSheet, isDarkMode]);

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
        title: 'Delete Saved Notepad?',
        subtitle: `Are you sure you want to permanently delete "${sheet.title}"?`,
        confirmLabel: 'Delete Permanently',
        confirmIcon: 'trash-can-outline',
        type: 'danger',
        warnings: [
          { title: 'Cannot Be Undone', text: 'This sheet will be permanently removed from your saved records.' },
        ],
        onConfirm: async () => {
          setConfirmModalConfig(null);
          try {
            await deletePaperLedger(sheet.id);
            if (activeSheetId === sheet.id) {
              handleNewSheet();
            }
            await loadSavedSheets();
          } catch (err) {
            console.error('Failed to delete saved notepad', err);
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

  // Handle confirming selected items from Selective Import modal into continuous notepad
  const handleConfirmImportSelected = useCallback(
    (selectedItems) => {
      if (!selectedItems || selectedItems.length === 0) return;
      const newLines = selectedItems.map((item) => {
        const sign = item.type === 'expense' ? '-' : '';
        return `${item.title} ${sign}${item.amount}`;
      });
      setNotepadText((prev) => {
        const trimmed = (prev || '').trim();
        if (!trimmed) {
          return newLines.join('\n');
        }
        return `${trimmed}\n${newLines.join('\n')}`;
      });
      setIsImportSelectModalVisible(false);
      setCandidateImportItems([]);
      showToast(`Imported ${selectedItems.length} transactions into notepad`, 'success');
    },
    [showToast]
  );

  // Handle inserting sample template from guide popup
  const handleInsertSampleTemplate = useCallback(
    (templateText) => {
      setNotepadText((prev) => {
        const trimmed = (prev || '').trim();
        if (!trimmed) {
          return templateText;
        }
        return `${trimmed}\n\n${templateText}`;
      });
      setIsGuideModalVisible(false);
      showToast('Sample notes added to notepad', 'success');
    },
    [showToast]
  );

  // Share formatted calculation to WhatsApp
  const handleShareToWhatsApp = useCallback(async () => {
    if (!notepadText.trim() || evaluatedDoc.validCount === 0) {
      showToast('Add or import calculations before sharing', 'info');
      return;
    }

    const shareText = formatWhatsAppLedgerText(evaluatedDoc.items, totals.netTotal);
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
          title: 'SpendoraX Smart Notepad',
        });
      }
    } catch (error) {
      console.warn('WhatsApp direct open failed, falling back to Share sheet', error);
      try {
        await Share.share({
          message: shareText,
          title: 'SpendoraX Smart Notepad',
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
        label: 'Saved',
        color: isDarkMode ? '#34D399' : '#059669',
        bg: isDarkMode ? '#064E3B' : '#ECFDF5',
        icon: 'trending-up',
      };
    }
    if (totals.netTotal < 0) {
      return {
        label: 'Overspent',
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
          <TouchableOpacity
            style={[
              styles.toolButtonOutline,
              {
                borderColor: isDarkMode ? '#3B4863' : '#CBD5E1',
                backgroundColor: isDarkMode ? '#171E2B' : '#FFFFFF',
              },
            ]}
            onPress={handlePromptNewSheet}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="file-document-plus-outline" size={16} color={theme.textPrimary} />
            <Text style={[styles.toolButtonOutlineText, { color: theme.textPrimary }]}>
              New Sheet
            </Text>
          </TouchableOpacity>

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

          <TouchableOpacity
            style={[
              styles.toolButtonOutline,
              {
                borderColor: '#F59E0B',
                backgroundColor: isDarkMode ? '#2D2006' : '#FEF3C7',
              },
            ]}
            onPress={() => setIsGuideModalVisible(true)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="lightbulb-on-outline" size={16} color="#D97706" />
            <Text style={[styles.toolButtonOutlineText, { color: isDarkMode ? '#FCD34D' : '#B45309' }]}>
              How to Use
            </Text>
          </TouchableOpacity>

          {notepadText.trim().length > 0 && (
            <TouchableOpacity
              style={[
                styles.toolButtonOutline,
                {
                  borderColor: isDarkMode ? '#4B252C' : '#FCA5A5',
                  backgroundColor: isDarkMode ? '#231518' : '#FEF2F2',
                },
              ]}
              onPress={handleClearAll}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={16} color="#EF4444" />
              <Text style={[styles.toolButtonOutlineText, { color: '#EF4444' }]}>
                Clear
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
        </ScrollView>
      </View>

      {/* Main Notebook Paper Area */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
                  {activeSheetTitle ? activeSheetTitle : 'Smart Notepad'}
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
                <View
                  style={[
                    styles.fintechCountBadge,
                    {
                      backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                    },
                  ]}
                >
                  <Text style={[styles.fintechCountText, { color: textMuted }]}>
                    {evaluatedDoc.validCount} {evaluatedDoc.validCount === 1 ? 'entry' : 'entries'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.fintechHeaderSubRow}>
              <Text style={[styles.fintechSubText, { color: textMuted }]} numberOfLines={1}>
                {activeSheetLastUpdated
                  ? `Saved Sheet • Updated ${new Date(activeSheetLastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} • Smart Notepad active`
                  : 'Type notes & math as paragraphs • Live results calculate automatically'}
              </Text>
            </View>
          </View>

          {/* Qlate Continuous Calculator + Notepad Sheet */}
          <QlateNotepadSheet
            text={notepadText}
            onChangeText={setNotepadText}
            evaluatedDoc={evaluatedDoc}
            textInputRef={notepadRef}
            isDarkMode={isDarkMode}
            textColor={textColor}
            textMuted={textMuted}
            rowDividerColor={rowDividerColor}
            colDividerColor={colDividerColor}
            tableHeaderBg={tableHeaderBg}
            cardBg={cardBg}
          />

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
                    Money In
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
                    Money Out
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
                    REMAINING BALANCE
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

      {/* Modern Floating In-App Toast */}
      <SmartNotepadToast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={hideToast}
      />

      {/* Modal: Selective Import Checklist */}
      <SmartNotepadImportSelectModal
        visible={isImportSelectModalVisible}
        candidates={candidateImportItems}
        monthLabel={importMonthLabel}
        onClose={() => {
          setIsImportSelectModalVisible(false);
          setCandidateImportItems([]);
        }}
        onConfirmImport={handleConfirmImportSelected}
      />

      {/* Modal: Month Picker */}
      <SmartNotepadMonthPickerModal
        visible={isMonthModalVisible}
        months={availableMonths}
        loading={loadingMonths}
        onClose={() => setIsMonthModalVisible(false)}
        onSelectMonth={handleImportMonth}
        onSelectAll={handleImportAll}
      />

      {/* Modal: Save / Update Sheet */}
      <SmartNotepadSaveSheetModal
        visible={isSaveModalVisible}
        currentTitle={activeSheetTitle || ''}
        isUpdating={!!activeSheetId}
        lastUpdated={activeSheetLastUpdated}
        onClose={() => setIsSaveModalVisible(false)}
        onSave={handleSaveSheetSubmit}
      />

      {/* Modal: Saved Sheets Browser with Pinning */}
      <SmartNotepadSavedSheetsModal
        visible={isSavedSheetsModalVisible}
        sheets={savedSheets}
        activeSheetId={activeSheetId}
        onClose={() => setIsSavedSheetsModalVisible(false)}
        onSelectSheet={handleSelectSheet}
        onTogglePin={handleTogglePinSheet}
        onDeleteSheet={handleDeleteSheet}
        onNewSheet={handleNewSheet}
      />

      {/* Modal: How to Use & Math Examples Guide */}
      <SmartNotepadGuideModal
        visible={isGuideModalVisible}
        onClose={() => setIsGuideModalVisible(false)}
        onInsertTemplate={handleInsertSampleTemplate}
      />

      {/* Modal: Action Confirmation using the app's standard CommonBottomSheetModal */}
      <CommonBottomSheetModal
        visible={Boolean(confirmModalConfig)}
        type={confirmModalConfig?.type || 'warning'}
        icon={confirmModalConfig?.confirmIcon}
        title={confirmModalConfig?.title || 'Are you sure?'}
        subtitle={confirmModalConfig?.subtitle || confirmModalConfig?.message}
        confirmLabel={confirmModalConfig?.confirmLabel || 'Confirm'}
        cancelLabel="Cancel"
        confirmIcon={confirmModalConfig?.confirmIcon}
        warnings={confirmModalConfig?.warnings || []}
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
    paddingHorizontal: 0,
    paddingTop: 4,
    paddingBottom: 96,
  },
  fintechSheet: {
    borderRadius: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  fintechHeader: {
    paddingVertical: 10,
    paddingHorizontal: 12,
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
});

