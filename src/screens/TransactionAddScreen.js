import React, { useLayoutEffect } from 'react';
import { View, ScrollView } from 'react-native';
import TransactionForm from '../components/TransactionForm';
import Card from '../components/Card';

export default function TransactionAddScreen({ navigation, route }) {
  const isEdit = route.params?.isEdit;

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
          onCreated={() => navigation.goBack()}
          onCancel={() => navigation.goBack()}
          {...route.params}
        />
      </Card>
    </ScrollView>
  );
}
