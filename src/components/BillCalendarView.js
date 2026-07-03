import React, { memo, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import Card from './Card';
import { Colors, Spacing } from './Theme';
import { formatCurrency, getBillDisplayStatus } from '../services/billUtils';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function BillCalendarView({ bills = [], month, year, onSelectBill, onMonthChange }) {
  const { days, monthLabel } = useMemo(() => {
    const first = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0).getDate();
    const startPad = first.getDay();
    const cells = [];

    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= lastDay; d++) cells.push(d);

    const label = first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    return { days: cells, monthLabel: label };
  }, [month, year]);

  const billsByDay = useMemo(() => {
    const map = {};
    for (const b of bills) {
      if (!b.due_date) continue;
      const d = new Date(b.due_date.slice(0, 10));
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;
      const day = d.getDate();
      if (!map[day]) map[day] = [];
      map[day].push(b);
    }
    return map;
  }, [bills, month, year]);

  function prevMonth() {
    const d = new Date(year, month - 1, 1);
    onMonthChange && onMonthChange(d.getFullYear(), d.getMonth());
  }

  function nextMonth() {
    const d = new Date(year, month + 1, 1);
    onMonthChange && onMonthChange(d.getFullYear(), d.getMonth());
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.s }}>
        <TouchableOpacity onPress={prevMonth} style={{ padding: 8 }}>
          <Text style={{ color: Colors.primary, fontWeight: '700' }}>‹</Text>
        </TouchableOpacity>
        <Text style={{ fontWeight: '700', fontSize: 16, color: Colors.text }}>{monthLabel}</Text>
        <TouchableOpacity onPress={nextMonth} style={{ padding: 8 }}>
          <Text style={{ color: Colors.primary, fontWeight: '700' }}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: Colors.muted, fontWeight: '600' }}>
            {w}
          </Text>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {days.map((day, idx) => {
          const dayBills = day ? billsByDay[day] || [] : [];
          const hasOverdue = dayBills.some((b) => getBillDisplayStatus(b).key === 'overdue');
          const hasDueSoon = dayBills.some((b) => getBillDisplayStatus(b).key === 'due_soon');
          const dotColor = hasOverdue ? '#E46A6A' : hasDueSoon ? '#FFB020' : dayBills.length ? Colors.primary : null;

          return (
            <View
              key={idx}
              style={{
                width: `${100 / 7}%`,
                aspectRatio: 1,
                padding: 2,
                opacity: day ? 1 : 0,
              }}
            >
              {day ? (
                <TouchableOpacity
                  onPress={() => dayBills[0] && onSelectBill && onSelectBill(dayBills[0])}
                  style={{
                    flex: 1,
                    borderRadius: 8,
                    backgroundColor: dayBills.length ? `${dotColor}18` : '#F8F9FC',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: dayBills.length ? 1 : 0,
                    borderColor: dotColor || 'transparent',
                  }}
                >
                  <Text style={{ fontWeight: dayBills.length ? '700' : '500', color: Colors.text, fontSize: 13 }}>
                    {day}
                  </Text>
                  {dotColor ? (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor, marginTop: 2 }} />
                  ) : null}
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: Spacing.s }}>
        {bills
          .filter((b) => {
            if (!b.due_date) return false;
            const d = new Date(b.due_date.slice(0, 10));
            return d.getFullYear() === year && d.getMonth() === month;
          })
          .slice(0, 8)
          .map((b) => {
            const display = getBillDisplayStatus(b);
            return (
              <TouchableOpacity
                key={b.id}
                onPress={() => onSelectBill && onSelectBill(b)}
                style={{
                  marginRight: 8,
                  padding: 10,
                  borderRadius: 10,
                  backgroundColor: `${display.color}15`,
                  borderWidth: 1,
                  borderColor: `${display.color}44`,
                  minWidth: 120,
                }}
              >
                <Text style={{ fontWeight: '700', fontSize: 13, color: Colors.text }} numberOfLines={1}>
                  {b.name}
                </Text>
                <Text style={{ fontSize: 12, color: display.color, marginTop: 2 }}>{display.label}</Text>
                <Text style={{ fontSize: 12, color: Colors.muted, marginTop: 2 }}>{formatCurrency(b.amount)}</Text>
              </TouchableOpacity>
            );
          })}
      </ScrollView>
    </Card>
  );
}

export default memo(BillCalendarView);
