import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, ScrollViewBase, ScrollViewComponent, Pressable } from 'react-native';
import Card from '../components/Card';
import { getLoans, getLoanPayments } from '../services/loans';
import scheduleService from '../services/loanSchedule';
import { Colors } from '../components/Theme';

function sum(arr, key) { return arr.reduce((s, x) => s + Number(x[key] || 0), 0); }

function monthKey(d) {
  const date = new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(key) {
  const [y, m] = key.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[Number(m) - 1] || m} '${String(y).slice(2)}`;
}

export default function LoanReportsScreen() {
  const [loans, setLoans] = useState([]);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    (async () => {
      const L = await getLoans();
      setLoans(L);
      // load recent payments for reports
      let all = [];
      for (const l of L) {
        const p = await getLoanPayments(l.id, 1000);
        all = all.concat(p);
      }
      setPayments(all);
    })();
  }, []);

  const summary = useMemo(() => {
    const totalOutstanding = sum(loans, 'outstanding_amount');
    const totalEMI = sum(loans, 'emi_amount');
    const activeLoans = loans.filter(l => (l.status || 'Active') === 'Active').length;
    const closedLoans = loans.filter(l => (l.status || '') === 'Closed').length;
    const totalInterestPaid = sum(loans, 'interest_paid');
    const totalPrepayments = sum(loans, 'total_prepayment');
    return { totalOutstanding, totalEMI, activeLoans, closedLoans, totalInterestPaid, totalPrepayments };
  }, [loans]);

  // Build monthly range from earliest loan start to current month
  const { labels, outstandingSeries, principalSeries, interestSeries } = useMemo(() => {
    if (!loans || loans.length === 0) return { labels: [], outstandingSeries: [], principalSeries: [], interestSeries: [] };

    const now = new Date();
    let minDate = now;
    for (const l of loans) {
      if (l.loan_start_date) {
        const d = new Date(l.loan_start_date);
        if (d < minDate) minDate = d;
      }
    }

    // start from loan start month or up to 12 months back if none
    const start = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const months = [];
    const labelsArr = [];
    const maxMonths = 36; // limit to 36 months for performance
    let cursor = new Date(start);
    for (let i = 0; i < maxMonths && cursor <= now; i++) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2,'0')}`;
      months.push(new Date(cursor));
      labelsArr.push(key);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    // Outstanding per month: sum of balances from schedules
    const outstandingMap = {};
    labelsArr.forEach(k => { outstandingMap[k] = 0; });

    for (const l of loans) {
      const sched = scheduleService.generateSchedule(l);
      // map schedule entries to monthKey and take balance
      sched.forEach(s => {
        const k = monthKey(s.date);
        if (outstandingMap[k] === undefined) return; // outside range
        outstandingMap[k] += Number(s.balance || 0);
      });
    }

    const outstandingSeriesArr = labelsArr.map(k => outstandingMap[k] || 0);

    // principal/interest paid per month from payments
    const principalMap = {};
    const interestMap = {};
    labelsArr.forEach(k => { principalMap[k] = 0; interestMap[k] = 0; });

    payments.forEach(p => {
      const k = monthKey(p.payment_date || p.created_at || new Date());
      if (principalMap[k] === undefined) return;
      principalMap[k] += Number(p.principal_component || 0);
      interestMap[k] += Number(p.interest_component || 0);
    });

    const principalArr = labelsArr.map(k => principalMap[k] || 0);
    const interestArr = labelsArr.map(k => interestMap[k] || 0);

    return { labels: labelsArr, outstandingSeries: outstandingSeriesArr, principalSeries: principalArr, interestSeries: interestArr };
  }, [loans, payments]);

  const maxOutstanding = Math.max(...(outstandingSeries.length ? outstandingSeries : [100]));
  const maxPaid = Math.max(...(principalSeries.concat(interestSeries).length ? principalSeries.concat(interestSeries) : [100]));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: Colors.background, padding: 12 }}>
      <Card>
        <Text style={{ fontWeight: '800', fontSize: 16 }}>Loan Summary</Text>
        <Text style={{ marginTop: 8 }}>Total Outstanding: ₹{Number(summary.totalOutstanding || 0).toLocaleString('en-IN')}</Text>
        <Text>Monthly EMI Total: ₹{Number(summary.totalEMI || 0).toLocaleString('en-IN')}</Text>
        <Text>Active Loans: {summary.activeLoans}</Text>
        <Text>Closed Loans: {summary.closedLoans}</Text>
        <Text>Total Interest Paid: ₹{Number(summary.totalInterestPaid || 0).toLocaleString('en-IN')}</Text>
        <Text>Total Prepayments: ₹{Number(summary.totalPrepayments || 0).toLocaleString('en-IN')}</Text>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Text style={{ fontWeight: '700' }}>Outstanding Trend</Text>
        {labels.length === 0 ? (
          <Text style={{ color: Colors.muted, marginTop: 12 }}>No data</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 160 }}>
              {labels.map((k, idx) => {
                const val = outstandingSeries[idx] || 0;
                const pct = maxOutstanding > 0 ? (val / maxOutstanding) * 100 : 0;
                return (
                  <Pressable key={k} style={{ width: 56, alignItems: 'center', marginHorizontal: 6 }}>
                    <View style={{ height: 120, justifyContent: 'flex-end', width: '100%' }}>
                      <View style={{ height: `${Math.max(pct, 2)}%`, backgroundColor: '#4B7CF3', width: 18, borderRadius: 6, alignSelf: 'center' }} />
                    </View>
                    <Text style={{ marginTop: 8, fontSize: 11, color: Colors.muted }}>{formatMonthLabel(k)}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700' }}>₹{Number(val).toLocaleString('en-IN')}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Text style={{ fontWeight: '700' }}>Principal vs Interest Paid (Monthly)</Text>
        {labels.length === 0 ? (
          <Text style={{ color: Colors.muted, marginTop: 12 }}>No data</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 160 }}>
              {labels.map((k, idx) => {
                const p = principalSeries[idx] || 0;
                const i = interestSeries[idx] || 0;
                const total = p + i;
                const pct = maxPaid > 0 ? (total / maxPaid) * 100 : 0;
                return (
                  <Pressable key={k} style={{ width: 56, alignItems: 'center', marginHorizontal: 6 }}>
                    <View style={{ height: 120, justifyContent: 'flex-end', width: '100%', alignItems: 'center' }}>
                      <View style={{ height: `${Math.max((p / (total || 1)) * Math.max(pct, 2), 2)}%`, backgroundColor: '#36B37E', width: 12, borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
                      <View style={{ height: `${Math.max((i / (total || 1)) * Math.max(pct, 2), 2)}%`, backgroundColor: '#E46A6A', width: 12, borderBottomLeftRadius: 6, borderBottomRightRadius: 6 }} />
                    </View>
                    <Text style={{ marginTop: 8, fontSize: 11, color: Colors.muted }}>{formatMonthLabel(k)}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700' }}>₹{Number(total).toLocaleString('en-IN')}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
            <View style={{ width: 10, height: 10, backgroundColor: '#36B37E', marginRight: 6 }} />
            <Text>Principal</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 10, height: 10, backgroundColor: '#E46A6A', marginRight: 6 }} />
            <Text>Interest</Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}
