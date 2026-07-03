import React, { useEffect, useState, useLayoutEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { getTransactions, deleteTransaction } from '../services/transactions';
import { getCategories } from '../services/categories';
import { getSources } from '../services/sources';
import Card from '../components/Card';
import { Colors, Spacing } from '../components/Theme';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ConfirmDialog from '../components/ConfirmDialog';

export default function SourcesDetails({ route, navigation }) {
  const { sourceId, sourceName } = route.params;

  const [transactions, setTransactions] = useState([]);
  const [categoriesMap, setCategoriesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState(null);

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState(null);

  const flatListRef = useRef(null);
  const lastOffset = useRef(0);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: sourceName
    });
  }, [sourceName]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const [txData, catData] = await Promise.all([
        getTransactions(1000000, null, sourceId),
        getCategories(true)
      ]);

      const cmap = {};
      catData.forEach(c => { cmap[c.id] = c; });

      setCategoriesMap(cmap);
      setTransactions(txData);

      requestAnimationFrame(() => {
        flatListRef.current?.scrollToOffset({
          offset: lastOffset.current,
          animated: false,
        });
      });
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  async function load() {
    await loadTransactions();

    if (sourceId) {
      const src = await getSources(true);
      setSource(src.find((s) => s.id === sourceId) || null);
    }
  }

  useEffect(() => { load(); }, []);

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [])
  );

  // ✅ FIXED DELETE HANDLER
  const handleDeleteConfirm = async () => {
    if (!confirmTargetId) return;

    try {
      await deleteTransaction(confirmTargetId);
      await loadTransactions(); // refresh list
    } catch (e) {
      console.error('Delete failed', e);
    } finally {
      setConfirmVisible(false);
      setConfirmTargetId(null);
    }
  };

  const handleEdit = (item) => {
    navigation.navigate('TransactionAdd', {
      isEdit: true,
      transaction: item
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No date';
    const d = new Date(dateString);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // ✅ BALANCE CALCULATION
  const totalBalance =
    Number(source?.initial_balance || 0) +
    transactions.reduce((sum, tx) => {
      const amount = Number(tx.amount) || 0;
      const type = (tx.type || '').toLowerCase();

      if (type === 'expense' || type === 'debit') return sum - amount;
      return sum + amount;
    }, 0);

  const renderItem = ({ item }) => {
    const isExpense = item.type === 'expense';
    const category = categoriesMap[item.category_id] || {};

    return (
      <Card style={styles.txCard}>
        <View style={styles.txContent}>

          <View style={[styles.iconContainer, { backgroundColor: (category.color || '#eee') + '15' }]}>
            <MaterialCommunityIcons
              name={category.icon || 'currency-usd'}
              size={22}
              color={category.color || Colors.muted}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {item.notes || category.name || 'Untitled'}
            </Text>
            <Text style={styles.date}>{formatDate(item.date)}</Text>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[
              styles.amount,
              { color: isExpense ? '#e53935' : '#2e7d32' }
            ]}>
              {isExpense ? '-' : '+'} ₹{Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </Text>

            <View style={styles.actions}>
              <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionBtn}>
                <Feather name="edit-2" size={14} color={Colors.primary} />
              </TouchableOpacity>

              {/* DELETE TRIGGER */}
              <TouchableOpacity
                onPress={() => {
                  setConfirmTargetId(item.id);
                  setConfirmVisible(true);
                }}
                style={styles.actionBtn}
              >
                <Feather name="trash-2" size={14} color="#d32f2f" />
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>

      {/* Balance */}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Available Balance</Text>
        <Text style={styles.heroAmount}>
          ₹{totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </Text>
      </View>

      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Recent Activity</Text>
      </View>

      {loading ? (
        <View style={styles.center}><Text>Loading...</Text></View>
      ) : transactions.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="clipboard-text-outline" size={48} color={Colors.muted} />
          <Text style={{ marginTop: 12, color: Colors.muted }}>No transactions found</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={transactions}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          onScroll={(e) => {
            lastOffset.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
        />
      )}

      {/* CONFIRM DIALOG */}
      <ConfirmDialog
        visible={confirmVisible}
        title="Delete Transaction"
        message="Are you sure you want to delete?"
        onCancel={() => {
          setConfirmVisible(false);
          setConfirmTargetId(null);
        }}
        onConfirm={handleDeleteConfirm}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.m,
  },
  hero: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    elevation: 2,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.muted,
    textTransform: 'uppercase',
  },
  heroAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 8,
  },
  headerRow: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  txCard: {
    marginBottom: 12,
    borderRadius: 16,
  },
  txContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  date: {
    fontSize: 12,
    color: Colors.muted,
    marginTop: 2,
  },
  amount: {
    fontSize: 16,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
  },
  actionBtn: {
    padding: 4,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: '#eee',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
});