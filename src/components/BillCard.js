import React, { memo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Chip, Menu, Divider } from 'react-native-paper';
import Card from './Card';
import { Colors, Spacing } from './Theme';
import {
  formatCurrency,
  formatDueDate,
  getBillDisplayStatus,
} from '../services/billUtils';
import CurrencyText from './CurrencyText';

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
  const [menuVisible, setMenuVisible] = useState(false);
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

  const getStatusIcon = (status) => {
    switch(status) {
      case 'paid': return 'check-circle';
      case 'overdue': return 'alert-circle';
      case 'skipped': return 'skip-next-circle';
      default: return 'clock-outline';
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
            alignItems: 'center',
          }}
        >
          {/* CATEGORY ICON */}
          <View style={{
            width: 46,
            height: 46,
            borderRadius: 16,
            backgroundColor: category?.color ? `${category.color}20` : '#F0F2F5',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}>
            <MaterialCommunityIcons 
              name={category?.icon || "receipt"} 
              size={24} 
              color={category?.color || Colors.muted} 
            />
          </View>

          {/* MIDDLE COLUMN: TITLE, DUE DATE, STATUS */}
          <View
            style={{
              flex: 1,
              paddingRight: 8,
            }}
          >
            <Text
              style={{
                fontWeight: '800',
                fontSize: 16,
                color: Colors.text,
                marginBottom: 4,
              }}
              numberOfLines={1}
            >
              {bill.name}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <MaterialCommunityIcons 
                name={bill.is_recurring ? "calendar-sync" : "calendar-blank"} 
                size={14} 
                color={Colors.muted} 
                style={{ marginRight: 4 }} 
              />
              <Text style={{ color: Colors.muted, fontSize: 13, fontWeight: '500' }}>
                {bill._noDueDate || !bill.due_date ? (
                  'No due date'
                ) : (
                  <>
                    Due {formatDueDate(bill.due_date)}
                    {bill.is_recurring
                      ? ` · ${
                          bill.recurrence_type 
                            ? bill.recurrence_type.toLowerCase().replace('_', '-').replace(/\b\w/g, c => c.toUpperCase()) 
                            : 'Recurring'
                        }`
                      : ''}
                  </>
                )}
              </Text>
            </View>

            <Chip
              compact
              icon={getStatusIcon(bill.status)}
              style={{
                alignSelf: 'flex-start',
                backgroundColor: `${display.color}18`,
                borderRadius: 8,
              }}
              textStyle={{
                color: display.color,
                fontSize: 12,
                fontWeight: '700',
                marginLeft: 4,
                marginRight: 8,
              }}
            >
              {display.label}
            </Chip>
          </View>

          {/* RIGHT COLUMN: AMOUNT & MENU */}
          <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <CurrencyText
                style={{
                  fontWeight: '800',
                  fontSize: 17,
                  color: borderColor,
                  marginRight: 4
                }}
                amount={bill.amount}
              />
              
              {/* 3 DOTS MENU */}
              {(typeof onEdit === 'function' || typeof onDelete === 'function') && (
                <View style={{ position: 'relative', zIndex: 10 }}>
                  <TouchableOpacity
                    onPress={() => setMenuVisible(true)}
                    style={{ padding: 2, marginRight: -8, borderRadius: 20 }}
                  >
                    <MaterialCommunityIcons name="dots-vertical" size={24} color={Colors.muted} />
                  </TouchableOpacity>

                  {menuVisible && (
                    <View style={{
                      position: 'absolute',
                      top: 30,
                      right: 0,
                      backgroundColor: '#FFFFFF',
                      borderRadius: 12,
                      padding: 4,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.15,
                      shadowRadius: 12,
                      elevation: 5,
                      minWidth: 140,
                      zIndex: 100,
                    }}>
                      {typeof onEdit === 'function' && (
                        <TouchableOpacity
                          onPress={() => { setMenuVisible(false); onEdit(bill); }}
                          style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}
                        >
                          <MaterialCommunityIcons name="pencil-outline" size={20} color={Colors.text} />
                          <Text style={{ marginLeft: 12, color: Colors.text, fontSize: 14, fontWeight: '500' }}>Edit</Text>
                        </TouchableOpacity>
                      )}
                      
                      {typeof onEdit === 'function' && typeof onDelete === 'function' && (
                        <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 4 }} />
                      )}

                      {typeof onDelete === 'function' && (
                        <TouchableOpacity
                          onPress={() => { setMenuVisible(false); handleDelete(); }}
                          style={{ flexDirection: 'row', alignItems: 'center', padding: 12 }}
                        >
                          <MaterialCommunityIcons name="trash-can-outline" size={20} color="#D64545" />
                          <Text style={{ marginLeft: 12, color: '#D64545', fontSize: 14, fontWeight: '500' }}>Delete</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
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
              name="format-list-bulleted"
              size={18}
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
              View Statements
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

      </View>
    </Card>
  );
}

export default memo(BillCard);