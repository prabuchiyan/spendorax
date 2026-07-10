import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { getLoans } from '../services/loans';
import LoanCard from '../components/LoanCard';
import FAB from '../components/FAB';
import Card from '../components/Card';
import { Colors } from '../components/Theme';

export default function LoanDashboardScreen({ navigation }) {
  const [loans, setLoans] = useState([]);

  async function load() {
    const data = await getLoans();
    setLoans(data);
  }

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', () => load());
    return unsub;
  }, [navigation]);

  function renderItem({ item }) {
    return (
      <TouchableOpacity onPress={() => navigation.navigate('LoanDetails', { id: item.id })}>
        <LoanCard loan={item} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <FlatList
        data={loans}
        keyExtractor={(i) => String(i.id)}
        renderItem={renderItem}
        ListEmptyComponent={() => (
          <Card>
            <Text style={{ fontWeight: '700', textAlign: 'center' }}>No loans yet</Text>
            <Text style={{ color: '#666', textAlign: 'center', marginTop: 8 }}>Tap + to add a loan</Text>
          </Card>
        )}
        contentContainerStyle={{ padding: 12, paddingBottom: 120 }}
      />

      <FAB onPress={() => navigation.navigate('LoanForm')} />
    </View>
  );
}
