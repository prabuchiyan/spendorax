import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Chip } from 'react-native-paper';
import Card from './Card';
import { Colors, Spacing } from './Theme';
import {
  formatCurrency,
  formatDueDate,
  getBillDisplayStatus,
} from '../services/billUtils';

function BillCard({
  bill,
  category,
  onPress,
  onMarkPaid,
  onSkip,
  onEdit,
  onDelete,

  // CREDIT CARD EXPAND / COLLAPSE
  showExpandButton = false,
  expanded = false,
  onToggleExpand,
}) {
  const display = getBillDisplayStatus(bill);
  const borderColor = display.color;

  /*
   * IMPORTANT:
   *
   * Do NOT show another Alert here.
   *
   * BillsScreen already handles confirmation
   * using ConfirmDialog.
   *
   * Calling onDelete directly also guarantees
   * that the callback reaches BillsScreen.
   */
  const handleDelete = () => {
    console.log(
      '[BillCard] DELETE BUTTON PRESSED:',
      bill
    );

    if (typeof onDelete === 'function') {
      console.log(
        '[BillCard] CALLING onDelete:',
        bill
      );

      onDelete(bill);
    } else {
      console.warn(
        '[BillCard] onDelete is missing:',
        bill?.id
      );
    }
  };

  const handleCardPress = () => {
    if (typeof onPress === 'function') {
      onPress(bill);
    }
  };

  return (
    <Card
      style={{
        marginBottom: Spacing.s,
        borderLeftWidth: 4,
        borderLeftColor: borderColor,
      }}
    >
      {/* ====================================================
          CARD BODY
          ==================================================== */}

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handleCardPress}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <View
            style={{
              flex: 1,
              paddingRight: 8,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 4,
              }}
            >
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

              <Text
                style={{
                  fontWeight: '700',
                  fontSize: 16,
                  color: Colors.text,
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {bill.name}
              </Text>
            </View>

            {/* DUE DATE */}

            <Text
              style={{
                color: Colors.muted,
                fontSize: 13,
                marginBottom: 6,
              }}
            >
              {bill._noDueDate || !bill.due_date ? (
                'No due date scheduled'
              ) : (
                <>
                  Due {formatDueDate(bill.due_date)}
                  {bill.is_recurring
                    ? ` · ${bill.recurrence_type || 'recurring'}`
                    : ''}
                </>
              )}
            </Text>

            <Chip
              compact
              style={{
                alignSelf: 'flex-start',
                backgroundColor: `${display.color}22`,
              }}
              textStyle={{
                color: display.color,
                fontSize: 12,
                fontWeight: '600',
              }}
            >
              {display.label}
            </Chip>
          </View>

          <Text
            style={{
              fontWeight: '800',
              fontSize: 18,
              color: borderColor,
            }}
          >
            {formatCurrency(bill.amount)}
          </Text>
        </View>
      </TouchableOpacity>

      {/* ====================================================
          ACTIONS
          ==================================================== */}

      <View
        style={{
          flexDirection: 'row',
          marginTop: Spacing.s,
          flexWrap: 'wrap',
          gap: 4,
          alignItems: 'center',
        }}
      >
        {/* EXPAND / COLLAPSE */}

        {showExpandButton ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              console.log(
                '[BillCard] EXPAND PRESSED:',
                bill?.id
              );

              onToggleExpand?.();
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#EAF5EF',
              paddingHorizontal: 9,
              paddingVertical: 6,
              borderRadius: 8,
              marginRight: 4,
            }}
          >
            <MaterialCommunityIcons
              name={
                expanded
                  ? 'chevron-up'
                  : 'chevron-down'
              }
              size={19}
              color="#3F8F6B"
            />

            <Text
              style={{
                color: '#3F8F6B',
                fontWeight: '600',
                marginLeft: 2,
                fontSize: 13,
              }}
            >
              {expanded
                ? 'Hide'
                : 'Statements'}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* MARK PAID */}

        {bill.status !== 'paid' &&
        bill.status !== 'skipped' ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() =>
              onMarkPaid?.(bill)
            }
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
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={16}
              color="#36B37E"
            />

            <Text
              style={{
                color: '#36B37E',
                fontWeight: '600',
                marginLeft: 4,
                fontSize: 13,
              }}
            >
              Mark Paid
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* SKIP */}

        {bill.status !== 'paid' &&
        bill.status !== 'skipped' ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() =>
              onSkip?.(bill)
            }
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
            <MaterialCommunityIcons
              name="skip-next-outline"
              size={16}
              color={Colors.muted}
            />

            <Text
              style={{
                color: Colors.muted,
                fontWeight: '600',
                marginLeft: 4,
                fontSize: 13,
              }}
            >
              Skip
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* EDIT */}

        {typeof onEdit === 'function' ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() =>
              onEdit(bill)
            }
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#EEF3FF',
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              marginRight: 4,
            }}
          >
            <MaterialCommunityIcons
              name="pencil-outline"
              size={16}
              color={Colors.primary}
            />

            <Text
              style={{
                color: Colors.primary,
                fontWeight: '600',
                marginLeft: 4,
                fontSize: 13,
              }}
            >
              Edit
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* ==================================================
            DELETE
            ================================================== */}

        {typeof onDelete === 'function' ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleDelete}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FFF0F0',
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
            }}
          >
            <MaterialCommunityIcons
              name="trash-can-outline"
              size={16}
              color="#D64545"
            />

            <Text
              style={{
                color: '#D64545',
                fontWeight: '600',
                marginLeft: 4,
                fontSize: 13,
              }}
            >
              Delete
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Card>
  );
}

export default memo(BillCard);