import React from 'react';
import { View, Text } from 'react-native';
import Card from './Card';

export default function LoanCard({ loan }) {
  return (
    <Card style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ fontWeight: '700' }}>{loan.loan_name}</Text>
          <Text style={{ color: '#666', marginTop: 4 }}>{loan.lender}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontWeight: '800' }}>₹{Number(loan.outstanding_amount || 0).toLocaleString('en-IN')}</Text>
          <Text style={{ color: '#666', marginTop: 4 }}>EMI ₹{Number(loan.emi_amount || 0).toLocaleString('en-IN')}</Text>
        </View>
      </View>
    </Card>
  );
}
