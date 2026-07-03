import React, { useLayoutEffect } from 'react';
import { View } from 'react-native';
import TransactionForm from '../components/TransactionForm';
import { Spacing } from '../components/Theme';
import Card from '../components/Card';

export default function TransactionAddScreen({ navigation, route }) {
  const isEdit = route.params?.isEdit;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEdit ? 'Edit Transaction' : 'Add Transaction'
    });
  }, [navigation, isEdit]);

  return (
    <View style={{flex:1}}>
      <Card style={{margin: Spacing.m, padding: Spacing.s}}>
        <TransactionForm onCreated={() => navigation.goBack()} onCancel={() => navigation.goBack()} {...route.params} />
      </Card>
    </View>
  );
}
