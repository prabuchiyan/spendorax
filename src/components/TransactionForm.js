import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, ScrollView, Modal, Text, Platform, InteractionManager } from 'react-native';
import { createTransaction, createTransfer, getTransactionNoteSuggestions } from '../services/transactions';
import { getCategories } from '../services/categories';
import { getSources } from '../services/sources';
import { TextInput as PaperTextInput, Button as PaperButton, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import CategoryCreateModal from './CategoryCreateModal';
import SourceCreateModal from './SourceCreateModal';
import { updateTransaction } from '../services/transactions';
import ConfirmDialog from './ConfirmDialog';
import { deleteTransaction } from '../services/transactions';
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
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);
  const [showCategoryCreateModal, setShowCategoryCreateModal] = useState(false);
  const [srcSearch, setSrcSearch] = useState('');
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
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');
  const sourceSearchRef = useRef(null);
  const [showSourceCreateModal, setShowSourceCreateModal] = useState(false);


  useEffect(() => {
    (async () => {
      const cats = await getCategories(true);
      setCategories(cats);
      const src = await getSources(true);
      setSources(src);
      const notes = await getTransactionNoteSuggestions();
      setNoteSuggestions(notes);
    })();
  }, []);

  useEffect(() => {
    if (!openTimePicker) return;
    setOpenTimePicker(false);
    InteractionManager.runAfterInteractions(() => {
      setPickerMode('time');
      setShowDateTimePicker(true);
    });
  }, [openTimePicker]);

  useEffect(() => {
    if (categories.length === 0) return;
    if (type === 'transfer') {
      setCategoryId(null);
      return;
    }
    const exists = categories.some(
      c => c.id === categoryId && c.type === type
    );
    if (!exists) {
      setCategoryId(null);
    }
  }, [type, categories]);

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
    const val = parseFloat(amount);
    if (!amount || isNaN(val) || val === 0) {
      setAmountError(true);
      return;
    }
    if (!categoryId && type !== 'transfer') {
      alert('Please select a category.');
      return;
    }
    if (!sourceId) {
      alert('Please select a source.');
      return;
    }
    if (!notes.trim()) {
      setNotesError(true);
      return;
    }

    let id;
    if (type === 'transfer') {
      if (!sourceId || !toAccount) {
        alert('Select both accounts');
        return;
      }

      if (sourceId === toAccount) {
        alert('Cannot transfer to same account');
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
        alert(e.message);
      }
      id = 'transfer';
    } else {
      const transactionData = { type, amount: val, category_id: categoryId, source_id: sourceId, date, notes };

      if (isEdit && transaction && transaction.id) {
        id = await updateTransaction(transaction.id, transactionData);
      } else {
        id = await createTransaction(transactionData);
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

    const matches = noteSuggestions.filter(item => {
      const category = categories.find(c => c.id === item.category_id);

      return (
        item.notes.toLowerCase().includes(text.toLowerCase()) &&
        category?.type === type
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
      contentContainerStyle={{
        paddingBottom: 120,
      }}
      keyboardShouldPersistTaps="handled"
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
              <MaterialCommunityIcons name={type === 'transfer' ? 'currency-usd' : (categories.find(x => x.id === categoryId) || {}).icon || 'currency-usd'} size={26} color={(categories.find(x => x.id === categoryId) || {}).color || '#4B7CF3'} />
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
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#E46A6A',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Feather
              name="trash-2"
              size={20}
              color="#E46A6A"
            />
          </TouchableOpacity>
        )}
      </View>

      <PaperTextInput label="Amount" value={amount} onChangeText={(t) => { setAmount(t); if (amountError) setAmountError(false); }} keyboardType="numeric" mode="outlined" style={{ marginBottom: 12 }} error={amountError} contentStyle={{ fontSize: 24 }} />
      {amountError ? <Text style={{ color: '#E46A6A', marginBottom: 8 }}>Enter an amount greater than 0</Text> : null}

      <PaperTextInput
        label={type === 'expense' ? 'Where did you spend?' : type === 'income'
          ? 'How did you get this money?' : 'How much do you want to transfer?'}
        value={notes}
        onChangeText={handleNotesChange}
        mode="outlined"
        error={notesError}
        autoCorrect={false}
        autoCapitalize="sentences"
        style={{ marginBottom: 12 }}
      />
      {notesError && <Text style={{ color: '#E46A6A', marginBottom: 8 }}>Notes cannot be empty.</Text>}
      {showSuggestions && (
        <View
          style={{
            borderWidth: 1,
            borderColor: "#ddd",
            borderRadius: 10,
            backgroundColor: "#fff",
            maxHeight: 220,
            marginBottom: 12,
            elevation: 4,
          }}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            {filteredSuggestions.map((item, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  setNotes(item.notes);
                  setCategoryId(item.category_id);
                  setShowSuggestions(false);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: "#f2f2f2",
                }}
              >
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: item.color,
                    justifyContent: "center",
                    alignItems: "center",
                    marginRight: 12,
                  }}
                >
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={18}
                    color="#fff"
                  />
                </View>

                <Text numberOfLines={1}>
                  {item.notes}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={{ marginBottom: 12 }}>
        <TouchableOpacity
          activeOpacity={0.8}
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
                justifyContent: 'space-between',
                rowGap: 8,
                marginTop: 8,
              }}
            >
              {visibleSources.map(s => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => {
                    setSourceId(s.id);
                    setShowSourceGrid(false);
                    setSourceSearch('');
                  }}
                  style={{
                    width: '23%',
                    height: 72,
                    borderRadius: 10,
                    marginBottom: 8,
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
          <Text style={{ marginBottom: 6, color: '#666' }}>To Account</Text>
          <TouchableOpacity
            onPress={() => {
              setSelectingFor('to');
              setSourceSearch('');
              setShowSourceModal(true);
            }}
            activeOpacity={0.8}
            style={{
              borderWidth: 1,
              borderColor: '#eee',
              padding: 12,
              borderRadius: 8,
              backgroundColor: '#fff',
              flexDirection: 'row',
              alignItems: 'center'
            }}
          >
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: '#eef7ff',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12
            }}>
              <MaterialCommunityIcons
                name={(sources.find(x => x.id === toAccount) || {}).icon || 'cash'}
                size={18}
                color={(sources.find(x => x.id === toAccount) || {}).color || '#4B7CF3'}
              />
            </View>

            <Text style={{ fontSize: 16 }}>
              {(sources.find(x => x.id === toAccount) || {}).name || 'Select destination account'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
        <PaperButton mode="contained" onPress={submit} style={{ backgroundColor: accent }} labelStyle={{ color: '#fff' }}>
          {isEdit ? 'Update' : 'Save'}
        </PaperButton>
        <View style={{ width: 12 }} />
        <PaperButton mode="outlined" onPress={() => { if (onCancel) onCancel(); else { setAmount(''); setNotes(''); } }}>Cancel</PaperButton>
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
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selected) => {
                    if (Platform.OS === 'android') {
                      if (event.type === 'dismissed') {
                        setShowDateTimePicker(false);
                        setPickerMode('date');
                        return;
                      }

                      if (pickerMode === 'date') {
                        if (selected) {
                          const picked = selected;
                          const prev = new Date(date);
                          picked.setHours(prev.getHours(), prev.getMinutes(), 0, 0);
                          setDate(picked.toISOString());

                          setShowDateTimePicker(false);
                          setOpenTimePicker(true);
                        }
                      } else {
                        if (selected) {
                          const prev = new Date(date);
                          prev.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
                          setDate(prev.toISOString());
                        }
                        setShowDateTimePicker(false);
                        setPickerMode('date');
                      }
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

      <CategoryCreateModal
        visible={showCategoryCreateModal}
        onClose={() => setShowCategoryCreateModal(false)}
        onCategoryCreated={async (newCategory) => {
          const cats = await getCategories(true);

          setCategories(cats);
          setCategoryId(newCategory.id);

          setShowCategoryCreateModal(false);
          setShowCategoryGrid(false);

          // Optional: reopen picker instead of closing
          // setShowCategoryModal(true);
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

    </ScrollView>
  );
}
