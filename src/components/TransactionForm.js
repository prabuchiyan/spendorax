import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  Text,
  Platform
} from 'react-native';
import { createTransaction, createTransfer, getTransactionNoteSuggestions, updateTransaction, deleteTransaction } from '../services/transactions';
import { getLoans, linkTransactionToLoan, unlinkTransactionFromLoan } from '../services/loans';
import { getCategories } from '../services/categories';
import { getSources } from '../services/sources';
import { TextInput as PaperTextInput, Button as PaperButton, Chip, Snackbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CategoryCreateModal from './CategoryCreateModal';
import SourceCreateModal from './SourceCreateModal';
import ConfirmDialog from './ConfirmDialog';
import { Feather } from '@expo/vector-icons';

export default function TransactionForm({ onCreated, onCancel, transaction, isEdit }) {
  const [amount, setAmount] = useState(isEdit && transaction ? String(transaction.amount) : '');
  const [amountError, setAmountError] = useState(false);
  const [type, setType] = useState(isEdit && transaction ? transaction.type : 'expense');
  const [categories, setCategories] = useState([]);
  const [sources, setSources] = useState([]);
  const [categoryId, setCategoryId] = useState(isEdit && transaction ? transaction.category_id : null);
  const [sourceId, setSourceId] = useState(isEdit && transaction ? transaction.source_id : null);
  const [date, setDate] = useState(isEdit && transaction ? transaction.date : new Date().toISOString());
  const [notes, setNotes] = useState(isEdit && transaction ? transaction.notes : '');
  const [transferGroupId, setTransferGroupId] = useState(isEdit && transaction ? transaction.transfer_group_id : '');
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [showCategoryCreateModal, setShowCategoryCreateModal] = useState(false);
  const [pickerMode, setPickerMode] = useState('date');
  const [notesError, setNotesError] = useState(false);
  const [toAccount, setToAccount] = useState(null);
  const [selectingFor, setSelectingFor] = useState('from');
  const [openTimePicker, setOpenTimePicker] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [noteSuggestions, setNoteSuggestions] = useState([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCategoryGrid, setShowCategoryGrid] = useState(
    !(isEdit && transaction?.category_id)
  );
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const categorySearchRef = useRef(null);
  const [showSourceGrid, setShowSourceGrid] = useState(
    !(isEdit && transaction?.source_id)
  );
  const [showToAccountGrid, setShowToAccountGrid] = useState(true);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');
  const sourceSearchRef = useRef(null);
  const [showSourceCreateModal, setShowSourceCreateModal] = useState(false);
  const [loansList, setLoansList] = useState([]);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [linkedLoanId, setLinkedLoanId] = useState(isEdit && transaction ? transaction.loan_id : null);
  const [linking, setLinking] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);


  useEffect(() => {
    (async () => {
      const cats = await getCategories(true);
      setCategories(cats);
      const src = await getSources(true);
      setSources(src);
      const notes = await getTransactionNoteSuggestions();
      setNoteSuggestions(notes);
      // load loans for possible linking (keep small list)
      try {
        const lns = await getLoans();
        setLoansList(lns);
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    if (categories.length === 0) return;
    if (type === 'transfer') {
      setCategoryId(null);
      return;
    }
    // Preserve category while editing.
    // User can choose another category manually.
    if (isEdit) return;
    const exists = categories.some(
      c => c.id === categoryId && c.type === type
    );
    if (!exists) {
      setCategoryId(null);
    }
  }, [type, categories, isEdit]);

  useEffect(() => {
    if (showCategoryModal) {
      setTimeout(() => {
        categorySearchRef.current?.focus();
      }, 250);
    }
  }, [showCategoryModal]);

  useEffect(() => {
    if (showSourceModal) {
      setTimeout(() => {
        sourceSearchRef.current?.focus();
      }, 250);
    }
  }, [showSourceModal]);

  useEffect(() => {
    if (isEdit && transaction?.category_id) {
      setCategoryId(transaction.category_id);
      setShowCategoryGrid(false);
    }
    if (isEdit && transaction?.source_id) {
      setSourceId(transaction.source_id);
      setShowSourceGrid(false);
    }
  }, [isEdit, transaction]);

  async function submit() {
    if (submitting) return; // guard against double taps while a save is in flight

    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val === 0) {
      setAmountError(true);
      return;
    }
    // Category is mandatory only while creating a new transaction
    if (!isEdit && !categoryId && type !== 'transfer') {
      setSnackbarMsg('Please select a category.');
      setSnackbarVisible(true);
      return;
    }
    if (!sourceId) {
      setSnackbarMsg('Please select a source.');
      setSnackbarVisible(true);
      return;
    }
    if (!notes.trim()) {
      setNotesError(true);
      return;
    }

    setSubmitting(true);

    let id;
    try {
      if (type === 'transfer') {
        if (!sourceId || !toAccount) {
          setSnackbarMsg('Select both accounts');
          setSnackbarVisible(true);
          return;
        }

        if (sourceId === toAccount) {
          setSnackbarMsg('Cannot transfer to same account');
          setSnackbarVisible(true);
          return;
        }

        try {
          await createTransfer({
            fromAccount: sourceId,
            toAccount,
            amount: val,
            note: notes,
            date,
          });
        } catch (e) {
          console.log(e);
          setSnackbarMsg(e?.message || 'Operation failed');
          setSnackbarVisible(true);
          return;
        }
        id = 'transfer';
      } else {
        const transactionData = {
          type,
          amount: val,
          category_id: categoryId || null,
          source_id: sourceId,
          date,
          notes
        };
        try {
          if (isEdit && transaction && transaction.id) {
            id = await updateTransaction(transaction.id, transactionData);
          } else {
            id = await createTransaction(transactionData);
          }
        } catch (e) {
          console.log(e);
          setSnackbarMsg(e?.message || 'Operation failed');
          setSnackbarVisible(true);
          return;
        }
      }

      if (onCreated) onCreated(id);
      if (!isEdit) { // Only reset form if it was a new transaction
        setAmount('');
        setNotes('');
        setDate(new Date().toISOString());
        setTransferGroupId('')
      }
      setAmountError(false);
      setNotesError(false);

      // Close the form now that the save has completed successfully.
      if (onCancel) onCancel();
    } finally {
      setSubmitting(false);
    }
  }

  const handleDelete = async () => {
    await deleteTransaction(transaction.id);
    setConfirmVisible(false);
    onCancel?.();
  };

  function formatDateTime(isoString) {
    if (!isoString) return '';

    const d = new Date(isoString);

    const day = d.getDate();
    const month = d.toLocaleString('en-IN', { month: 'short' }); // Jun
    const year = d.getFullYear();

    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');

    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;

    return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;
  }

  const handleNotesChange = (text) => {
    setNotes(text);
    setNotesError(false);

    if (!text.trim()) {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const searchText = text.toLowerCase();

    const matches = noteSuggestions.filter(item => {
      const category = categories.find(c => c.id === item.category_id);

      return (
        item.notes.toLowerCase().includes(searchText) &&
        (
          // Match selected transaction type
          category?.type === type ||
          // Include suggestions that don't have a category
          !item.category_id
        )
      );
    });

    setFilteredSuggestions(matches);
    setShowSuggestions(matches.length > 0);
  };

  const filteredCategories = categories.filter(c => {
    if (type === 'transfer') return false;
    return c.type === type;
  });

  const visibleCategories = filteredCategories.slice(0, 12);

  const searchedCategories = filteredCategories.filter(c =>
    c.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const searchedSources = sources.filter(s =>
    (s.is_active === undefined || s.is_active) &&
    s.name.toLowerCase().includes(sourceSearch.toLowerCase())
  );
  const visibleSources = searchedSources.slice(0, 4);

  const accent = type === 'expense' ? '#E46A6A' : type === 'income' ? '#36B37E' : '#000';

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="none"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >

      <View style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
        <View style={{
          backgroundColor:
            type === 'expense' ? '#FFF2F2' :
              type === 'income' ? '#F1FFF6' : '#F5F5F5',
          padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <View>
            <Text style={{ color: accent, fontSize: 14, fontWeight: '700', textTransform: 'uppercase' }}>{type || 'expense'}</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: accent }}>{amount ? (Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })) : '0.00'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ alignItems: 'center', marginRight: 12 }}>
              <MaterialCommunityIcons name={type === 'transfer' ? 'currency-inr' : (categories.find(x => x.id === categoryId) || {}).icon || 'currency-inr'} size={26} color={(categories.find(x => x.id === categoryId) || {}).color || '#4B7CF3'} />
              <Text style={{ fontSize: 12 }}>{type === 'transfer' ? 'Uncategorized' : (categories.find(x => x.id === categoryId) || {}).name || 'Uncategorized'}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <MaterialCommunityIcons name={(sources.find(x => x.id === sourceId) || {}).icon || 'cash'} size={26} color={(sources.find(x => x.id === sourceId) || {}).color || '#4B7CF3'} />
              <Text style={{ fontSize: 12 }}>{(sources.find(x => x.id === sourceId) || {}).name || 'Select Source'}</Text>
            </View>
          </View>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Chip
            mode="outlined"
            selected={type === 'expense'}
            showSelectedCheck={false}
            onPress={() => setType('expense')}
            disabled={submitting}
            style={{
              marginRight: 8,
              borderColor: type === 'expense' ? accent : undefined,
            }}
          >
            Expense
          </Chip>

          <Chip
            mode="outlined"
            selected={type === 'income'}
            showSelectedCheck={false}
            onPress={() => setType('income')}
            disabled={submitting}
            style={{
              marginRight: 8,
              borderColor: type === 'income' ? accent : undefined,
            }}
          >
            Income
          </Chip>

          {!isEdit && (
            <Chip
              mode="outlined"
              selected={type === 'transfer'}
              showSelectedCheck={false}
              onPress={() => setType('transfer')}
              disabled={submitting}
              style={{
                borderColor: type === 'transfer' ? '#000' : undefined,
              }}
              textStyle={{
                color: type === 'transfer' ? '#000' : undefined,
                fontWeight: type === 'transfer' ? '700' : 'normal',
              }}
            >
              Transfer
            </Chip>
          )}
        </View>

        {isEdit && (
          <TouchableOpacity
            onPress={() => setConfirmVisible(true)}
            disabled={submitting}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#E46A6A',
              justifyContent: 'center',
              alignItems: 'center',
              opacity: submitting ? 0.5 : 1,
            }}
          >
            <Feather
              name="trash-2"
              size={20}
              color="#E46A6A"
            />
          </TouchableOpacity>
        )}
        {isEdit && (
          <TouchableOpacity
            disabled={submitting}
            onPress={async () => {
              if (linkedLoanId) {
                // confirm via Alert, then unlink
                setLinking(true);
                try {
                  await unlinkTransactionFromLoan(transaction.id);
                  setLinkedLoanId(null);
                  setSnackbarMsg('Transaction unlinked from loan');
                  setSnackbarVisible(true);
                } catch (e) {
                  console.warn(e);
                  setSnackbarMsg(e.message || 'Failed to unlink');
                  setSnackbarVisible(true);
                }
                setLinking(false);
              } else {
                setShowLoanModal(true);
              }
            }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#4B7CF3',
              justifyContent: 'center',
              alignItems: 'center',
              marginLeft: 8,
              opacity: submitting ? 0.5 : 1,
            }}
          >
            <MaterialCommunityIcons
              name={linkedLoanId ? 'link-off' : 'link'}
              size={18}
              color="#4B7CF3"
            />
          </TouchableOpacity>
        )}
      </View>

      <PaperTextInput label="Amount" value={amount} onChangeText={(t) => { setAmount(t); if (amountError) setAmountError(false); }} keyboardType="numeric" mode="outlined" style={{ marginBottom: 12 }} error={amountError} contentStyle={{ fontSize: 24 }} editable={!submitting} />
      {amountError ? <Text style={{ color: '#E46A6A', marginBottom: 8 }}>Enter an amount greater than 0</Text> : null}

      <View
        style={{
          position: 'relative',
          marginBottom: 12,
          zIndex: 999,
        }}
      >
        <PaperTextInput
          label={
            type === 'expense'
              ? 'Where did you spend?'
              : type === 'income'
                ? 'How did you get this money?'
                : 'Where do you want to transfer?'
          }
          value={notes}
          onChangeText={handleNotesChange}
          mode="outlined"
          error={notesError}
          autoCorrect={false}
          autoCapitalize="sentences"
          editable={!submitting}
          right={
            notes.length > 0 ? (
              <PaperTextInput.Icon
                icon="close-circle-outline"
                onPress={() => {
                  setNotes('');
                  setFilteredSuggestions([]);
                  setShowSuggestions(false);
                  setNotesError(false);
                }}
                forceTextInputFocus={false}
              />
            ) : null
          }
        />

        {showSuggestions && (
          <View
            style={{
              position: 'absolute',
              top: 62,          // Immediately below the TextInput
              left: 0,
              right: 0,
              backgroundColor: '#fff',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#E6EAF2',
              maxHeight: 220,
              zIndex: 9999,
              elevation: 10,
            }}
          >
            <FlatList
              data={filteredSuggestions}
              keyExtractor={(item, index) => `${item.notes}-${index}`}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              persistentScrollbar
              style={{ maxHeight: 220 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setNotes(item.notes);
                    setCategoryId(item.category_id);
                    setShowSuggestions(false);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F2F2F2',
                  }}
                >
                  <View
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: item.color,
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                    }}
                  >
                    <MaterialCommunityIcons
                      name={item.icon}
                      size={18}
                      color="#fff"
                    />
                  </View>

                  <Text
                    style={{ flex: 1 }}
                    numberOfLines={1}
                  >
                    {item.notes}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>

      <View style={{ marginBottom: 12 }}>
        <TouchableOpacity
          activeOpacity={0.8}
          disabled={submitting}
          onPress={() => {
            setPickerMode('date');
            setShowDateTimePicker(true);
          }}
        >
          <PaperTextInput
            label="Date & Time"
            value={formatDateTime(date)}
            editable={false}
            pointerEvents="none"
            mode="outlined"
            style={{ marginBottom: 8 }}
            right={
              <PaperTextInput.Icon
                icon="calendar"
                onPress={() => {
                  setPickerMode('date');
                  setShowDateTimePicker(true);
                }}
              />
            }
          />
        </TouchableOpacity>
      </View>

      {type !== 'transfer' && (
        <View style={{ marginBottom: 12 }}>
          {!transferGroupId && (
            <>
              <Text style={{ marginBottom: 6, color: '#666' }}>Category</Text>

              {showCategoryGrid ? (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      rowGap: 8,
                      marginTop: 8,
                    }}
                  >
                    {visibleCategories.map(c => (
                      <TouchableOpacity
                        key={c.id}
                        disabled={submitting}
                        onPress={() => {
                          setCategoryId(c.id);
                          setShowCategoryModal(false);
                          setShowCategoryGrid(false);
                          setCategorySearch('');
                        }}
                        style={{
                          width: '23%',
                          height: 72,
                          borderRadius: 10,
                          marginBottom: 8,
                          backgroundColor: c.color || '#4B7CF3',
                          justifyContent: 'center',
                          alignItems: 'center',
                          paddingHorizontal: 4,
                          paddingVertical: 6,
                          borderColor: '#111',
                        }}
                      >
                        <MaterialCommunityIcons
                          name={c.icon || 'tag'}
                          size={18}
                          color="#fff"
                        />

                        {categoryId === c.id && (
                          <View
                            style={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              width: 18,
                              height: 18,
                              borderRadius: 9,
                              backgroundColor: '#fff',
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                          >
                            <MaterialCommunityIcons
                              name="check"
                              size={12}
                              color="#2E7D32"
                            />
                          </View>
                        )}
                        <Text
                          numberOfLines={2}
                          style={{
                            color: '#fff',
                            textAlign: 'center',
                            marginTop: 6,
                            fontWeight: '600',
                            fontSize: 12,
                            lineHeight: 16,
                          }}
                        >
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : (
                <TouchableOpacity
                  onPress={() => setShowCategoryModal(true)}
                  activeOpacity={0.85}
                  disabled={submitting}
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: '#E6EAF2',
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    elevation: 2,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      flex: 1,
                    }}
                  >
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        backgroundColor:
                          categories.find(x => x.id === categoryId)?.color || '#4B7CF3',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 12,
                      }}
                    >
                      <MaterialCommunityIcons
                        name={categories.find(x => x.id === categoryId)?.icon || 'tag'}
                        size={22}
                        color="#fff"
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 12,
                          color: '#888',
                        }}
                      >
                        Selected Category
                      </Text>

                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 16,
                          fontWeight: '700',
                          color: '#222',
                        }}
                      >
                        {categories.find(x => x.id === categoryId)?.name}
                      </Text>
                    </View>

                    <MaterialCommunityIcons
                      name="pencil-outline"
                      size={22}
                      color="#4B7CF3"
                    />
                  </View>
                </TouchableOpacity>
              )}

              {showCategoryGrid && filteredCategories.length > 12 && (
                <TouchableOpacity
                  disabled={submitting}
                  onPress={() => {
                    setCategorySearch('');
                    setShowCategoryModal(true);
                  }}
                  style={{
                    alignItems: 'center',
                    paddingVertical: 8,
                  }}
                >
                  <Text
                    style={{
                      color: '#4B7CF3',
                      fontWeight: '700',
                    }}
                  >
                    See More
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}

      <View style={{ marginBottom: 12 }}>
        <Text
          style={{
            marginBottom: 8,
            color: '#666'
          }}
        >
          Payment Source
        </Text>

        {showSourceGrid ? (
          <>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'flex-start',
                marginTop: 8,
              }}
            >
              {visibleSources.map((s, index) => (
                <TouchableOpacity
                  key={s.id}
                  disabled={submitting}
                  onPress={() => {
                    setSourceId(s.id);
                    setShowSourceGrid(false);
                    setSourceSearch('');
                  }}
                  style={{
                    width: '23%',
                    height: 72,
                    marginBottom: 8,
                    marginRight: (index + 1) % 4 === 0 ? 0 : '2.66%',
                    borderRadius: 10,
                    backgroundColor: s.color || '#4B7CF3',
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingHorizontal: 4,
                    paddingVertical: 6,
                    borderColor: '#111',
                    transform: [
                      {
                        scale: sourceId === s.id ? 1.05 : 1,
                      },
                    ],
                  }}
                >
                  <MaterialCommunityIcons
                    name={s.icon || 'cash'}
                    size={18}
                    color="#fff"
                  />

                  {sourceId === s.id && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        backgroundColor: '#fff',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <MaterialCommunityIcons
                        name="check"
                        size={12}
                        color="#2E7D32"
                      />
                    </View>
                  )}

                  <Text
                    numberOfLines={2}
                    style={{
                      color: '#fff',
                      textAlign: 'center',
                      marginTop: 6,
                      fontWeight: '600',
                      fontSize: 12,
                      lineHeight: 16,
                    }}
                  >
                    {s.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {searchedSources.length > 4 && (
              <TouchableOpacity
                disabled={submitting}
                onPress={() => {
                  setSourceSearch('');
                  setShowSourceModal(true);
                }}
                style={{
                  alignItems: 'center',
                  paddingVertical: 8,
                }}
              >
                <Text
                  style={{
                    color: '#4B7CF3',
                    fontWeight: '700',
                  }}
                >
                  See More
                </Text>
              </TouchableOpacity>
            )}
          </>
        ) : (

          <TouchableOpacity
            disabled={submitting}
            onPress={() => {
              setSourceSearch('');
              setShowSourceModal(true);
            }}
            activeOpacity={0.85}
            style={{
              backgroundColor: '#fff',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: '#E6EAF2',
              paddingHorizontal: 14,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              elevation: 2,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                flex: 1,
              }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor:
                    sources.find(x => x.id === sourceId)?.color || '#4B7CF3',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginRight: 12,
                }}
              >
                <MaterialCommunityIcons
                  name={sources.find(x => x.id === sourceId)?.icon || 'cash'}
                  size={22}
                  color="#fff"
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 12,
                    color: '#888',
                  }}
                >
                  Selected Source
                </Text>

                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 16,
                    fontWeight: '700',
                    color: '#222',
                  }}
                >
                  {sources.find(x => x.id === sourceId)?.name}
                </Text>
              </View>

              <MaterialCommunityIcons
                name="pencil-outline"
                size={22}
                color="#4B7CF3"
              />
            </View>
          </TouchableOpacity>

        )}
      </View>

      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View
          style={{
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <View
            style={{
              width: 42,
              height: 5,
              borderRadius: 3,
              backgroundColor: '#D8D8D8',
            }}
          />
        </View>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 16,
              height: '85%',
              paddingBottom: 20,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
              }}
            >
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '700',
                }}
              >
                Select Category
              </Text>

              <TouchableOpacity
                onPress={() => setShowCategoryModal(false)}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>
            </View>

            <PaperTextInput
              ref={categorySearchRef}
              label="Search category"
              value={categorySearch}
              onChangeText={setCategorySearch}
              mode="outlined"
              left={<PaperTextInput.Icon icon="magnify" />}
              style={{ marginBottom: 16 }}
            />

            <Text
              style={{
                marginBottom: 10,
                color: '#666',
                fontSize: 13,
              }}
            >
              {searchedCategories.length} Categories
            </Text>

            <View style={{ flex: 1 }}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 90 }}
              >

                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    justifyContent: 'flex-start',
                  }}
                >
                  {searchedCategories.map((c, index) => (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => {
                        setCategoryId(c.id);
                        setCategorySearch('');
                        setShowCategoryModal(false);
                        setShowCategoryGrid(false);
                      }}
                      activeOpacity={0.8}
                      style={{
                        width: '23%',
                        height: 72,
                        marginBottom: 10,
                        marginRight: (index + 1) % 4 === 0 ? 0 : '2.66%',
                        borderRadius: 10,
                        backgroundColor: c.color || '#4B7CF3',
                        justifyContent: 'center',
                        alignItems: 'center',
                        paddingHorizontal: 4,
                        paddingVertical: 6,
                        borderColor: '#111',
                      }}
                    >
                      <MaterialCommunityIcons
                        name={c.icon || 'tag'}
                        size={18}
                        color="#fff"
                      />

                      {categoryId === c.id && (
                        <View
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            width: 18,
                            height: 18,
                            borderRadius: 9,
                            backgroundColor: '#fff',
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          <MaterialCommunityIcons
                            name="check"
                            size={12}
                            color="#2E7D32"
                          />
                        </View>
                      )}

                      <Text
                        numberOfLines={2}
                        style={{
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: '600',
                          textAlign: 'center',
                          marginTop: 4,
                          lineHeight: 12,
                        }}
                      >
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {searchedCategories.length === 0 && (
                  <Text
                    style={{
                      textAlign: 'center',
                      color: '#999',
                      marginVertical: 30,
                    }}
                  >
                    No categories found
                  </Text>
                )}
              </ScrollView>

            </View>

          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              setCategorySearch('');
              setShowCategoryModal(false);
              setShowCategoryCreateModal(true);
            }}
            style={{
              position: 'absolute',
              right: 20,
              bottom: 20,
              width: 58,
              height: 58,
              borderRadius: 29,
              backgroundColor: accent,
              justifyContent: 'center',
              alignItems: 'center',
              elevation: 8,
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 6,
              shadowOffset: {
                width: 0,
                height: 3,
              },
            }}
          >
            <MaterialCommunityIcons
              name="plus"
              size={30}
              color="#fff"
            />
          </TouchableOpacity>

        </View>
      </Modal>

      <Modal
        visible={showSourceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSourceModal(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(69, 48, 48, 0.45)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 16,
              height: '85%',
            }}
          >

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '700'
                }}
              >
                Select Payment Source
              </Text>

              <TouchableOpacity
                onPress={() => setShowSourceModal(false)}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>
            </View>

            <PaperTextInput
              ref={sourceSearchRef}
              label="Search Source"
              value={sourceSearch}
              onChangeText={setSourceSearch}
              mode="outlined"
              left={<PaperTextInput.Icon icon="magnify" />}
              style={{ marginBottom: 12 }}
            />

            <Text
              style={{
                color: "#666",
                marginBottom: 12
              }}
            >
              {searchedSources.length} Sources
            </Text>

            <View style={{ flex: 1 }}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  paddingBottom: 100
                }}
              >

                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    justifyContent: 'flex-start',
                  }}
                >
                  {searchedSources.map((s, index) => (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => {
                        if (selectingFor === 'from') {
                          setSourceId(s.id);
                          setShowSourceGrid(false);
                        } else {
                          setToAccount(s.id);
                          setShowToAccountGrid(false);
                        }
                        setSourceSearch('');
                        setShowSourceModal(false);
                      }}
                      activeOpacity={0.8}
                      style={{
                        width: '23%',
                        height: 72,
                        marginBottom: 10,
                        marginRight: (index + 1) % 4 === 0 ? 0 : '2.66%',
                        borderRadius: 10,
                        backgroundColor: s.color || accent,
                        justifyContent: 'center',
                        alignItems: 'center',
                        paddingHorizontal: 4,
                        paddingVertical: 6,
                        borderColor: '#111',
                      }}
                    >
                      <MaterialCommunityIcons
                        name={s.icon || 'cash'}
                        size={18}
                        color="#fff"
                      />

                      {sourceId === s.id && (
                        <View
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            width: 18,
                            height: 18,
                            borderRadius: 9,
                            backgroundColor: '#fff',
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          <MaterialCommunityIcons
                            name="check"
                            size={12}
                            color="#2E7D32"
                          />
                        </View>
                      )}

                      <Text
                        numberOfLines={2}
                        style={{
                          color: '#fff',
                          textAlign: 'center',
                          marginTop: 6,
                          fontWeight: '600',
                          fontSize: 12,
                          lineHeight: 16,
                        }}
                      >
                        {s.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

              </ScrollView>
              {searchedSources.length === 0 && (
                <Text
                  style={{
                    textAlign: "center",
                    color: "#999",
                    marginTop: 30
                  }}
                >
                  No payment sources found
                </Text>
              )}
            </View>

          </View>
        </View>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            setSourceSearch('');
            setShowSourceModal(false);
            setShowSourceCreateModal(true);
          }}
          style={{
            position: 'absolute',
            right: 20,
            bottom: 20,
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: accent,
            justifyContent: 'center',
            alignItems: 'center',
            elevation: 8,
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 6,
            shadowOffset: {
              width: 0,
              height: 3,
            },
          }}
        >
          <MaterialCommunityIcons
            name="plus"
            size={30}
            color="#fff"
          />
        </TouchableOpacity>
      </Modal>

      {type === 'transfer' && (
        <View style={{ marginBottom: 12 }}>
          <Text
            style={{
              marginBottom: 8,
              color: '#666',
            }}
          >
            To Account
          </Text>

          {showToAccountGrid ? (
            <>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'flex-start',
                  marginTop: 8,
                }}
              >
                {visibleSources
                  .filter(s => s.id !== sourceId)
                  .map((s, index) => (
                    <TouchableOpacity
                      key={s.id}
                      disabled={submitting}
                      onPress={() => {
                        setToAccount(s.id);
                        setShowToAccountGrid(false);
                        setSourceSearch('');
                      }}
                      style={{
                        width: '23%',
                        height: 72,
                        marginBottom: 8,
                        marginRight: (index + 1) % 4 === 0 ? 0 : '2.66%',
                        borderRadius: 10,
                        backgroundColor: s.color || '#4B7CF3',
                        justifyContent: 'center',
                        alignItems: 'center',
                        paddingHorizontal: 4,
                        paddingVertical: 6,
                        transform: [
                          {
                            scale: toAccount === s.id ? 1.05 : 1,
                          },
                        ],
                      }}
                    >
                      <MaterialCommunityIcons
                        name={s.icon || 'cash'}
                        size={18}
                        color="#fff"
                      />

                      {toAccount === s.id && (
                        <View
                          style={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            width: 18,
                            height: 18,
                            borderRadius: 9,
                            backgroundColor: '#fff',
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          <MaterialCommunityIcons
                            name="check"
                            size={12}
                            color="#2E7D32"
                          />
                        </View>
                      )}

                      <Text
                        numberOfLines={2}
                        style={{
                          color: '#fff',
                          textAlign: 'center',
                          marginTop: 6,
                          fontWeight: '600',
                          fontSize: 12,
                          lineHeight: 16,
                        }}
                      >
                        {s.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>

              {searchedSources.filter(s => s.id !== sourceId).length > 4 && (
                <TouchableOpacity
                  disabled={submitting}
                  onPress={() => {
                    setSelectingFor('to');
                    setSourceSearch('');
                    setShowSourceModal(true);
                  }}
                  style={{
                    alignItems: 'center',
                    paddingVertical: 8,
                  }}
                >
                  <Text
                    style={{
                      color: '#4B7CF3',
                      fontWeight: '700',
                    }}
                  >
                    See More
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <TouchableOpacity
              disabled={submitting}
              onPress={() => {
                setSelectingFor('to');
                setSourceSearch('');
                setShowSourceModal(true);
              }}
              activeOpacity={0.85}
              style={{
                backgroundColor: '#fff',
                borderRadius: 14,
                borderWidth: 1,
                borderColor: '#E6EAF2',
                paddingHorizontal: 14,
                paddingVertical: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                elevation: 2,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  flex: 1,
                }}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor:
                      sources.find(x => x.id === toAccount)?.color || '#4B7CF3',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12,
                  }}
                >
                  <MaterialCommunityIcons
                    name={sources.find(x => x.id === toAccount)?.icon || 'cash'}
                    size={22}
                    color="#fff"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: '#888',
                    }}
                  >
                    Destination Account
                  </Text>

                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: '#222',
                    }}
                  >
                    {sources.find(x => x.id === toAccount)?.name}
                  </Text>
                </View>

                <MaterialCommunityIcons
                  name="pencil-outline"
                  size={22}
                  color="#4B7CF3"
                />
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
        <PaperButton
          mode="contained"
          onPress={submit}
          loading={submitting}
          disabled={submitting}
          style={{ backgroundColor: accent }}
          labelStyle={{ color: '#fff' }}
        >
          {submitting ? (isEdit ? 'Updating...' : 'Saving...') : (isEdit ? 'Update' : 'Save')}
        </PaperButton>
        <View style={{ width: 12 }} />
        <PaperButton
          mode="outlined"
          disabled={submitting}
          onPress={() => { if (onCancel) onCancel(); else { setAmount(''); setNotes(''); } }}
        >
          Cancel
        </PaperButton>
        <View style={{ width: 12 }} />
      </View>

      {/* Native DateTimePicker usage with fallback modal for platforms without library */}
      {showDateTimePicker && (
        (() => {
          // Prefer native datetimepicker only on native platforms; on web use the ManualDateTimePicker fallback
          if (Platform.OS !== 'web') {
            try {
              // Try to use community datetimepicker if available
              // eslint-disable-next-line global-require
              const DateTimePicker = require('@react-native-community/datetimepicker').default;
              return (
                <DateTimePicker
                  value={new Date(date)}
                  mode={pickerMode}
                  is24Hour={true}
                  display={
                    Platform.OS === 'android'
                      ? (pickerMode === 'date' ? 'calendar' : 'clock')
                      : 'spinner'
                  }
                  onChange={(event, selected) => {
                    if (Platform.OS === 'android') {
                      if (event.type === 'dismissed') {
                        setShowDateTimePicker(false);
                        setPickerMode('date');
                        setOpenTimePicker(false);
                        return;
                      }

                      if (!selected) return;

                      if (pickerMode === 'date') {
                        // Preserve existing time
                        const current = new Date(date);
                        const newDate = new Date(selected);

                        newDate.setHours(
                          current.getHours(),
                          current.getMinutes(),
                          current.getSeconds(),
                          0
                        );

                        setDate(newDate.toISOString());

                        // Close date picker first
                        setShowDateTimePicker(false);

                        // Open time picker after animation finishes
                        requestAnimationFrame(() => {
                          setTimeout(() => {
                            setPickerMode('time');
                            setShowDateTimePicker(true);
                          }, 500);
                        });

                        return;
                      }

                      // TIME PICKER
                      const current = new Date(date);

                      current.setHours(
                        selected.getHours(),
                        selected.getMinutes(),
                        0,
                        0
                      );

                      setDate(current.toISOString());

                      setShowDateTimePicker(false);
                      setPickerMode('date');
                      setOpenTimePicker(false);
                    } else {
                      if (selected) {
                        setDate(selected.toISOString());
                      }

                      setShowDateTimePicker(false);
                      setPickerMode('date');
                    }
                  }}
                />
              );
            } catch (e) {
              // fall through to manual picker
            }
          }

          // Fallback manual picker for web or if native picker not available
          return (
            <Modal visible={showDateTimePicker} transparent animationType="slide" onRequestClose={() => setShowDateTimePicker(false)}>
              <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 }}>
                <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8 }}>
                  <Text style={{ fontWeight: '600', marginBottom: 8 }}>Pick Date / Time</Text>
                  {(() => {
                    const dt = new Date(date || new Date().toISOString());
                    const [y, m, d, h, min] = [dt.getFullYear(), dt.getMonth() + 1, dt.getDate(), dt.getHours(), dt.getMinutes()];
                    const Manual = require('../components/ManualDateTimePicker').default;
                    return (
                      <Manual
                        year={y} month={m} day={d} hour={h} minute={min}
                        onChange={(ny, nm, nd, nh, nmin) => {
                          const ndt = new Date(ny, nm - 1, nd, nh, nmin);
                          setDate(ndt.toISOString());
                        }}
                        onClose={() => setShowDateTimePicker(false)}
                      />
                    );
                  })()}
                </View>
              </View>
            </Modal>
          );
        })()
      )}

      <ConfirmDialog
        visible={confirmVisible}
        title="Delete Transaction"
        message={`Delete this ${type} transaction?`}
        onCancel={() => setConfirmVisible(false)}
        onConfirm={handleDelete}
      />

      <Modal visible={showLoanModal} transparent animationType="slide" onRequestClose={() => setShowLoanModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 8, maxHeight: '80%' }}>
            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Link to Loan</Text>
            <ScrollView>
              {loansList.map(l => (
                <TouchableOpacity key={l.id} onPress={async () => {
                  setLinking(true);
                  try {
                    await linkTransactionToLoan(transaction.id, l.id, { paymentType: 'LINKED', linkedDate: transaction.date });
                    setLinkedLoanId(l.id);
                    setShowLoanModal(false);
                    setSnackbarMsg('Transaction linked to loan');
                    setSnackbarVisible(true);
                  } catch (e) {
                    console.warn(e);
                    setSnackbarMsg(e.message || 'Failed to link transaction');
                    setSnackbarVisible(true);
                  }
                  setLinking(false);
                }} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F2F2F2' }}>
                  <Text style={{ fontSize: 16, fontWeight: '600' }}>{l.loan_name} <Text style={{ fontWeight: '400', color: '#666' }}>({l.status})</Text></Text>
                  <Text style={{ color: '#666', marginTop: 4 }}>Outstanding: {Number(l.outstanding_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'flex-end' }}>
              <PaperButton onPress={() => setShowLoanModal(false)}>Close</PaperButton>
            </View>
          </View>
        </View>
      </Modal>

      <CategoryCreateModal
        visible={showCategoryCreateModal}
        onClose={() => setShowCategoryCreateModal(false)}
        onCategoryCreated={async (newCategory) => {
          const cats = await getCategories(true);

          setCategories(cats);
          setCategoryId(newCategory.id);

          requestAnimationFrame(() => {
            setShowCategoryCreateModal(false);
            setShowCategoryModal(false);
            setShowCategoryGrid(false);
            setCategorySearch('');
          });
        }}
        currentType={type}
      />

      <SourceCreateModal
        visible={showSourceCreateModal}
        onClose={() => setShowSourceCreateModal(false)}
        onSourceCreated={async () => {
          const updatedSources = await getSources(true);

          setSources(updatedSources);

          const newestSource = [...updatedSources].sort((a, b) => b.id - a.id)[0];

          requestAnimationFrame(() => {
            if (newestSource) {
              setSourceId(newestSource.id);
            }

            setShowSourceGrid(false);
            setSourceSearch('');

            setShowSourceCreateModal(false);
            setShowSourceModal(false);
          });
        }}
      />

      <Snackbar visible={snackbarVisible} onDismiss={() => setSnackbarVisible(false)} duration={3000} action={{ label: 'OK', onPress: () => setSnackbarVisible(false) }}>
        {snackbarMsg}
      </Snackbar>

    </ScrollView>
  );
}
