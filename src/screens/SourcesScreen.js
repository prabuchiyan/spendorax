import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { Searchbar, Avatar } from 'react-native-paper';

import { getSources, deleteSource } from '../services/sources';
import { getTransactions } from '../services/transactions';

import Card from '../components/Card';
import ConfirmDialog from '../components/ConfirmDialog';
import { Colors, Spacing } from '../components/Theme';
import SourceCreateModal from '../components/SourceCreateModal';
import FAB from '../components/FAB';
import { useBalanceVisibility } from '../context/BalanceVisibilityContext';

export default function SourcesScreen({ route, navigation }) {
  const [items, setItems] = useState([]);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editSource, setEditSource] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { balanceVisible } = useBalanceVisibility();

  async function load() {
    const sources = await getSources(true);
    const transactions = await getTransactions(1000000, 'Yes');

    const balanceMap = transactions.reduce((acc, txn) => {
      const amt = Number(txn.amount || 0);
      const sourceId = txn.source_id || txn.sourceId;

      if (!sourceId) return acc;

      if (!acc[sourceId]) {
        acc[sourceId] = 0;
      }

      if (txn.type === 'income' || txn.type === 'credit') {
        acc[sourceId] += amt;
      } else if (txn.type === 'expense' || txn.type === 'debit') {
        acc[sourceId] -= amt;
      }

      return acc;
    }, {});

    const updated = sources.map(s => {
      const id = s.id;

      const balance =
        Number(s.initial_balance || 0) +
        Number(balanceMap[id] || 0);

      return {
        ...s,
        balance,
      };
    });

    setItems(updated);
  }

  useEffect(() => {
    load();
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const filteredItems = useMemo(() => {
    if (!searchQuery) {
      return items;
    }

    const q = searchQuery.toLowerCase();

    return items.filter(item =>
      (item.name || '').toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  const totalBalance = useMemo(() => {
    return items.reduce(
      (sum, item) => sum + Number(item.balance || 0),
      0
    );
  }, [items]);

  const positiveAccounts = useMemo(() => {
    return items.filter(
      item => Number(item.balance || 0) >= 0
    ).length;
  }, [items]);

  const negativeAccounts = useMemo(() => {
    return items.filter(
      item => Number(item.balance || 0) < 0
    ).length;
  }, [items]);

  const formatAmount = amount => {
    return Number(amount || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  async function remove(id) {
    await deleteSource(id);
    load();
  }

  return (
    <View style={styles.container}>

      {/* =====================================================
          HEADER / SUMMARY
      ====================================================== */}
      <View style={styles.headerSection}>
        <View style={styles.titleRow}>
          <View style={styles.titleContainer}>
            <Text style={styles.pageTitle}>
              Accounts
            </Text>

            <Text style={styles.pageSubtitle}>
              Manage your money sources
            </Text>
          </View>

          <View style={styles.totalBadge}>
            <Text style={styles.totalBadgeNumber}>
              {items.length}
            </Text>

            <Text style={styles.totalBadgeLabel}>
              ACCOUNTS
            </Text>
          </View>
        </View>

        {/* =====================================================
            ACCOUNT STATS
        ====================================================== */}
        <View style={styles.statsRow}>

          <View style={[styles.statCard, styles.activeStat]}>
            <View style={styles.statIconBlue}>
              <MaterialCommunityIcons
                name="cash-plus"
                size={17}
                color="#4B7CF3"
              />
            </View>

            <View>
              <Text style={styles.statValue}>
                {positiveAccounts}
              </Text>

              <Text style={styles.statLabel}>
                Positive
              </Text>
            </View>
          </View>

          <View style={[styles.statCard, styles.negativeStat]}>
            <View style={styles.statIconRed}>
              <MaterialCommunityIcons
                name="cash-minus"
                size={17}
                color="#E46A6A"
              />
            </View>

            <View>
              <Text style={styles.statValue}>
                {negativeAccounts}
              </Text>

              <Text style={styles.statLabel}>
                Negative
              </Text>
            </View>
          </View>

        </View>
      </View>

      {/* =====================================================
          SEARCH
      ====================================================== */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search accounts"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
          iconColor="#7A8794"
          placeholderTextColor="#9AA5B1"
        />
      </View>

      {/* =====================================================
          ACCOUNT LIST
      ====================================================== */}
      <FlatList
        data={filteredItems}
        keyExtractor={item => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          filteredItems.length === 0 &&
            styles.emptyListContent,
        ]}
        ListHeaderComponent={
          filteredItems.length > 0 ? (
            <View style={styles.listHeader}>
              <Text style={styles.listTitle}>
                All Accounts
              </Text>

              <Text style={styles.listCount}>
                {filteredItems.length}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <MaterialCommunityIcons
                name="wallet-outline"
                size={39}
                color="#9AA5B1"
              />
            </View>

            <Text style={styles.emptyTitle}>
              No accounts found
            </Text>

            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try searching with a different name'
                : 'Create your first account to get started'}
            </Text>
          </View>
        }
        initialNumToRender={15}
        windowSize={10}
        renderItem={({ item }) => {

          const itemBalance = Number(item.balance || 0);
          const isNegative = itemBalance < 0;

          const itemColor =
            item.color || '#4B7CF3';

          return (
            <Card style={styles.accountCard}>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  const parent = navigation.getParent();

                  parent?.navigate('SourcesDetails', {
                    sourceId: item.id,
                    sourceName: item.name,
                  });
                }}
              >
                <View style={styles.accountRow}>

                  {/* =================================================
                      LEFT
                  ================================================== */}
                  <View style={styles.accountLeft}>

                    <View
                      style={[
                        styles.accountIconWrapper,
                        {
                          backgroundColor:
                            `${itemColor}15`,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={item.icon || 'cash'}
                        size={23}
                        color={itemColor}
                      />
                    </View>

                    <View style={styles.accountInfo}>

                      <Text
                        numberOfLines={1}
                        style={styles.accountName}
                      >
                        {item.name}
                      </Text>

                      <View style={styles.accountMeta}>

                        <View
                          style={[
                            styles.statusDot,
                            {
                              backgroundColor:
                                isNegative
                                  ? '#E46A6A'
                                  : '#36B37E',
                            },
                          ]}
                        />

                        <Text style={styles.accountMetaText}>
                          {isNegative
                            ? 'Negative balance'
                            : 'Available balance'}
                        </Text>

                      </View>

                    </View>
                  </View>

                  {/* =================================================
                      RIGHT
                  ================================================== */}
                  <View style={styles.accountRight}>

                    <Text
                      numberOfLines={1}
                      style={[
                        styles.accountBalance,
                        {
                          color: isNegative
                            ? '#D95D5D'
                            : '#2F9B6D',
                        },
                      ]}
                    >
                      {balanceVisible
                        ? `₹${formatAmount(itemBalance)}`
                        : '••••••'}
                    </Text>

                    <View style={styles.balanceCaptionRow}>
                      <Text style={styles.balanceCaption}>
                        BALANCE
                      </Text>

                      <MaterialCommunityIcons
                        name={
                          isNegative
                            ? 'arrow-down'
                            : 'arrow-up'
                        }
                        size={12}
                        color={
                          isNegative
                            ? '#D95D5D'
                            : '#2F9B6D'
                        }
                      />
                    </View>

                  </View>

                </View>

                {/* =================================================
                    ACTION BAR
                ================================================== */}
                <View style={styles.accountBottom}>

                  <View style={styles.initialBalanceInfo}>
                    <MaterialCommunityIcons
                      name="bank-outline"
                      size={14}
                      color="#9AA5B1"
                    />

                    <Text style={styles.initialBalanceText}>
                      Initial ₹
                      {formatAmount(
                        item.initial_balance || 0
                      )}
                    </Text>
                  </View>

                  <View style={styles.actionRow}>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        setEditSource(item);
                        setShowModal(true);
                      }}
                      style={styles.actionButton}
                    >
                      <Feather
                        name="edit-2"
                        size={15}
                        color={Colors.primary}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        setConfirmTargetId(item.id);
                        setConfirmVisible(true);
                      }}
                      style={[
                        styles.actionButton,
                        styles.deleteActionButton,
                      ]}
                    >
                      <Feather
                        name="trash-2"
                        size={15}
                        color="#E46A6A"
                      />
                    </TouchableOpacity>

                    <View style={styles.arrowContainer}>
                      <Feather
                        name="chevron-right"
                        size={17}
                        color="#B5BEC8"
                      />
                    </View>

                  </View>

                </View>

              </TouchableOpacity>

            </Card>
          );
        }}
      />

      {/* =====================================================
          DELETE CONFIRMATION
      ====================================================== */}
      <ConfirmDialog
        visible={confirmVisible}
        title="Delete Account"
        message="Are you sure?"
        onCancel={() => {
          setConfirmVisible(false);
          setConfirmTargetId(null);
        }}
        onConfirm={async () => {
          if (confirmTargetId) {
            await remove(confirmTargetId);
          }

          setConfirmVisible(false);
          setConfirmTargetId(null);
        }}
      />

      {/* =====================================================
          CREATE / EDIT MODAL
      ====================================================== */}
      <SourceCreateModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        editData={editSource}
        onSave={() => {
          setShowModal(false);
          load();
        }}
      />

      {/* =====================================================
          FAB
      ====================================================== */}
      <FAB
        onPress={() => {
          setEditSource(null);
          setShowModal(true);
        }}
      />

    </View>
  );
}

const styles = StyleSheet.create({

  /* ==========================================================
     CONTAINER
  ========================================================== */

  container: {
    flex: 1,
    backgroundColor: '#F7F9FB',
  },

  /* ==========================================================
     HEADER
  ========================================================== */

  headerSection: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  titleContainer: {
    flex: 1,
  },

  pageTitle: {
    fontSize: 23,
    fontWeight: '900',
    color: '#24313D',
    letterSpacing: -0.4,
  },

  pageSubtitle: {
    fontSize: 12,
    color: '#8A96A3',
    marginTop: 3,
  },

  totalBadge: {
    minWidth: 68,
    height: 50,
    borderRadius: 15,
    backgroundColor: '#EAF5EF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },

  totalBadgeNumber: {
    fontSize: 19,
    fontWeight: '900',
    color: '#3F8F6B',
    lineHeight: 21,
  },

  totalBadgeLabel: {
    fontSize: 7,
    fontWeight: '800',
    color: '#6DA68A',
    letterSpacing: 0.7,
    marginTop: 2,
  },

  /* ==========================================================
     STATS
  ========================================================== */

  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },

  statCard: {
    flex: 1,
    minHeight: 60,
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },

  activeStat: {
    backgroundColor: '#F0F5FF',
  },

  negativeStat: {
    backgroundColor: '#FFF3F3',
  },

  statIconBlue: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#E0E9FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },

  statIconRed: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#FFE3E3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },

  statValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#263440',
  },

  statLabel: {
    fontSize: 10,
    color: '#8B97A3',
    marginTop: 1,
    fontWeight: '600',
  },

  /* ==========================================================
     SEARCH
  ========================================================== */

  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },

  searchBar: {
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    elevation: 0,
    borderWidth: 1,
    borderColor: '#E7EBEF',
  },

  searchInput: {
    fontSize: 13,
    color: '#354250',
  },

  /* ==========================================================
     LIST
  ========================================================== */

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 110,
  },

  emptyListContent: {
    flexGrow: 1,
  },

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    marginBottom: 9,
    paddingHorizontal: 2,
  },

  listTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#42515E',
  },

  listCount: {
    marginLeft: 7,
    minWidth: 22,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: '#E9EDF1',
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 10,
    fontWeight: '800',
    color: '#778491',
  },

  /* ==========================================================
     ACCOUNT CARD
  ========================================================== */

  accountCard: {
    marginBottom: 9,
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderRadius: 17,
    overflow: 'hidden',
  },

  accountRow: {
    minHeight: 79,
    paddingHorizontal: 13,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  accountLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },

  accountIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  accountInfo: {
    flex: 1,
    minWidth: 0,
  },

  accountName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#293743',
  },

  accountMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },

  accountMetaText: {
    fontSize: 11,
    color: '#8A96A2',
    fontWeight: '600',
  },

  accountRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
    maxWidth: '45%',
  },

  accountBalance: {
    fontSize: 15,
    fontWeight: '900',
  },

  balanceCaptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },

  balanceCaption: {
    fontSize: 7,
    fontWeight: '900',
    color: '#A0A9B2',
    letterSpacing: 0.7,
    marginRight: 3,
  },

  /* ==========================================================
     BOTTOM BAR
  ========================================================== */

  accountBottom: {
    minHeight: 39,
    paddingHorizontal: 13,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  initialBalanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  initialBalanceText: {
    fontSize: 10,
    color: '#9AA5B1',
    fontWeight: '600',
    marginLeft: 5,
  },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  actionButton: {
    width: 27,
    height: 27,
    borderRadius: 9,
    backgroundColor: '#F0F5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 5,
  },

  deleteActionButton: {
    backgroundColor: '#FFF1F1',
  },

  arrowContainer: {
    width: 25,
    height: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },

  /* ==========================================================
     EMPTY STATE
  ========================================================== */

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingTop: 65,
  },

  emptyIconContainer: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: '#EDF1F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#465461',
  },

  emptySubtitle: {
    fontSize: 12,
    color: '#9AA5AF',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});