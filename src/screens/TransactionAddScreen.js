import React, { useLayoutEffect } from 'react';
import { ScrollView } from 'react-native';
import TransactionForm from '../components/TransactionForm';
import Card from '../components/Card';

export default function TransactionAddScreen({ navigation, route }) {
  const params = route.params || {};
  const isEdit = !!params.isEdit;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEdit ? 'Edit Transaction' : 'Add Transaction',
    });
  }, [navigation, isEdit]);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 4 }}
      keyboardShouldPersistTaps="handled"
    >
      <Card style={{ margin: 0 }}>
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
      </Card>
    </ScrollView>
  );
}