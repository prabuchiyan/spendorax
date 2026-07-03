import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { getTransactions, deleteTransaction } from '../services/transactions';
import { getCategories } from '../services/categories';
import { getSources } from '../services/sources';
import ConfirmDialog from '../components/ConfirmDialog';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Avatar, Searchbar } from 'react-native-paper';
import Card from '../components/Card';
import { Colors, Spacing } from '../components/Theme';
import { Feather } from '@expo/vector-icons';
import FAB from '../components/FAB';
import { useFocusEffect } from '@react-navigation/native';

export default function TransactionsScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sources, setSources] = useState([]);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('Are you sure you want to delete this transaction?');
  const [searchQuery, setSearchQuery] = useState('');

  async function load() {
    const t = await getTransactions(1000000, 'Yes');
    setItems(t);
    const cats = await getCategories(true);
    setCategories(cats);
    const src = await getSources(true);
    setSources(src);
  }

  useEffect(() => { load(); }, []);

  // AUTO REFRESH AFTER EDIT / NAVIGATION
  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  // ✅ EDIT HANDLER (NAVIGATION BASED)
  const handleEdit = (item) => {
    navigation.navigate('TransactionAdd', {
      isEdit: true,
      transaction: item
    });
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(item =>
      (item.notes || '').toLowerCase().includes(q) ||
      String(item.amount).includes(q)
    );
  }, [items, searchQuery]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: Spacing.m, paddingBottom: 0 }}>
        <Searchbar
          placeholder="Search transactions..."
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
            <Text style={{ color: Colors.muted, marginTop: 12 }}>No transactions found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: Spacing.s }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>

              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                {(() => {
                  const cat = categories.find(x => x.id === item.category_id);
                  return (
                    <Avatar.Icon
                      size={40}
                      icon={cat?.icon || 'currency-usd'}
                      style={{ backgroundColor: (cat?.color || '#eee') + '15', marginRight: 12 }}
                      color={cat?.color || '#999'}
                    />
                  );
                })()}

                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontWeight: '700', fontSize: 15, color: Colors.text }}>
                    {item.notes || 'No notes'}
                  </Text>

                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Text style={{ color: Colors.muted, fontSize: 12 }}>
                      {categories.find(x => x.id === item.category_id)?.name || 'Uncategorized'}
                    </Text>
                    <Text style={{ color: '#ccc', marginHorizontal: 4 }}>•</Text>
                    <Text style={{ color: Colors.muted, fontSize: 12 }}>
                      {sources.find(x => x.id === item.source_id)?.name || 'No source'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                <Text style={{
                  fontWeight: '800',
                  fontSize: 16,
                  color: item.type === 'expense' ? '#E46A6A' : '#36B37E'
                }}>
                  {item.type === 'expense' ? '-' : '+'}₹{Number(item.amount).toFixed(2)}
                </Text>

                <Text style={{ color: Colors.muted, fontSize: 10, marginTop: 2 }}>
                  {new Date(item.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                </Text>

                <View style={{ flexDirection: 'row', marginTop: 8 }}>
                  <TouchableOpacity
                    onPress={() => handleEdit(item)}
                    style={{ marginRight: 10 }}
                  >
                    <Feather name="edit-2" size={16} color={Colors.primary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setConfirmTargetId(item.id);
                      setConfirmMessage(`Delete transaction ${item.type} ${Number(item.amount).toFixed(2)}?`);
                      setConfirmVisible(true);
                    }}
                  >
                    <Feather name="trash-2" size={16} color="#E46A6A" />
                  </TouchableOpacity>
                </View>
              </View>

            </View>
          </Card>
        )}
      />

      <FAB onPress={() => navigation.navigate('TransactionAdd')} />

      <ConfirmDialog
        visible={confirmVisible}
        title="Delete Transaction"
        message={confirmMessage}
        onCancel={() => {
          setConfirmVisible(false);
          setConfirmTargetId(null);
        }}
        onConfirm={async () => {
          if (confirmTargetId) {
            await deleteTransaction(confirmTargetId);
          }
          setConfirmVisible(false);
          setConfirmTargetId(null);
          load();
        }}
      />
    </View>
  );
}