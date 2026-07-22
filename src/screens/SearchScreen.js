import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { getTransactions } from '../services/transactions';
import { getCategories } from '../services/categories';
import { getSources } from '../services/sources';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Avatar, Searchbar } from 'react-native-paper';
import Card from '../components/Card';
import { Colors, Spacing } from '../components/Theme';
import { useFocusEffect } from '@react-navigation/native';

export default function SearchScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sources, setSources] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  async function load() {
    const cats = await getCategories(true);
    setCategories(cats);

    const src = await getSources(true);
    setSources(src);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const search = async () => {
      const q = searchQuery.trim();

      if (q.length < 3) {
        setItems([]);
        return;
      }

      const transactions = await getTransactions(1000000, 'Yes');

      const filtered = transactions.filter(item =>
        (item.notes || '').toLowerCase().includes(q.toLowerCase()) ||
        String(item.amount).includes(q)
      );

      setItems(filtered);
    };

    search();
  }, [searchQuery]);

  // AUTO REFRESH AFTER EDIT / NAVIGATION
  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  // EDIT HANDLER (NAVIGATION BASED)
  const handleEdit = (item) => {
    navigation.navigate('TransactionAdd', {
      isEdit: true,
      transaction: item
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: Spacing.s, paddingBottom: 0 }}>
        <Searchbar
          placeholder="Search transactions..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={{ elevation: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee' }}
          inputStyle={{ fontSize: 14 }}
        />
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={{
          padding: Spacing.s,
          paddingBottom: 80,
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
            <MaterialCommunityIcons
              name={searchQuery.length < 3 ? 'magnify' : 'clipboard-text-outline'}
              size={48}
              color="#ccc"
            />

            <Text style={{ color: Colors.muted, marginTop: 12 }}>
              {searchQuery.length < 3
                ? 'Type at least 3 characters to search'
                : 'No transactions found'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => handleEdit(item)}
          >
            <Card style={{ marginBottom: Spacing.s }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>

                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  {(() => {
                    const cat = categories.find(x => x.id === item.category_id);
                    return (
                      <Avatar.Icon
                        size={40}
                        icon={cat?.icon || 'currency-inr'}
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
                    ₹{Number(item.amount).toFixed(2)}
                  </Text>

                  <Text style={{ color: Colors.muted, fontSize: 10, marginTop: 2 }}>
                    {new Date(item.date).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                  </Text>

                </View>

              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}