import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { getTransactions } from '../services/transactions';
import { getCategories } from '../services/categories';
import { getSources } from '../services/sources';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Spacing } from '../components/Theme';
import { useFocusEffect } from '@react-navigation/native';
import {
  useCategories,
  useSourcesList,
  useFilteredTransactions,
  useAppDispatch,
} from '../redux/hooks';
import { setCategories } from '../redux/slices/categorySlice';
import { setSources as setReduxSources } from '../redux/slices/sourceSlice';
import { setFilteredTransactions } from '../redux/slices/transactionSlice';
import {
  getTransactionType,
  getAmountColor,
  getAmountPrefix,
  getTypeIcon,
} from '../utils/transactionUtils';
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

  // ---------------------------------------------------------
  // SEARCH
  // ---------------------------------------------------------

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const loadStatic = async () => {
        try {
          const [cats, srcs] = await Promise.all([
            getCategories(true),
            getSources(true)
          ]);
          if (isActive) {
            dispatch(setCategories(cats || []));
            dispatch(setReduxSources(srcs || []));
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

      if (q.length < 3) {
        dispatch(setFilteredTransactions([]));
        return;
      }

      try {
        const transactions = await getTransactions(1000000, 'Yes');
        const lowerQuery = q.toLowerCase();

        const filtered = transactions.filter(item => {
          const category =
            categories.find(
              x => String(x.id) === String(item.category_id)
            )?.name || '';

          const source =
            sources.find(
              x => String(x.id) === String(item.source_id)
            )?.name || '';

          return (
            (item.notes || '').toLowerCase().includes(lowerQuery) ||
            String(item.amount || '').includes(q) ||
            category.toLowerCase().includes(lowerQuery) ||
            source.toLowerCase().includes(lowerQuery)
          );
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
  }, [searchQuery, categories, sources]);

  // ---------------------------------------------------------
  // EDIT
  // ---------------------------------------------------------

  const handleEdit = (item) => {
    navigation.navigate('TransactionAdd', {
      isEdit: true,
      transaction: item,
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
    yesterday.setDate(
      yesterday.getDate() - 1
    );

    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map(dateKey => {
        const [year, month, day] =
          dateKey.split('-').map(Number);

        const date = new Date(
          year,
          month - 1,
          day
        );

        date.setHours(0, 0, 0, 0);

        let title;

        if (
          date.getTime() ===
          today.getTime()
        ) {
          title = 'Today';
        } else if (
          date.getTime() ===
          yesterday.getTime()
        ) {
          title = 'Yesterday';
        } else {
          title =
            date.toLocaleDateString(
              undefined,
              {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              }
            );
        }

        return {
          title,
          dateKey,
          data: groups[dateKey],
        };
      });
  }, [items]);

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
        <Text
          style={{
            fontSize: 24,
            fontWeight: '800',
            color: Colors.text,
            letterSpacing: -0.5,
          }}
        >
          Search
        </Text>

        <Text
          style={{
            fontSize: 12,
            color: Colors.muted,
            marginTop: 2,
          }}
        >
          Find your transactions quickly
        </Text>
      </View>

      {/* SEARCH BAR */}

      <View
        style={{
          paddingHorizontal: Spacing.s,
          paddingTop: 10,
        }}
      >
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
              height: 2,
            },
            shadowOpacity: 0.035,
            shadowRadius: 5,
            elevation: 1,
          }}
        >
          <MaterialCommunityIcons
            name="magnify"
            size={22}
            color="#8F96A1"
          />

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
              paddingVertical: 0,
            }}
          />

          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() =>
                setSearchQuery('')
              }
              activeOpacity={0.7}
              style={{
                padding: 3,
              }}
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={19}
                color="#A3A9B2"
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* RESULT COUNT */}

      {searchQuery.trim().length >= 3 &&
        items.length > 0 && (
          <View
            style={{
              paddingHorizontal: Spacing.s,
              paddingTop: 12,
              paddingBottom: 2,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                color: Colors.muted,
                fontWeight: '600',
              }}
            >
              {items.length}{' '}
              {items.length === 1
                ? 'transaction'
                : 'transactions'} found
            </Text>
          </View>
        )}

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
          flexGrow: 1,
        }}

        ListEmptyComponent={
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingTop: 70,
              paddingHorizontal: 25,
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
                  searchQuery.length < 3
                    ? 'magnify'
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
                textAlign: 'center',
              }}
            >
              {searchQuery.length < 3
                ? 'Search your transactions'
                : 'No transactions found'}
            </Text>

            <Text
              style={{
                color: Colors.muted,
                fontSize: 12,
                marginTop: 6,
                textAlign: 'center',
                lineHeight: 18,
              }}
            >
              {searchQuery.length < 3
                ? 'Type at least 3 characters to search by note, amount, category or source'
                : 'Try a different keyword, amount, category or source'}
            </Text>
          </View>
        }

        /* DATE HEADER */

        renderSectionHeader={({ section }) => (
          <View
            style={{
              paddingTop: 10,
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
            </View>
          </View>
        )}

        /* TRANSACTION CARD */

        renderItem={({
          item,
          index,
          section,
        }) => {
          const category =
            categories.find(
              x =>
                String(x.id) ===
                String(item.category_id)
            );

          const source =
            sources.find(
              x =>
                String(x.id) ===
                String(item.source_id)
            );

          const isLast =
            index ===
            section.data.length - 1;

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
    </View>
  );
}