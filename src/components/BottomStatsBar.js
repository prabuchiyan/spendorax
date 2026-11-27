import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from './Theme';
import { useBalanceVisibility } from '../context/BalanceVisibilityContext';
import { useTheme } from '../context/ThemeContext';
import {
  selectTotalBalance,
  selectUpcomingBillsCount,
  selectUpcomingBillsTotal,
  selectTotalMonthlySpend,
} from '../redux/selectors';

export default function BottomStatsBar({
  navigation,
}) {
  const { balanceVisible } = useBalanceVisibility();
  const { isDarkMode, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const totalBalance = useSelector(selectTotalBalance);
  const billsCount = useSelector(selectUpcomingBillsCount);
  const billsTotal = useSelector(selectUpcomingBillsTotal);
  const totalMonthlySpend = useSelector(selectTotalMonthlySpend);

  const balanceValue = Number(totalBalance || 0);
  const balanceColor = balanceValue < 0
    ? (isDarkMode ? '#F87171' : '#DC2626')
    : theme.textPrimary;
  const dueColor = isDarkMode ? '#FBBF24' : '#D97706';
  const spendColor = isDarkMode ? '#F87171' : '#DC2626';
  const dividerColor = isDarkMode ? '#1F2937' : '#E2E8F0';
  const safeBottom = Math.max(insets?.bottom || 0, 10);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.bottomBarBg,
          borderTopColor: isDarkMode ? '#1F2937' : '#E2E8F0',
          paddingBottom: safeBottom,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.75}
        style={styles.item}
        onPress={() => navigation.navigate('SourcesDashboard')}
      >
        <Text numberOfLines={1} style={[styles.label, { color: theme.textSecondary }]}>
          BALANCE
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          style={[styles.value, { color: balanceColor }]}
        >
          {balanceVisible
            ? `₹${balanceValue.toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
            : '••••••'}
        </Text>
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: dividerColor }]} />

      <TouchableOpacity
        activeOpacity={0.75}
        style={styles.item}
        onPress={() => navigation.navigate('Bills')}
      >
        <View style={styles.dueLabelRow}>
          {Number(billsCount || 0) > 0 && (
            <View style={[styles.dueDot, { backgroundColor: dueColor }]} />
          )}
          <Text numberOfLines={1} style={[styles.label, { color: theme.textSecondary }]}>
            {billsCount || 0} {Number(billsCount || 0) === 1 ? 'BILL DUE' : 'BILLS DUE'}
          </Text>
        </View>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          style={[styles.value, { color: dueColor }]}
        >
          {balanceVisible
            ? `₹${Number(billsTotal || 0).toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
            : '••••••'}
        </Text>
      </TouchableOpacity>

      <View style={[styles.divider, { backgroundColor: dividerColor }]} />

      <TouchableOpacity
        activeOpacity={0.75}
        style={styles.item}
        onPress={() => navigation.navigate('Reports')}
      >
        <Text numberOfLines={1} style={[styles.label, { color: theme.textSecondary }]}>
          SPEND
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          style={[styles.value, { color: spendColor }]}
        >
          {balanceVisible
            ? `₹${Number(totalMonthlySpend || 0).toLocaleString('en-IN', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
            : '••••••'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    paddingTop: 10,
    paddingHorizontal: 8,
    elevation: 12,
    ...(Platform.OS !== 'web'
      ? {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.07,
        shadowRadius: 10,
      }
      : {}),
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 3,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },
  dueLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.45,
    color: Colors.muted,
  },
  value: {
    fontSize: 14.5,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    color: Colors.text,
  },
});