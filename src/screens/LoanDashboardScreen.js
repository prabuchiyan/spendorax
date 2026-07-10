import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { getLoans, getLoanPayments } from '../services/loans';
import events from '../services/events';
import FAB from '../components/FAB';
import Card from '../components/Card';
import { Colors, Spacing } from '../components/Theme';
import LoanSummaryCard from '../components/LoanSummaryCard';
import LoanHealthCard from '../components/LoanHealthCard';
import LoanQuickActions from '../components/LoanQuickActions';
import UpcomingEMICard from '../components/UpcomingEMICard';
import ActiveLoanCard from '../components/ActiveLoanCard';
import RecentActivityItem from '../components/RecentActivityItem';

function computeNextEmiDate(loan) {
  try {
    const today = new Date();
    const day = Number(loan.emi_day) || (loan.loan_start_date ? new Date(loan.loan_start_date).getDate() : today.getDate());
    const candidate = new Date(today.getFullYear(), today.getMonth(), day);
    if (candidate < today) {
      candidate.setMonth(candidate.getMonth() + 1);
    }
    return candidate.toISOString();
  } catch (e) { return null; }
}

export default function LoanDashboardScreen({ navigation }) {
  const [loans, setLoans] = useState([]);
  const [payments, setPayments] = useState([]);

  const load = useCallback(async () => {
    const data = await getLoans();
    // derive UI fields without changing services
    const enriched = data.map(l => ({ ...l, nextEmiDate: computeNextEmiDate(l), isOverdue: l.outstanding_amount > 0 && (l.loan_end_date && new Date(l.loan_end_date) < new Date()) }));
    setLoans(enriched);

    // recent payments (last 6)
    let recent = [];
    for (const ln of data) {
      const p = await getLoanPayments(ln.id, 6, 0);
      recent = recent.concat(p.map(x => ({ ...x, loan_name: ln.loan_name })));
    }
    recent.sort((a,b) => new Date(b.payment_date) - new Date(a.payment_date));
    setPayments(recent.slice(0, 6));
  }, []);

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', load);
    const off1 = events.on('loansChanged', load);
    const off2 = events.on('loanPaymentsChanged', load);
    return () => { unsub(); off1(); off2(); };
  }, [navigation, load]);

  const summary = useMemo(() => {
    const totalOutstanding = loans.reduce((s, l) => s + Number(l.outstanding_amount || 0), 0);
    const totalEMI = loans.reduce((s, l) => s + Number(l.emi_amount || 0), 0);
    const principalPaid = loans.reduce((s, l) => s + Number(l.principal_paid || 0), 0);
    const interestPaid = loans.reduce((s, l) => s + Number(l.interest_paid || 0), 0);
    return { totalOutstanding, totalEMI, principalPaid, interestPaid };
  }, [loans]);

  const health = useMemo(() => {
    const active = loans.filter(l => (l.status||'Active') === 'Active').length;
    const closed = loans.filter(l => (l.status||'') === 'Closed').length;
    const overdue = loans.filter(l => l.isOverdue).length;
    // percent paid across loans
    const paid = loans.reduce((s, l) => s + (Number(l.principal_paid||0) + Number(l.interest_paid||0)), 0);
    const total = loans.reduce((s, l) => s + (Number(l.principal_paid||0) + Number(l.interest_paid||0) + Number(l.outstanding_amount||0)), 0);
    const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
    return { pct, active, closed, overdue };
  }, [loans]);

  const upcoming = useMemo(() => {
    const arr = loans.filter(l => l.outstanding_amount > 0).map(l => ({ ...l, nextDate: new Date(l.nextEmiDate) }));
    arr.sort((a,b) => a.nextDate - b.nextDate);
    return arr.slice(0,5);
  }, [loans]);

  const activeLoans = useMemo(() => loans.filter(l => l.outstanding_amount > 0), [loans]);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* Greeting */}
        <Text style={{ fontSize: 20, fontWeight: '900', marginBottom: 8 }}>Your Loans</Text>

        {/* Portfolio Summary */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
          <LoanSummaryCard title="Outstanding" amount={summary.totalOutstanding} icon="bank" />
          <LoanSummaryCard title="Monthly EMI" amount={summary.totalEMI} icon="calendar-month" />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
          <LoanSummaryCard title="Principal Paid" amount={summary.principalPaid} icon="currency-inr" />
          <LoanSummaryCard title="Interest Paid" amount={summary.interestPaid} icon="percent" />
        </View>

        {/* Loan Health */}
        <LoanHealthCard percent={health.pct} active={health.active} closed={health.closed} overdue={health.overdue} />

        {/* Quick Actions */}
        <View style={{ marginTop: 20 }}>
          <LoanQuickActions
            onAdd={() => navigation.navigate('LoanForm')}
            onPay={() => navigation.navigate('LoanPayment')}
            onPrepay={() => navigation.navigate('LoanForm', { mode: 'prepayment' })}
            onAll={() => navigation.navigate('Loans')}
          />
        </View>

        {/* Upcoming EMI */}
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontWeight: '800', marginBottom: 12 }}>Upcoming EMI</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {upcoming.length === 0 ? (
              <Card style={{ padding: 16 }}><Text style={{ color: Colors.muted }}>No upcoming EMIs</Text></Card>
            ) : upcoming.map(l => <UpcomingEMICard key={l.id} loan={l} />)}
          </ScrollView>
        </View>

        {/* Active Loans */}
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontWeight: '800', marginBottom: 12 }}>Active Loans</Text>
          <FlatList
            data={activeLoans}
            keyExtractor={(i) => String(i.id)}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => navigation.navigate('LoanDetails', { id: item.id })}>
                <ActiveLoanCard loan={item} />
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            scrollEnabled={false}
          />
        </View>

        {/* Recent Activity */}
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontWeight: '800', marginBottom: 12 }}>Recent Activity</Text>
          {payments.length === 0 ? (
            <Card style={{ padding: 16 }}><Text style={{ color: Colors.muted }}>No recent activity</Text></Card>
          ) : payments.map(p => <RecentActivityItem key={p.id} item={p} />)}
        </View>
      </ScrollView>

      <FAB onPress={() => navigation.navigate('LoanForm')} />
    </View>
  );
}
