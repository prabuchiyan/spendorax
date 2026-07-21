import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { getLoanPayments } from '../services/loans';
import Card from '../components/Card';
import { Colors } from '../components/Theme';

const PAGE_SIZE = 30;

function formatMonth(date) {
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getPaymentStyle(type = '') {
  switch (type.toUpperCase()) {
    case 'PREPAYMENT':
      return { icon: 'cash-fast', color: '#F97316', bg: '#FFF7ED' };
    case 'FORECLOSURE':
      return { icon: 'bank-remove', color: '#DC2626', bg: '#FEF2F2' };
    case 'ADVANCE':
      return { icon: 'hand-coin-outline', color: '#7C3AED', bg: '#EDE9FE' };
    case 'EMI':
    case 'PAYMENT':
    default:
      return { icon: 'cash-check', color: '#16A34A', bg: '#ECFDF5' };
  }
}

export default function LoanHistoryScreen({ route }) {
  const loanId = route?.params?.id;
  const [payments, setPayments] = useState([]);
  const [query, setQuery] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!loanId) return;
      const rows = await getLoanPayments(
        loanId,
        PAGE_SIZE,
        0
      );

      if (mounted) {
        setPayments(rows || []);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [loanId]);

  async function loadMore() {
    if (!loanId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const rows = await getLoanPayments(
        loanId,
        PAGE_SIZE,
        payments.length
      );
      if (!rows || rows.length === 0) {
        setHasMore(false);
        return;
      }
      setPayments(prev => {
        const map = new Map();
        [...prev, ...rows].forEach(item => {
          map.set(item.id, item);
        });
        return [...map.values()];
      });
      if (rows.length < PAGE_SIZE) {
        setHasMore(false);
      }
    } finally {
      setLoadingMore(false);
    }
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return payments;
    const q = query.toLowerCase();
    return payments.filter((item) => {
      return (
        (item.payment_type || '')
          .toLowerCase()
          .includes(q) ||
        (item.remarks || '')
          .toLowerCase()
          .includes(q)
      );
    });
  }, [payments, query]);

  const totalPaid = useMemo(() => {
    return filtered.reduce(
      (sum, item) =>
        sum + Number(item.payment_amount || 0),
      0
    );
  }, [filtered]);

  const principalPaid = useMemo(() => {
    return filtered.reduce(
      (sum, item) =>
        sum +
        Number(item.principal_component || 0),
      0
    );
  }, [filtered]);

  const interestPaid = useMemo(() => {
    return filtered.reduce(
      (sum, item) =>
        sum +
        Number(item.interest_component || 0),
      0
    );
  }, [filtered]);

  const sections = useMemo(() => {
    const grouped = {};
    filtered.forEach((item) => {
      const key = formatMonth(item.payment_date);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });
    return Object.keys(grouped)
      .sort((a, b) => new Date(b) - new Date(a))
      .map((month) => ({
        title: month,
        total: grouped[month].reduce(
          (s, p) =>
            s +
            Number(p.payment_amount || 0),
          0
        ),
        data: grouped[month].sort(
          (a, b) =>
            new Date(b.payment_date) -
            new Date(a.payment_date)
        ),
      }));
  }, [filtered]);

  return (
    <View style={styles.container}>

      {/* Summary */}

      <Card style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <MaterialCommunityIcons
            name="history"
            size={26}
            color="#2563EB"
          />

          <View style={{ marginLeft: 12 }}>
            <Text style={styles.summaryTitle}>
              Loan Payment History
            </Text>

            <Text style={styles.summarySubtitle}>
              {filtered.length} Transactions
            </Text>
          </View>
        </View>

        <View style={styles.summaryStats}>

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>
              Total Paid
            </Text>

            <Text style={styles.statValue}>
              ₹{totalPaid.toLocaleString('en-IN')}
            </Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>
              Principal
            </Text>

            <Text style={styles.greenText}>
              ₹{principalPaid.toLocaleString('en-IN')}
            </Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statLabel}>
              Interest
            </Text>

            <Text style={styles.orangeText}>
              ₹{interestPaid.toLocaleString('en-IN')}
            </Text>
          </View>

        </View>
      </Card>

      {/* Search */}

      <View style={styles.searchContainer}>

        <View style={styles.searchBox}>

          <MaterialCommunityIcons
            name="magnify"
            size={22}
            color="#64748B"
          />

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search payment type, remarks..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
            selectionColor={Colors.primary}
            underlineColorAndroid="transparent"
            cursorColor={Colors.primary}
            autoCorrect={false}
            autoCapitalize="none"
          />

          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery('')}
              hitSlop={10}
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={20}
                color="#94A3B8"
              />
            </TouchableOpacity>
          )}

        </View>

      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 120,
        }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.05}
        renderSectionHeader={({ section }) => (
          <View style={styles.monthHeader}>
            <View>
              <Text style={styles.monthTitle}>
                {section.title}
              </Text>

              <Text style={styles.monthSubtitle}>
                {section.data.length} Payments • ₹
                {section.total.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        )}

        renderItem={({ item }) => {
          const payment = getPaymentStyle(
            item.payment_type
          );

          return (
            <TouchableOpacity
              activeOpacity={0.9}
            >
              <View style={styles.timelineRow}>

                <View style={styles.timeline}>

                  <View
                    style={[
                      styles.timelineIcon,
                      {
                        backgroundColor:
                          payment.bg,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={payment.icon}
                      size={20}
                      color={payment.color}
                    />
                  </View>

                  <View
                    style={styles.timelineLine}
                  />

                </View>

                <Card style={styles.paymentCard}>

                  <View style={styles.paymentHeader}>

                    <View
                      style={{
                        flex: 1,
                      }}
                    >
                      <Text style={styles.paymentTitle}>
                        {item.payment_type === 'ADVANCE'
                          ? 'Additional Lending'
                          : item.payment_type === 'PREPAYMENT'
                            ? 'Prepayment'
                            : item.payment_type === 'FORECLOSURE'
                              ? 'Loan Closed'
                              : item.payment_type === 'EMI'
                                ? 'EMI Payment'
                                : item.payment_type || 'Payment'}
                      </Text>

                      <Text
                        style={
                          styles.paymentDate
                        }
                      >
                        {formatDate(
                          item.payment_date
                        )}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.amount,
                        {
                          color:
                            payment.color,
                        },
                      ]}
                    >
                      ₹
                      {Number(
                        item.payment_amount ||
                        0
                      ).toLocaleString(
                        'en-IN'
                      )}
                    </Text>

                  </View>

                  <View
                    style={styles.chipsRow}
                  >

                    <View
                      style={[
                        styles.chip,
                        {
                          backgroundColor:
                            '#DCFCE7',
                        },
                      ]}
                    >
                      <Text
                        style={
                          styles.chipText
                        }
                      >
                        Principal ₹
                        {Number(
                          item.principal_component ||
                          0
                        ).toLocaleString(
                          'en-IN'
                        )}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.chip,
                        {
                          backgroundColor:
                            '#FFEDD5',
                        },
                      ]}
                    >
                      <Text
                        style={
                          styles.chipText
                        }
                      >
                        Interest ₹
                        {Number(
                          item.interest_component ||
                          0
                        ).toLocaleString(
                          'en-IN'
                        )}
                      </Text>
                    </View>

                  </View>

                  {!!item.remarks && (
                    <View
                      style={
                        styles.notesBox
                      }
                    >
                      <MaterialCommunityIcons
                        name="note-text-outline"
                        size={18}
                        color="#64748B"
                      />

                      <Text
                        style={
                          styles.notes
                        }
                      >
                        {item.remarks}
                      </Text>
                    </View>
                  )}

                </Card>

              </View>
            </TouchableOpacity>
          );
        }}

        ListEmptyComponent={() => (
          <View
            style={styles.emptyContainer}
          >
            <MaterialCommunityIcons
              name="history"
              size={70}
              color="#CBD5E1"
            />

            <Text
              style={styles.emptyTitle}
            >
              No Payment History
            </Text>

            <Text
              style={styles.emptySubtitle}
            >
              Payments recorded for this
              loan will appear here.
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F6FB',
    padding: 16,
  },

  summaryCard: {
    borderRadius: 22,
    marginBottom: 16,
  },

  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },

  summaryTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },

  summarySubtitle: {
    color: '#64748B',
    marginTop: 4,
  },

  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  statBox: {
    alignItems: 'center',
    flex: 1,
  },

  statLabel: {
    color: '#64748B',
    fontSize: 12,
  },

  statValue: {
    marginTop: 6,
    fontWeight: '800',
    fontSize: 17,
    color: '#2563EB',
  },

  greenText: {
    marginTop: 6,
    fontWeight: '800',
    fontSize: 17,
    color: '#16A34A',
  },

  orangeText: {
    marginTop: 6,
    fontWeight: '800',
    fontSize: 17,
    color: '#EA580C',
  },

  searchContainer: {
    marginBottom: 18,
  },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
  },

  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 0,

    // Remove Android/Web focus outline
    outlineStyle: 'none',
    borderWidth: 0,
  },

  monthHeader: {
    marginTop: 18,
    marginBottom: 10,
  },

  monthTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },

  monthSubtitle: {
    marginTop: 4,
    color: '#64748B',
    fontSize: 13,
  },

  timelineRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },

  timeline: {
    width: 42,
    alignItems: 'center',
  },

  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E2E8F0',
    marginTop: 4,
  },

  paymentCard: {
    flex: 1,
    borderRadius: 20,
  },

  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  paymentTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },

  paymentDate: {
    marginTop: 4,
    color: '#64748B',
  },

  amount: {
    fontSize: 20,
    fontWeight: '900',
  },

  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
  },

  chip: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 10,
    marginBottom: 8,
  },

  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },

  notesBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
  },

  notes: {
    flex: 1,
    marginLeft: 8,
    color: '#475569',
    lineHeight: 20,
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 90,
  },

  emptyTitle: {
    marginTop: 18,
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },

  emptySubtitle: {
    marginTop: 8,
    textAlign: 'center',
    color: '#64748B',
    lineHeight: 22,
  },
});