import React, { memo, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getBillDisplayStatus } from '../services/billUtils';
import CurrencyText from './CurrencyText';
import { useTheme } from '../context/ThemeContext';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function BillCalendarView({
  bills = [],
  month,
  year,
  isDarkMode: propIsDark,
  onSelectBill,
  onMonthChange,
}) {
  const { isDarkMode: globalIsDark, theme } = useTheme();
  const isDarkMode = propIsDark !== undefined ? propIsDark : globalIsDark;

  const palette = isDarkMode
    ? {
      cardBg: theme?.cardBg || '#182234',
      cardBorder: theme?.cardBorder || '#334155',
      surfaceSubtle: '#1E293B',
      textPrimary: theme?.textPrimary || '#F3F4F6',
      textSecondary: theme?.textSecondary || '#9CA3AF',
      textMuted: '#64748B',
      primary: theme?.primary || '#4B7CF3',
      overdue: '#F87171',
      dueSoon: '#FBBF24',
    }
    : {
      cardBg: theme?.cardBg || '#FFFFFF',
      cardBorder: theme?.cardBorder || '#E2E8F0',
      surfaceSubtle: '#F8FAFC',
      textPrimary: theme?.textPrimary || '#0B1C30',
      textSecondary: theme?.textSecondary || '#64748B',
      textMuted: '#94A3B8',
      primary: theme?.primary || '#4B7CF3',
      overdue: '#DC2626',
      dueSoon: '#D97706',
    };

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
      const parts = String(b.due_date).slice(0, 10).split('-').map(Number);
      const d = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(b.due_date);
      if (isNaN(d.getTime()) || d.getFullYear() !== year || d.getMonth() !== month) continue;
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
    <View
      style={[
        styles.calendarCard,
        {
          backgroundColor: palette.cardBg,
          borderColor: palette.cardBorder,
        },
        !isDarkMode && styles.cardShadowLight,
      ]}
    >
      <View style={styles.monthHeader}>
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={prevMonth}
          style={[
            styles.arrowBtn,
            { backgroundColor: palette.surfaceSubtle, borderColor: palette.cardBorder },
          ]}
        >
          <Feather name="chevron-left" size={18} color={palette.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.monthTitle, { color: palette.textPrimary }]}>{monthLabel}</Text>
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={nextMonth}
          style={[
            styles.arrowBtn,
            { backgroundColor: palette.surfaceSubtle, borderColor: palette.cardBorder },
          ]}
        >
          <Feather name="chevron-right" size={18} color={palette.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={[styles.weekdayText, { color: palette.textMuted }]}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.gridWrap}>
        {days.map((day, idx) => {
          const dayBills = day ? billsByDay[day] || [] : [];
          const hasOverdue = dayBills.some((b) => {
            const disp = getBillDisplayStatus(b);
            return b.status === 'overdue' || String(disp?.label || '').startsWith('Overdue');
          });
          const hasDueSoon = dayBills.some((b) => {
            const disp = getBillDisplayStatus(b);
            return String(disp?.label || '').startsWith('Due ');
          });
          const dotColor = hasOverdue
            ? palette.overdue
            : hasDueSoon
              ? palette.dueSoon
              : dayBills.length
                ? palette.primary
                : null;

          return (
            <View
              key={idx}
              style={{
                width: `${100 / 7}%`,
                aspectRatio: 1,
                padding: 2.5,
                opacity: day ? 1 : 0,
              }}
            >
              {day ? (
                <TouchableOpacity
                  activeOpacity={dayBills.length ? 0.75 : 1}
                  disabled={dayBills.length === 0}
                  onPress={() => dayBills[0] && onSelectBill && onSelectBill(dayBills[0])}
                  style={[
                    styles.dayCell,
                    {
                      backgroundColor: dayBills.length
                        ? `${dotColor}${isDarkMode ? '29' : '18'}`
                        : palette.surfaceSubtle,
                      borderWidth: dayBills.length ? 1 : 0,
                      borderColor: dotColor || 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontWeight: dayBills.length ? '800' : '600',
                      color: dayBills.length ? palette.textPrimary : palette.textSecondary,
                      fontSize: 13,
                    }}
                  >
                    {day}
                  </Text>
                  {dotColor ? (
                    <View style={[styles.dayDot, { backgroundColor: dotColor }]} />
                  ) : null}
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.billChipsScroll}>
        {bills
          .filter((b) => {
            if (!b.due_date) return false;
            const parts = String(b.due_date).slice(0, 10).split('-').map(Number);
            const d = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(b.due_date);
            return !isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month;
          })
          .slice(0, 10)
          .map((b) => {
            const display = getBillDisplayStatus(b);
            return (
              <TouchableOpacity
                key={b.id}
                activeOpacity={0.8}
                onPress={() => onSelectBill && onSelectBill(b)}
                style={[
                  styles.upcomingBillChip,
                  {
                    backgroundColor: `${display.color}${isDarkMode ? '22' : '15'}`,
                    borderColor: `${display.color}48`,
                  },
                ]}
              >
                <Text style={[styles.chipTitle, { color: palette.textPrimary }]} numberOfLines={1}>
                  {b.name}
                </Text>
                <Text style={[styles.chipStatus, { color: display.color }]}>{display.label}</Text>
                <CurrencyText
                  style={[styles.chipAmount, { color: palette.textSecondary }]}
                  amount={b.amount}
                />
              </TouchableOpacity>
            );
          })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  cardShadowLight: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
    },
    android: {
      elevation: 2,
    },
    default: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
    },
  }),
  calendarCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 15,
    marginBottom: 14,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  arrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    fontWeight: '800',
    fontSize: 16,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
  billChipsScroll: {
    marginTop: 12,
  },
  upcomingBillChip: {
    marginRight: 8,
    padding: 11,
    borderRadius: 13,
    borderWidth: 1,
    minWidth: 130,
    maxWidth: 180,
  },
  chipTitle: {
    fontWeight: '800',
    fontSize: 13,
  },
  chipStatus: {
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 2,
  },
  chipAmount: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
});

export default memo(BillCalendarView);
