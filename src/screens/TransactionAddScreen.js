import React, { useLayoutEffect } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import TransactionForm from '../components/TransactionForm';
import { useTheme } from '../context/ThemeContext';

export default function TransactionAddScreen({ navigation, route }) {
  const params = route.params || {};
  const isEdit = !!params.isEdit;
  const { isDarkMode, theme } = useTheme();

  const initialType = params.initialType || 'expense';
  const createTitle =
    initialType === 'income'
      ? 'Add Income'
      : initialType === 'transfer'
        ? 'Add Transfer'
        : 'Add Expense';

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEdit ? 'Edit Transaction' : createTitle,
      headerStyle: {
        backgroundColor: isDarkMode ? (theme?.headerBg || '#111827') : '#FFFFFF',
        elevation: 0,
        shadowOpacity: 0,
        borderBottomWidth: 1,
        borderBottomColor: isDarkMode ? '#1F2937' : '#F1F5F9',
      },
      headerTitleStyle: {
        fontSize: 18,
        fontWeight: '700',
        color: isDarkMode ? '#F9FAFB' : '#111827',
      },
      headerTintColor: isDarkMode ? '#F9FAFB' : '#111827',
    });
  }, [navigation, isEdit, createTitle, isDarkMode, theme]);

  const screenBg = isDarkMode ? (theme?.background || '#0F172A') : '#F8FAFC';

  return (
    <View style={[styles.container, { backgroundColor: screenBg }]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={isDarkMode ? '#0B0F17' : '#0B1F3A'}
      />
      <TransactionForm
        {...params}
        onCancel={() => navigation.goBack()}
        onPressBill={(bill) =>
          navigation.navigate('BillDetail', {
            billId: bill.parent_bill_id || bill.id,
            occurrenceId: bill.id,
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
