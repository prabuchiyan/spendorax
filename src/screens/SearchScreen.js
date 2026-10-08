import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView
} from
  'react-native';
import { getTransactions, getAdvancedSearchTransactions, getAvailableMonths } from '../services/transactions';
import { getCategories } from '../services/categories';
import { getSources } from '../services/sources';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing } from '../components/Theme';
import { useFocusEffect } from '@react-navigation/native';
import MuiDateTimePicker from '../components/MuiDateTimePicker';
import {
  useCategories,
  useSourcesList,
  useFilteredTransactions,
  useAppDispatch
} from
  '../redux/hooks';
import { setCategories } from '../redux/slices/categorySlice';
import { setSources as setReduxSources } from '../redux/slices/sourceSlice';
import { setFilteredTransactions } from '../redux/slices/transactionSlice';
import { getDateKey } from '../utils/dateUtils';
import TransactionListItem from '../components/TransactionListItem';

export default function SearchScreen({ navigation }) {
  const dispatch = useAppDispatch();
  const reduxCategories = useCategories();
  const categories = reduxCategories || [];
  const reduxSources = useSourcesList();
  const sources = reduxSources || [];
  const reduxItems = useFilteredTransactions();
  const items = reduxItems || [];
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdvancedModalVisible, setAdvancedModalVisible] = useState(false);
  const [advAmount, setAdvAmount] = useState('');
  const [advNote, setAdvNote] = useState('');
  const [advType, setAdvType] = useState('all'); // all, income, expense, transfer
  const [advDateType, setAdvDateType] = useState('none'); // none, exact, month, duration
  const [advExactDate, setAdvExactDate] = useState('');
  const [advMonth, setAdvMonth] = useState('');
  const [advYear, setAdvYear] = useState('');
  const [advStartDate, setAdvStartDate] = useState('');
  const [advEndDate, setAdvEndDate] = useState('');
  const [availableMonths, setAvailableMonths] = useState([]);
  const availableYears = useMemo(() => {
    const years = new Set(availableMonths.map(m => m.substring(0, 4)));
    return Array.from(years).sort().reverse();
  }, [availableMonths]);
  const formatMonth = (yyyyMm) => {
    if (!yyyyMm) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const [year, month] = yyyyMm.split('-');
    return `${months[parseInt(month, 10) - 1]} ${year}`;
  };
  const [groupByOption, setGroupByOption] = useState('day'); // day, month, year
  const [datePickerTarget, setDatePickerTarget] = useState(null); // 'exact', 'start', 'end'
  const [refreshKey, setRefreshKey] = useState(0);
  const clearAdvancedSearch = () => {
    setAdvAmount('');
    setAdvNote('');
    setAdvType('all');
    setAdvDateType('none');
    setAdvExactDate('');
    setAdvMonth('');
    setAdvYear('');
    setAdvStartDate('');
    setAdvEndDate('');
    setGroupByOption('day');
  };

  // ---------------------------------------------------------
  // SEARCH
  // ---------------------------------------------------------

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const loadStatic = async () => {
        try {
          const [cats, srcs, months] = await Promise.all([
            getCategories(true),
            getSources(true),
            getAvailableMonths()]
          );
          if (isActive) {
            dispatch(setCategories(cats || []));
            dispatch(setReduxSources(srcs || []));
            setAvailableMonths(months || []);
            setRefreshKey(prev => prev + 1);
          }
        } catch (e) {
          console.warn(e);
        }
      };
      loadStatic();
      return () => { isActive = false; };
    }, [dispatch])
  );

  useEffect(() => {
    let isActive = true;

    const search = async () => {
      const q = searchQuery.trim();

      if (q.toLowerCase() === 'advanced search active') {
        return;
      }

      if (q.length < 3) {
        dispatch(setFilteredTransactions([]));
        return;
      }

      try {
        const rawTransactions = await getTransactions(1000000, 'Yes');
        const lowerQuery = q.toLowerCase();

        // Deduplicate transfers so they show as a single item
        const processedGroups = new Set();
        const transactions = [];
        for (const t of rawTransactions) {
          if (t.transfer_group_id) {
            if (processedGroups.has(t.transfer_group_id)) continue;
            processedGroups.add(t.transfer_group_id);

            let related = rawTransactions.find((x) => x.transfer_group_id === t.transfer_group_id && x.id !== t.id);
            const debit = t.type === 'expense' || t.direction === 'debit' ? t : related;
            const credit = t.type === 'income' || t.direction === 'credit' ? t : related;

            transactions.push({
              ...(debit || t),
              type: 'transfer',
              source_id: debit?.source_id || t.source_id,
              toAccount: credit?.source_id,
              amount: debit?.amount || credit?.amount || t.amount,
              is_transfer: 1
            });
          } else {
            transactions.push(t);
          }
        }

        const filtered = transactions.filter((item) => {
          const category =
            categories.find(
              (x) => String(x.id) === String(item.category_id)
            )?.name || '';

          const source =
            sources.find(
              (x) => String(x.id) === String(item.source_id)
            )?.name || '';

          const toSource = (item.type === 'transfer' || item.transfer_group_id)
            ? (sources.find((x) => String(x.id) === String(item.toAccount || item.to_account))?.name || '')
            : '';

          return (
            (item.notes || '').toLowerCase().includes(lowerQuery) ||
            String(item.amount || '').includes(q) ||
            category.toLowerCase().includes(lowerQuery) ||
            source.toLowerCase().includes(lowerQuery) ||
            toSource.toLowerCase().includes(lowerQuery));

        });

        if (isActive) {
          dispatch(setFilteredTransactions(filtered));
        }
      } catch (e) {
        console.warn(e);
      }
    };

    search();

    return () => { isActive = false; };
  }, [searchQuery, categories, sources, refreshKey]);

  // ---------------------------------------------------------
  // ADVANCED SEARCH
  // ---------------------------------------------------------

  const fetchAdvanced = useCallback(async () => {
    try {
      const rawTransactions = await getAdvancedSearchTransactions({
        amount: advAmount,
        note: advNote,
        type: advType,
        exactDate: advDateType === 'exact' ? advExactDate : null,
        month: advDateType === 'month' ? advMonth : null,
        year: advDateType === 'year' ? advYear : null,
        startDate: advDateType === 'duration' ? advStartDate : null,
        endDate: advDateType === 'duration' ? advEndDate : null,
      });

      const processedGroups = new Set();
      const transactions = [];
      for (const t of rawTransactions) {
        if (t.transfer_group_id) {
          if (processedGroups.has(t.transfer_group_id)) continue;
          processedGroups.add(t.transfer_group_id);

          let related = rawTransactions.find((x) => x.transfer_group_id === t.transfer_group_id && x.id !== t.id);
          const debit = t.type === 'expense' || t.direction === 'debit' ? t : related;
          const credit = t.type === 'income' || t.direction === 'credit' ? t : related;

          transactions.push({
            ...(debit || t),
            type: 'transfer',
            source_id: debit?.source_id || t.source_id,
            toAccount: credit?.source_id,
            amount: debit?.amount || credit?.amount || t.amount,
            is_transfer: 1
          });
        } else {
          transactions.push(t);
        }
      }

      dispatch(setFilteredTransactions(transactions));
    } catch (e) {
      console.warn(e);
    }
  }, [advAmount, advNote, advType, advDateType, advExactDate, advMonth, advYear, advStartDate, advEndDate, dispatch]);

  useEffect(() => {
    if (searchQuery.trim().toLowerCase() === 'advanced search active') {
      fetchAdvanced();
    }
  }, [refreshKey, fetchAdvanced]);

  const handleAdvancedSearch = async () => {
    setAdvancedModalVisible(false);
    setSearchQuery('Advanced Search Active');
    setRefreshKey(prev => prev + 1);
  };

  // ---------------------------------------------------------
  // EDIT
  // ---------------------------------------------------------

  const handleEdit = (item) => {
    navigation.navigate('TransactionAdd', {
      isEdit: true,
      transaction: item
    });
  };

  // ---------------------------------------------------------
  // TRANSACTION TYPE
  // ---------------------------------------------------------



  // ---------------------------------------------------------
  // GROUP SEARCH RESULTS BY DATE
  // ---------------------------------------------------------

  const groupedResults = useMemo(() => {
    if (!items.length) {
      return [];
    }

    const groups = {};


    items.forEach((item) => {
      let key;
      if (groupByOption === 'year') {
        key = (item.date || '').substring(0, 4);
      } else if (groupByOption === 'month') {
        key = (item.date || '').substring(0, 7);
      } else {
        key = getDateKey(item.date);
      }

      if (!groups[key]) {
        groups[key] = [];
      }

      groups[key].push(item);
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(
      yesterday.getDate() - 1
    );

    return Object.keys(groups).
      sort((a, b) => b.localeCompare(a)).
      map((dateKey) => {
        let title;
        if (groupByOption === 'year') {
          title = dateKey;
        } else if (groupByOption === 'month') {
          const [y, m] = dateKey.split('-');
          const date = new Date(y, m - 1, 1);
          title = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        } else {
          const [year, month, day] = dateKey.split('-').map(Number);
          const date = new Date(year, month - 1, day);
          date.setHours(0, 0, 0, 0);

          if (date.getTime() === today.getTime()) {
            title = 'Today';
          } else if (date.getTime() === yesterday.getTime()) {
            title = 'Yesterday';
          } else {
            title = date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
          }
        }

        return {
          title,
          dateKey,
          data: groups[dateKey]
        };
      });
  }, [items, groupByOption]);

  // ---------------------------------------------------------
  // SCREEN
  // ---------------------------------------------------------

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#F8F9FB'
      }}>


      {/* HEADER */}

      <View
        style={{
          paddingHorizontal: Spacing.s,
          paddingTop: 12,
          paddingBottom: 4,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
        <View>
          <Text
            style={{
              fontSize: 24,
              fontWeight: '800',
              color: Colors.text,
              letterSpacing: -0.5
            }}>
            Search
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: Colors.muted,
              marginTop: 2
            }}>
            Find your transactions quickly
          </Text>
        </View>
        <TouchableOpacity onPress={() => setAdvancedModalVisible(true)} style={{ padding: 8 }}>
          <MaterialCommunityIcons name="dots-vertical" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* SEARCH BAR */}

      <View
        style={{
          paddingHorizontal: Spacing.s,
          paddingTop: 10
        }}>

        <View
          style={{
            height: 46,
            borderRadius: 13,
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#E7E9ED',

            flexDirection: 'row',
            alignItems: 'center',

            paddingHorizontal: 13,

            shadowColor: '#000',
            shadowOffset: {
              width: 0,
              height: 2
            },
            shadowOpacity: 0.035,
            shadowRadius: 5,
            elevation: 1
          }}>

          <MaterialCommunityIcons
            name="magnify"
            size={22}
            color="#8F96A1" />


          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search transactions..."
            placeholderTextColor="#9CA3AF"
            autoCorrect={false}
            returnKeyType="search"
            style={{
              flex: 1,
              marginLeft: 9,
              fontSize: 14,
              color: Colors.text,
              paddingVertical: 0
            }} />


          {searchQuery.length > 0 &&
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                clearAdvancedSearch();
              }}
              activeOpacity={0.7}
              style={{
                padding: 3
              }}>

              <MaterialCommunityIcons
                name="close-circle"
                size={19}
                color="#A3A9B2" />

            </TouchableOpacity>
          }
        </View>
      </View>

      {/* RESULT COUNT */}

      {searchQuery.trim().length >= 3 &&
        items.length > 0 &&
        <View
          style={{
            paddingHorizontal: Spacing.s,
            paddingTop: 12,
            paddingBottom: 2
          }}>

          <Text
            style={{
              fontSize: 12,
              color: Colors.muted,
              fontWeight: '600'
            }}>

            {items.length}{' '}
            {items.length === 1 ?
              'transaction' :
              'transactions'} found
          </Text>
        </View>
      }

      {/* RESULTS */}

      <SectionList
        sections={groupedResults}
        keyExtractor={(item) =>
          String(item.id)
        }
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}

        contentContainerStyle={{
          paddingHorizontal: Spacing.s,
          paddingBottom: 40,
          flexGrow: 1
        }}

        ListEmptyComponent={
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingTop: 70,
              paddingHorizontal: 25
            }}>

            <View
              style={{
                width: 76,
                height: 76,
                borderRadius: 38,
                backgroundColor: '#EEF0F3',
                justifyContent: 'center',
                alignItems: 'center'
              }}>

              <MaterialCommunityIcons
                name={
                  searchQuery.length < 3 ?
                    'magnify' :
                    'clipboard-text-outline'
                }
                size={36}
                color="#AEB4BC" />

            </View>

            <Text
              style={{
                color: Colors.text,
                fontSize: 15,
                fontWeight: '700',
                marginTop: 14,
                textAlign: 'center'
              }}>

              {(searchQuery.length < 3 && searchQuery !== 'Advanced Search Active') ?
                'Search your transactions' :
                'No transactions found'}
            </Text>

            <Text
              style={{
                color: Colors.muted,
                fontSize: 12,
                marginTop: 6,
                textAlign: 'center',
                lineHeight: 18
              }}>

              {(searchQuery.length < 3 && searchQuery !== 'Advanced Search Active') ?
                'Type at least 3 characters to search by note, amount, category or source' :
                'Try a different keyword, amount, category or source'}
            </Text>
          </View>
        }

        /* DATE HEADER */

        renderSectionHeader={({ section }) =>
          <View
            style={{
              paddingTop: 10,
              paddingBottom: 7,
              backgroundColor: '#F8F9FB'
            }}>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>

              <View>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '900',
                    color: Colors.text,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4
                  }}>

                  {section.title}
                </Text>

                <Text
                  style={{
                    fontSize: 11,
                    color: Colors.muted,
                    marginTop: 2
                  }}>

                  {section.data.length}{' '}
                  {section.data.length === 1 ?
                    'transaction' :
                    'transactions'}
                </Text>
              </View>
            </View>
          </View>
        }

        /* TRANSACTION CARD */

        renderItem={({
          item,
          index,
          section
        }) => {
          const category =
            categories.find(
              (x) =>
                String(x.id) ===
                String(item.category_id)
            );

          const source =
            sources.find(
              (x) =>
                String(x.id) ===
                String(item.source_id)
            );

          const toSource = item.type === 'transfer' || item.transfer_group_id
            ? sources.find(
              (x) => String(x.id) === String(item.toAccount || item.to_account)
            )
            : null;

          const isLast =
            index ===
            section.data.length - 1;

          return (
            <TransactionListItem
              item={item}
              category={category}
              source={source}
              toSource={toSource}
              isLast={isLast}
              onPress={() => handleEdit(item)} />);


        }} />

      <Modal
        visible={isAdvancedModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAdvancedModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingVertical: 20, maxHeight: '92%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: Colors.text, letterSpacing: -0.5 }}>Advanced Filters</Text>
              <TouchableOpacity onPress={() => setAdvancedModalVisible(false)} style={{ backgroundColor: '#F3F4F6', padding: 6, borderRadius: 20 }}>
                <MaterialCommunityIcons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>

              <Text style={{ fontSize: 13, fontWeight: '700', textTransform: 'uppercase', color: '#6B7280', letterSpacing: 0.8, marginBottom: 12 }}>Transaction Type</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 }}>
                {[
                  { id: 'all', icon: 'format-list-bulleted', color: '#6366F1' },
                  { id: 'expense', icon: 'arrow-up-circle', color: '#EF4444' },
                  { id: 'income', icon: 'arrow-down-circle', color: '#10B981' },
                  { id: 'transfer', icon: 'swap-horizontal', color: '#F59E0B' }
                ].map(t => {
                  const isActive = advType === t.id;
                  return (
                    <TouchableOpacity key={t.id} onPress={() => setAdvType(t.id)} style={{
                      width: '48%', marginBottom: 12,
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12,
                      backgroundColor: isActive ? t.color : `${t.color}15`,
                      borderWidth: 1, borderColor: isActive ? t.color : `${t.color}30`
                    }}>
                      <MaterialCommunityIcons
                        name={t.icon}
                        size={18}
                        color={isActive ? '#fff' : t.color}
                      />
                      <Text style={{ color: isActive ? '#fff' : t.color, textTransform: 'capitalize', fontWeight: '700' }}>{t.id}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              {/* Amount */}
              <Text style={{ fontSize: 13, fontWeight: '700', textTransform: 'uppercase', color: '#6B7280', letterSpacing: 0.8, marginBottom: 12 }}>Exact Amount</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 12, paddingHorizontal: 14, marginBottom: 24 }}>
                <MaterialCommunityIcons name="currency-inr" size={22} color="#F59E0B" />
                <TextInput value={advAmount} onChangeText={setAdvAmount} keyboardType="numeric" placeholder="0.00" placeholderTextColor="#D97706" style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 8, fontSize: 16, color: '#92400E', fontWeight: '700' }} />
              </View>

              {/* Notes */}
              <Text style={{ fontSize: 13, fontWeight: '700', textTransform: 'uppercase', color: '#6B7280', letterSpacing: 0.8, marginBottom: 12 }}>Exact Word in Notes</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: '#C7D2FE', borderRadius: 12, paddingHorizontal: 14, marginBottom: 24 }}>
                <MaterialCommunityIcons name="text-search" size={22} color="#6366F1" />
                <TextInput value={advNote} onChangeText={setAdvNote} placeholder="e.g. Groceries" placeholderTextColor="#818CF8" style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 8, fontSize: 16, color: '#3730A3', fontWeight: '700' }} />
              </View>

              {/* Date Filter Type */}
              <Text style={{ fontSize: 13, fontWeight: '700', textTransform: 'uppercase', color: '#6B7280', letterSpacing: 0.8, marginBottom: 12 }}>Date Filter</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                {[
                  { id: 'none', label: 'All Time', icon: 'infinity', color: '#64748B' },
                  { id: 'exact', label: 'Exact Date', icon: 'calendar-today', color: '#06B6D4' },
                  { id: 'month', label: 'Month', icon: 'calendar-month', color: '#EC4899' },
                  { id: 'year', label: 'Year', icon: 'calendar-multiselect', color: '#8B5CF6' },
                  { id: 'duration', label: 'Duration', icon: 'calendar-range', color: '#14B8A6' }
                ].map(d => {
                  const isActive = advDateType === d.id;
                  return (
                    <TouchableOpacity key={d.id} onPress={() => {
                      setAdvDateType(d.id);
                      setAdvExactDate('');
                      setAdvMonth('');
                      setAdvYear('');
                      setAdvStartDate('');
                      setAdvEndDate('');
                    }} style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20,
                      backgroundColor: isActive ? d.color : `${d.color}15`,
                      borderWidth: 1, borderColor: isActive ? d.color : `${d.color}30`
                    }}>
                      <MaterialCommunityIcons name={d.icon} size={16} color={isActive ? '#fff' : d.color} />
                      <Text style={{ color: isActive ? '#fff' : d.color, fontWeight: '700', fontSize: 13 }}>{d.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Date Inputs based on Type */}
              {advDateType === 'exact' && (
                <TouchableOpacity onPress={() => setDatePickerTarget('exact')} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFEFF', borderWidth: 1, borderColor: '#67E8F9', borderRadius: 12, padding: 14, marginBottom: 24 }}>
                  <MaterialCommunityIcons name="calendar" size={22} color="#06B6D4" style={{ marginRight: 10 }} />
                  <Text style={{ fontSize: 16, fontWeight: '700', color: advExactDate ? '#164E63' : '#22D3EE' }}>{advExactDate || 'Select Date (YYYY-MM-DD)'}</Text>
                </TouchableOpacity>
              )}

              {advDateType === 'month' && (
                <View style={{ marginBottom: 24 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                    {availableMonths.map(m => (
                      <TouchableOpacity key={m} onPress={() => setAdvMonth(m)} style={{
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12,
                        backgroundColor: advMonth === m ? '#EC4899' : '#FDF2F8',
                        borderWidth: 1, borderColor: advMonth === m ? '#EC4899' : '#FBCFE8'
                      }}>
                        <MaterialCommunityIcons name="calendar-month" size={18} color={advMonth === m ? '#fff' : '#EC4899'} />
                        <Text style={{ color: advMonth === m ? '#fff' : '#BE185D', fontWeight: '800', fontSize: 14 }}>{formatMonth(m)}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {advDateType === 'year' && (
                <View style={{ marginBottom: 24 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                    {availableYears.map(y => (
                      <TouchableOpacity key={y} onPress={() => setAdvYear(y)} style={{
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12,
                        backgroundColor: advYear === y ? '#8B5CF6' : '#F5F3FF',
                        borderWidth: 1, borderColor: advYear === y ? '#8B5CF6' : '#EDE9FE'
                      }}>
                        <MaterialCommunityIcons name="calendar-multiselect" size={18} color={advYear === y ? '#fff' : '#8B5CF6'} />
                        <Text style={{ color: advYear === y ? '#fff' : '#6D28D9', fontWeight: '800', fontSize: 14 }}>{y}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {advDateType === 'duration' && (
                <View style={{ flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                  <TouchableOpacity onPress={() => setDatePickerTarget('start')} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#5EEAD4', borderRadius: 12, padding: 14 }}>
                    <MaterialCommunityIcons name="calendar-start" size={20} color="#14B8A6" style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: advStartDate ? '#134E4A' : '#2DD4BF', flex: 1 }} numberOfLines={1}>{advStartDate || 'Select Start Date'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setDatePickerTarget('end')} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#5EEAD4', borderRadius: 12, padding: 14 }}>
                    <MaterialCommunityIcons name="calendar-end" size={20} color="#14B8A6" style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: advEndDate ? '#134E4A' : '#2DD4BF', flex: 1 }} numberOfLines={1}>{advEndDate || 'Select End Date'}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Group By */}
              <Text style={{ fontSize: 13, fontWeight: '700', textTransform: 'uppercase', color: '#6B7280', letterSpacing: 0.8, marginBottom: 12 }}>Group Results By</Text>
              <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 14, padding: 4, marginBottom: 32 }}>
                {['day', 'month', 'year'].map(g => (
                  <TouchableOpacity key={g} onPress={() => setGroupByOption(g)} style={{
                    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10,
                    backgroundColor: groupByOption === g ? Colors.primary : 'transparent',
                    shadowColor: groupByOption === g ? Colors.primary : 'transparent',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 4,
                    elevation: groupByOption === g ? 4 : 0
                  }}>
                    <Text style={{ color: groupByOption === g ? '#fff' : '#64748B', textTransform: 'capitalize', fontWeight: groupByOption === g ? '800' : '600' }}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                <TouchableOpacity onPress={() => { clearAdvancedSearch(); setAdvancedModalVisible(false); setSearchQuery(''); }} style={{ flex: 1, backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FFE4E6', paddingVertical: 16, borderRadius: 16, alignItems: 'center' }}>
                  <Text style={{ color: '#E11D48', fontSize: 16, fontWeight: '800' }}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleAdvancedSearch} style={{ flex: 2, backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 16, alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Apply Filters</Text>
                </TouchableOpacity>
              </View>

            </ScrollView>
          </View>
        </View>
      </Modal>

      <MuiDateTimePicker
        visible={!!datePickerTarget}
        hideTime={true}
        allowClear={true}
        onClear={() => {
          if (datePickerTarget === 'exact') setAdvExactDate('');
          else if (datePickerTarget === 'start') setAdvStartDate('');
          else if (datePickerTarget === 'end') setAdvEndDate('');
          setDatePickerTarget(null);
        }}
        initialDate={
          datePickerTarget === 'exact' && advExactDate ? new Date(advExactDate) :
            datePickerTarget === 'start' && advStartDate ? new Date(advStartDate) :
              datePickerTarget === 'end' && advEndDate ? new Date(advEndDate) :
                new Date()
        }
        onClose={() => setDatePickerTarget(null)}
        onSelect={(d) => {
          if (!d) {
            if (datePickerTarget === 'exact') setAdvExactDate('');
            else if (datePickerTarget === 'start') setAdvStartDate('');
            else if (datePickerTarget === 'end') setAdvEndDate('');
            setDatePickerTarget(null);
            return;
          }
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const iso = `${y}-${m}-${day}`;
          if (datePickerTarget === 'exact') setAdvExactDate(iso);
          else if (datePickerTarget === 'start') setAdvStartDate(iso);
          else if (datePickerTarget === 'end') setAdvEndDate(iso);
          setDatePickerTarget(null);
        }}
      />
    </View>);

}