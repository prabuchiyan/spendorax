import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Text,
  TextInput,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getLoans } from '../services/loans';
import LoanCard from '../components/LoanCard';
import { Colors } from '../components/Theme';

export default function LoanListScreen({ navigation }) {
  const [loans, setLoans] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [directionFilter, setDirectionFilter] = useState('ALL');

  async function load() {
    const data = await getLoans();
    setLoans(data);
  }

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation]);

  const stats = useMemo(() => {
    return {
      total: loans.length,
      active: loans.filter(l => (l.status || 'Active') === 'Active').length,
      closed: loans.filter(l => l.status === 'Closed').length,
    };
  }, [loans]);

  const filtered = useMemo(() => {
    return [...loans]
      .filter(l => {
        const matchesSearch =
          (l.loan_name || '')
            .toLowerCase()
            .includes(search.toLowerCase());

        const matchesFilter =
          filter === 'ALL'
            ? true
            : (l.status || 'Active') === filter;

        const matchesDirection =
          directionFilter === 'ALL'
            ? true
            : (l.loan_direction || 'BORROWED') === directionFilter;

        return matchesSearch && matchesFilter && matchesDirection;
      })
      .sort((a, b) => {
        // Active first
        if ((a.status || 'Active') !== (b.status || 'Active')) {
          return (a.status || 'Active') === 'Active' ? -1 : 1;
        }

        // Oldest loan first
        return new Date(a.loan_start_date || 0) - new Date(b.loan_start_date || 0);
      });
  }, [loans, search, filter, directionFilter]);

  const Chip = ({ title, value }) => (
    <View
      style={{
        flex: 1,
        backgroundColor: '#fff',
        padding: 14,
        borderRadius: 16,
        marginHorizontal: 4,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          fontSize: 22,
          fontWeight: '900',
          color: Colors.primary,
        }}
      >
        {value}
      </Text>

      <Text
        style={{
          marginTop: 4,
          color: Colors.muted,
        }}
      >
        {title}
      </Text>
    </View>
  );

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: Colors.background,
      }}
    >
      <FlatList
        data={filtered}
        keyExtractor={(i) => String(i.id)}
        ListHeaderComponent={
          <>
            {/* Summary */}

            <View
              style={{
                flexDirection: 'row',
                marginBottom: 16,
              }}
            >
              <Chip title="Total" value={stats.total} />
              <Chip title="Active" value={stats.active} />
              <Chip title="Closed" value={stats.closed} />
            </View>

            {/* Search */}

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#fff',
                borderRadius: 16,
                paddingHorizontal: 14,
                marginBottom: 16,
              }}
            >
              <MaterialCommunityIcons
                name="magnify"
                size={20}
                color={Colors.muted}
              />

              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search loans..."
                style={{
                  flex: 1,
                  height: 46,
                  marginLeft: 10,
                }}
              />
            </View>

            {/* Filter */}

            <View
              style={{
                flexDirection: 'row',
                marginBottom: 18,
              }}
            >
              {['ALL', 'Active', 'Closed'].map(f => (
                <TouchableOpacity
                  key={f}
                  onPress={() => setFilter(f)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor:
                      filter === f
                        ? Colors.primary
                        : '#E5E7EB',
                    marginRight: 10,
                  }}
                >
                  <Text
                    style={{
                      color:
                        filter === f
                          ? '#fff'
                          : '#374151',
                      fontWeight: '700',
                    }}
                  >
                    {f}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Direction Filter */}
            <View style={{ flexDirection: 'row', marginBottom: 18 }}>
              {['ALL', 'BORROWED', 'LENT'].map(d => (
                <TouchableOpacity key={d} onPress={() => setDirectionFilter(d)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: directionFilter === d ? Colors.primary : '#E5E7EB', marginRight: 10 }}>
                  <Text style={{ color: directionFilter === d ? '#fff' : '#374151', fontWeight: '700' }}>{d === 'ALL' ? 'All' : (d === 'BORROWED' ? 'Borrowed' : 'Lent')}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() =>
              navigation.navigate('LoanDetails', {
                id: item.id,
              })
            }
          >
            <LoanCard loan={item} />
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => (
          <View style={{ height: 12 }} />
        )}
        ListEmptyComponent={
          <View
            style={{
              alignItems: 'center',
              marginTop: 80,
            }}
          >
            <MaterialCommunityIcons
              name="bank-off-outline"
              size={60}
              color="#CBD5E1"
            />

            <Text
              style={{
                marginTop: 16,
                fontSize: 18,
                fontWeight: '700',
              }}
            >
              No loans found
            </Text>

            <Text
              style={{
                color: Colors.muted,
                marginTop: 6,
              }}
            >
              Add a loan to start tracking.
            </Text>
          </View>
        }
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 120,
        }}
      />
    </View>
  );
}