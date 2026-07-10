import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, SectionList, TouchableOpacity, TextInput } from 'react-native';
import { getLoanPayments } from '../services/loans';
import Card from '../components/Card';
import { Colors } from '../components/Theme';

function formatMonthKey(dateStr) {
  try {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch (e) { return 'unknown'; }
}

export default function LoanHistoryScreen({ route }) {
  const loanId = route?.params?.id;
  const [payments, setPayments] = useState([]);
  const [query, setQuery] = useState('');

  const pageSize = 30;
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!loanId) return;
      const p = await getLoanPayments(loanId, pageSize, 0);
      if (mounted) setPayments(p);
    })();
    return () => { mounted = false; };
  }, [loanId]);

  async function loadMore() {
    if (!loanId) return;
    const next = await getLoanPayments(loanId, pageSize, payments.length);
    if (next && next.length) setPayments(prev => prev.concat(next));
  }

  const filtered = useMemo(() => {
    if (!query) return payments;
    const q = query.toLowerCase();
    return payments.filter(p => (p.payment_type || '').toLowerCase().includes(q) || (p.remarks || '').toLowerCase().includes(q));
  }, [payments, query]);

  const sections = useMemo(() => {
    const map = {};
    filtered.forEach(p => {
      const key = formatMonthKey(p.payment_date);
      map[key] = map[key] || [];
      map[key].push(p);
    });
    return Object.keys(map).sort((a,b) => b.localeCompare(a)).map(k => ({ title: k, data: map[k] }));
  }, [filtered]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background, padding: 12 }}>
      <Card>
        <TextInput placeholder="Search by type or notes" value={query} onChangeText={setQuery} style={{ borderBottomWidth: 1, borderColor: '#eee', padding: 8 }} />
      </Card>

      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={{ fontWeight: '700', marginTop: 12 }}>{title}</Text>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity>
            <Card>
              <Text style={{ fontWeight: '700' }}>{item.payment_type} — ₹{Number(item.payment_amount || 0).toLocaleString('en-IN')}</Text>
              <Text style={{ color: '#666', marginTop: 6 }}>{item.payment_date} • Principal ₹{Number(item.principal_component||0)} • Interest ₹{Number(item.interest_component||0)}</Text>
              {item.remarks ? <Text style={{ marginTop: 6, color: '#444' }}>{item.remarks}</Text> : null}
            </Card>
          </TouchableOpacity>
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        contentContainerStyle={{ paddingBottom: 120 }}
      />
    </View>
  );
}
