import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { getSources, deleteSource } from '../services/sources';
import { getTransactions } from '../services/transactions';
import Card from '../components/Card';
import ConfirmDialog from '../components/ConfirmDialog';
import { Colors, Spacing } from '../components/Theme';
import SourceCreateModal from '../components/SourceCreateModal';
import { Searchbar, Avatar } from 'react-native-paper';
import FAB from '../components/FAB';

export default function SourcesScreen({ route, navigation }) {

  const [items, setItems] = useState([]);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editSource, setEditSource] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  async function load() {
    const sources = await getSources(true);
    const transactions = await getTransactions(1000000, 'Yes');

    const balanceMap = transactions.reduce((acc, txn) => {
      const amt = Number(txn.amount || 0);
      const sourceId = txn.source_id || txn.sourceId;
      if (!sourceId) return acc;
      if (!acc[sourceId]) acc[sourceId] = 0;
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
        balance
      };
    });
    setItems(updated);
  }

  useEffect(() => { load(); }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(item =>
      (item.name || '').toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  async function remove(id) {
    await deleteSource(id);
    load();
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: Spacing.m, paddingBottom: 0 }}>
        <Searchbar
          placeholder="Search source..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={{ elevation: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee' }}
          inputStyle={{ fontSize: 14 }}
        />
      </View>
      <FlatList
        data={filteredItems}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={{ padding: Spacing.m, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={48} color="#ccc" />
            <Text style={{ color: Colors.muted, marginTop: 12 }}>No sources found</Text>
          </View>
        }
        initialNumToRender={15}
        windowSize={10}
        renderItem={({ item }) => (


          <TouchableOpacity
            onPress={() => {
              const parent = navigation.getParent();
              parent?.navigate('SourcesDetails', {
                sourceId: item.id,
                sourceName: item.name
              });
            }}
          >
            <Card style={{ marginBottom: Spacing.s }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Avatar.Icon
                    size={40}
                    icon={item.icon || 'cash'}
                    style={{
                      backgroundColor: (item.color || Colors.primary) + '15',
                      marginRight: 12
                    }}
                    color={item.color || Colors.primary}
                  />

                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={{ fontWeight: '700', fontSize: 15, color: Colors.text }}
                    >
                      {item.name}
                    </Text>

                    <Text style={{ color: Colors.muted, fontSize: 12, marginTop: 2 }}>
                      Available balance
                    </Text>
                  </View>
                </View>

                <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                  <Text
                    style={{
                      fontWeight: '800',
                      fontSize: 16,
                      color: Number(item.balance || 0) < 0 ? '#E46A6A' : '#36B37E'
                    }}
                  >
                    ₹{Number(item.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>

                  <Text style={{ color: Colors.muted, fontSize: 10, marginTop: 2 }}>
                    Balance
                  </Text>

                  <View style={{ flexDirection: 'row', marginTop: 8 }}>
                    <TouchableOpacity
                      onPress={() => {
                        setEditSource(item);
                        setShowModal(true);
                      }}
                      style={{ marginRight: 10 }}
                    >
                      <Feather name="edit-2" size={16} color={Colors.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        setConfirmTargetId(item.id);
                        setConfirmVisible(true);
                      }}
                    >
                      <Feather name="trash-2" size={16} color="#E46A6A" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />

      <ConfirmDialog
        visible={confirmVisible}
        title="Delete Source"
        message="Are you sure?"
        onCancel={() => setConfirmVisible(false)}
        onConfirm={async () => {
          await remove(confirmTargetId);
          setConfirmVisible(false);
        }}
      />

      {/* Create/Edit Modal */}
      <SourceCreateModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        editData={editSource}
        onSave={() => {
          setShowModal(false);
          load();
        }}
      />

      <FAB onPress={() => { setEditSource(null); setShowModal(true); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  amount: {
    fontSize: 14,
    color: Colors.text,
    marginTop: 2,
    fontWeight: '600',
  },
  actionBtn: {
    padding: 8,
    marginLeft: 6,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4B7CF3',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
  },
});