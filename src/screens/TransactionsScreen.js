import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { getTransactionsPaginated } from '../services/transactions';
import { getCategories } from '../services/categories';
import { getSources } from '../services/sources';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing } from '../components/Theme';
import FAB from '../components/FAB';
import { useFocusEffect } from '@react-navigation/native';
import { usePageLoader } from '../context/PageLoaderContext';
// Redux imports
import {
  setTransactions,
  setLoading as setTransactionLoading,
  setError as setTransactionError,
} from '../redux/slices/transactionSlice';
import { setCategoriesMap } from '../redux/slices/categorySlice';
import {
  getTransactionType,
  getAmountColor,
  getAmountPrefix,
  getTypeIcon,
} from '../utils/transactionUtils';
import { getDateKey } from '../utils/dateUtils';
import TransactionListItem from '../components/TransactionListItem';
import { setSources as setReduxSources } from '../redux/slices/sourceSlice';
import { useAppDispatch } from '../redux/hooks';

export default function TransactionsScreen({ navigation }) {
  const dispatch = useAppDispatch();
  const { show: showLoader, hide: hideLoader } = usePageLoader();
  
  // Local state
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sourceOptions, setSourceOptions] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const LIMIT = 30;

  const loadCategoriesAndSources = useCallback(async () => {
    try {
      const [categoriesData, sourcesData] = await Promise.all([
        getCategories(true),
        getSources(true),
      ]);
      setCategories(categoriesData || []);
      const cmap = {};
      (categoriesData || []).forEach((c) => {
        cmap[c.id] = c;
      });
      dispatch(setCategoriesMap(cmap));
      
      setSourceOptions(sourcesData || []);
      dispatch(setReduxSources(sourcesData || []));
    } catch (error) {
      console.error('Error loading static data:', error);
    }
  }, [dispatch]);

  const loadInitialTransactions = useCallback(async (isSilent = false) => {
    if (!isSilent) showLoader();

    const startTime = Date.now();
    const minimumLoaderDelay = 700;

    try {
      const newItems = await getTransactionsPaginated({
        limit: LIMIT,
        offset: 0,
        searchQuery,
        filterType: activeFilter
      });

      setItems(newItems || []);
      dispatch(setTransactions(newItems || []));
      setPage(1);
      setHasMore((newItems || []).length === LIMIT);
    } catch (error) {
      console.error('Error loading transaction data:', error);
      setItems([]);
      dispatch(setTransactionError(error.message));
    } finally {
      if (!isSilent) {
        const elapsed = Date.now() - startTime;
        const remainingDelay = minimumLoaderDelay - elapsed;

        if (remainingDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, remainingDelay));
        }
        hideLoader();
      }
    }
  }, [searchQuery, activeFilter, dispatch, showLoader, hideLoader]);

  useEffect(() => {
    loadCategoriesAndSources();
  }, [loadCategoriesAndSources]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadInitialTransactions();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadInitialTransactions]);

  useFocusEffect(
    useCallback(() => {
      loadInitialTransactions(true);
      loadCategoriesAndSources();
    }, [loadInitialTransactions, loadCategoriesAndSources])
  );

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const newItems = await getTransactionsPaginated({
        limit: LIMIT,
        offset: page * LIMIT,
        searchQuery,
        filterType: activeFilter
      });
      if (newItems.length > 0) {
        setItems(prev => {
          const updated = [...prev, ...newItems];
          dispatch(setTransactions(updated));
          return updated;
        });
        setPage(prev => prev + 1);
      }
      if (newItems.length < LIMIT) {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more transactions:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleEdit = (item) => {
    navigation.navigate('TransactionAdd', {
      isEdit: true,
      transaction: item,
    });
  };

  // ---------------------------------------------------------
  // GROUP BY DATE
  // ---------------------------------------------------------

  const groupedTransactions = useMemo(() => {
    const groups = {};


    items.forEach(item => {
      const key = getDateKey(item.date);

      if (!groups[key]) {
        groups[key] = [];
      }

      groups[key].push(item);
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map(dateKey => {
        const [year, month, day] = dateKey
          .split('-')
          .map(Number);

        const date = new Date(year, month - 1, day);
        date.setHours(0, 0, 0, 0);

        let title;

        if (date.getTime() === today.getTime()) {
          title = 'Today';
        } else if (date.getTime() === yesterday.getTime()) {
          title = 'Yesterday';
        } else {
          title = date.toLocaleDateString(undefined, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
        }

        const dailyExpense = groups[dateKey].reduce(
          (sum, item) => {
            return String(item.type || '').toLowerCase() === 'expense' && item.is_counted !== 0
              ? sum + Number(item.amount || 0)
              : sum;
          },
          0
        );

        const dailyIncome = groups[dateKey].reduce(
          (sum, item) => {
            return String(item.type || '').toLowerCase() === 'income' && item.is_counted !== 0
              ? sum + Number(item.amount || 0)
              : sum;
          },
          0
        );

        return {
          title,
          dateKey,
          data: groups[dateKey],
          dailyExpense,
          dailyIncome,
        };
      });
  }, [items]);

  // ---------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------


  // ---------------------------------------------------------
  // FILTER CHIP
  // ---------------------------------------------------------

  const FilterChip = ({
    label,
    value,
    icon,
  }) => {
    const active = activeFilter === value;

    return (
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={() => setActiveFilter(value)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          height: 34,
          borderRadius: 17,
          marginRight: 8,
          backgroundColor: active ? Colors.text : '#F3F4F6',
          borderWidth: 1,
          borderColor: active ? Colors.text : '#E5E7EB',
        }}
      >
        {icon && (
          <MaterialCommunityIcons
            name={icon}
            size={15}
            color={active ? '#fff' : '#6B7280'}
            style={{ marginRight: 5 }}
          />
        )}

        <Text
          style={{
            fontSize: 12,
            fontWeight: active ? '800' : '600',
            color: active ? '#fff' : '#6B7280',
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  // ---------------------------------------------------------
  // SCREEN
  // ---------------------------------------------------------

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#F8F9FB',
      }}
    >
      {/* HEADER */}
      <View
        style={{
          paddingHorizontal: Spacing.s,
          paddingTop: 12,
          paddingBottom: 4,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View>
            <Text
              style={{
                fontSize: 24,
                fontWeight: '800',
                color: Colors.text,
                letterSpacing: -0.5,
              }}
            >
              Transactions
            </Text>

            <Text
              style={{
                fontSize: 12,
                color: Colors.muted,
                marginTop: 2,
              }}
            >
              {items.length} transaction
              {items.length === 1 ? '' : 's'}
            </Text>
          </View>
        </View>
      </View>

      {/* SEARCH */}
      <View
        style={{
          paddingHorizontal: Spacing.s,
          paddingTop: 10,
        }}
      >
        <View
          style={{
            height: 48,
            borderRadius: 24,
            backgroundColor: '#fff',
            borderWidth: 1,
            borderColor: '#E9EBEF',
            flexDirection: 'row',
            alignItems: 'center',
            paddingLeft: 16,
            paddingRight: 6,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.03,
            shadowRadius: 3,
            elevation: 2,
          }}
        >
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            onSubmitEditing={() => setSearchQuery(searchInput)}
            returnKeyType="search"
            placeholder="Search transactions..."
            placeholderTextColor="#9CA3AF"
            style={{
              flex: 1,
              fontSize: 15,
              color: Colors.text,
              paddingVertical: 0,
            }}
          />

          {searchInput.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchInput('');
                setSearchQuery('');
              }}
              activeOpacity={0.7}
              style={{ padding: 6 }}
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={20}
                color="#9CA3AF"
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => setSearchQuery(searchInput)}
            activeOpacity={0.8}
            style={{
              backgroundColor: Colors.primary,
              width: 36,
              height: 36,
              borderRadius: 18,
              justifyContent: 'center',
              alignItems: 'center',
              marginLeft: 4,
            }}
          >
            <MaterialCommunityIcons
              name="magnify"
              size={20}
              color="#FFF"
            />
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 11, color: Colors.muted, marginTop: 8, marginLeft: 16, fontWeight: '500' }}>
          Press Enter or click the search icon to search
        </Text>
      </View>

      {/* FILTERS */}
      <View
        style={{
          paddingTop: 10,
          paddingBottom: 7,
        }}
      >
        <SectionList
          horizontal
          sections={[
            {
              title: 'filters',
              data: ['filters'],
            },
          ]}
          renderItem={() => (
            <View
              style={{
                flexDirection: 'row',
                paddingHorizontal: Spacing.s,
              }}
            >
              <FilterChip
                label="All"
                value="all"
                icon="format-list-bulleted"
              />

              <FilterChip
                label="Expense"
                value="expense"
                icon="arrow-up"
              />

              <FilterChip
                label="Income"
                value="income"
                icon="arrow-down"
              />

              <FilterChip
                label="Transfer"
                value="transfer"
                icon="swap-horizontal"
              />
            </View>
          )}
          showsHorizontalScrollIndicator={false}
          keyExtractor={() => 'filters'}
          renderSectionHeader={() => null}
        />
      </View>

      {/* TRANSACTIONS */}
      <SectionList
        sections={groupedTransactions}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 20 }}>
              <ActivityIndicator size="small" color={Colors.text} />
            </View>
          ) : null
        }

        contentContainerStyle={{
          paddingHorizontal: Spacing.s,
          paddingBottom: 90,
          flexGrow: 1,
        }}

        ListEmptyComponent={
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingTop: 80,
            }}
          >
            <View
              style={{
                width: 76,
                height: 76,
                borderRadius: 38,
                backgroundColor: '#EEF0F3',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <MaterialCommunityIcons
                name={
                  searchQuery
                    ? 'magnify-close'
                    : 'clipboard-text-outline'
                }
                size={36}
                color="#AEB4BC"
              />
            </View>

            <Text
              style={{
                color: Colors.text,
                fontSize: 15,
                fontWeight: '700',
                marginTop: 14,
              }}
            >
              {searchQuery
                ? 'No matching transactions'
                : 'No transactions yet'}
            </Text>

            <Text
              style={{
                color: Colors.muted,
                fontSize: 12,
                marginTop: 5,
                textAlign: 'center',
              }}
            >
              {searchQuery
                ? 'Try a different search or filter'
                : 'Your transactions will appear here'}
            </Text>
          </View>
        }

        renderSectionHeader={({ section }) => (
          <View
            style={{
              paddingTop: 9,
              paddingBottom: 7,
              backgroundColor: '#F8F9FB',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '900',
                    color: Colors.text,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                  }}
                >
                  {section.title}
                </Text>

                <Text
                  style={{
                    fontSize: 11,
                    color: Colors.muted,
                    marginTop: 2,
                  }}
                >
                  {section.data.length}{' '}
                  {section.data.length === 1
                    ? 'transaction'
                    : 'transactions'}
                </Text>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                {section.dailyIncome > 0 && (
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color: '#20A56A',
                      marginRight: 8,
                    }}
                  >
                    +₹{section.dailyIncome.toFixed(0)}
                  </Text>
                )}

                {section.dailyExpense > 0 && (
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color: '#E35D6A',
                    }}
                  >
                    -₹{section.dailyExpense.toFixed(0)}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        renderItem={({ item, index, section }) => {
          const category = categories.find(
            x => x.id === item.category_id
          );
          const source = sourceOptions.find(
            x => x.id === item.source_id
          );
          const isLast = index === section.data.length - 1;
          return (
            <TransactionListItem
              item={item}
              category={category}
              source={source}
              isLast={isLast}
              onPress={() => handleEdit(item)}
            />
          );
        }}
      />

      {/* global PageLoader is provided by PageLoaderProvider */}

      {/* FAB */}
      <FAB
        onPress={() =>
          navigation.navigate('TransactionAdd')
        }
      />
    </View>
  );
}