import React, { useEffect, useState } from 'react';
import { View, FlatList, TouchableOpacity } from 'react-native';
import { getLoans } from '../services/loans';
import LoanCard from '../components/LoanCard';
import { Colors } from '../components/Theme';

export default function LoanListScreen({ navigation }) {
  const [loans, setLoans] = useState([]);

  async function load() {
    const data = await getLoans();
    setLoans(data);
  }

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <FlatList
        data={loans}
        keyExtractor={(i) => String(i.id)}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('LoanDetails', { id: item.id })}>
            <LoanCard loan={item} />
          </TouchableOpacity>
        )}
        contentContainerStyle={{ padding: 12, paddingBottom: 120 }}
      />
    </View>
  );
}
