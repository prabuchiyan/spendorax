import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Chip } from 'react-native-paper';
import Card from './Card';
import { Colors, Spacing } from './Theme';
import { formatCurrency, formatDueDate, getBillDisplayStatus } from '../services/billUtils';

function BillCard({
  bill,
  category,
  onPress,
  onMarkPaid,
  onSkip,
  onEdit,
}) {
  const display = getBillDisplayStatus(bill);
  const borderColor = display.color;

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={() => onPress && onPress(bill)}>
      <Card style={{ marginBottom: Spacing.s, borderLeftWidth: 4, borderLeftColor: borderColor }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              {category?.color ? (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: category.color,
                    marginRight: 8,
                  }}
                />
              ) : null}
              <Text style={{ fontWeight: '700', fontSize: 16, color: Colors.text, flex: 1 }} numberOfLines={1}>
                {bill.name}
              </Text>
            </View>
            <Text style={{ color: Colors.muted, fontSize: 13, marginBottom: 6 }}>
              Due {formatDueDate(bill.due_date)}
              {bill.is_recurring ? ` · ${bill.recurrence_type || 'recurring'}` : ''}
            </Text>
            <Chip
              compact
              style={{ alignSelf: 'flex-start', backgroundColor: `${display.color}22` }}
              textStyle={{ color: display.color, fontSize: 12, fontWeight: '600' }}
            >
              {display.label}
            </Chip>
          </View>
          <Text style={{ fontWeight: '800', fontSize: 18, color: borderColor }}>
            {formatCurrency(bill.amount)}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', marginTop: Spacing.s, flexWrap: 'wrap', gap: 4 }}>
          {bill.status !== 'paid' && bill.status !== 'skipped' ? (
            <TouchableOpacity
              onPress={() => onMarkPaid && onMarkPaid(bill)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#E8F8F0',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                marginRight: 8,
              }}
            >
              <MaterialCommunityIcons name="check-circle-outline" size={16} color="#36B37E" />
              <Text style={{ color: '#36B37E', fontWeight: '600', marginLeft: 4, fontSize: 13 }}>Mark Paid</Text>
            </TouchableOpacity>
          ) : null}
          {bill.status !== 'paid' && bill.status !== 'skipped' ? (
            <TouchableOpacity
              onPress={() => onSkip && onSkip(bill)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#F0F2F5',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                marginRight: 8,
              }}
            >
              <MaterialCommunityIcons name="skip-next-outline" size={16} color={Colors.muted} />
              <Text style={{ color: Colors.muted, fontWeight: '600', marginLeft: 4, fontSize: 13 }}>Skip</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => onEdit && onEdit(bill)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#EEF3FF',
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
            }}
          >
            <MaterialCommunityIcons name="pencil-outline" size={16} color={Colors.primary} />
            <Text style={{ color: Colors.primary, fontWeight: '600', marginLeft: 4, fontSize: 13 }}>Edit</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

export default memo(BillCard);
