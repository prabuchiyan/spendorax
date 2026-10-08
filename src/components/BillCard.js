import React, { memo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Menu, Portal } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
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
  isDarkMode,

  // CREDIT CARD EXPAND / COLLAPSE
  showExpandButton = false,
  expanded = false,
  onToggleExpand,
}) {
  const [menuVisible, setMenuVisible] = useState(false);
  const theme = isDarkMode
    ? {
      cardBg: "#182234",
      cardBorder: "#334155",
      textPrimary: "#F3F4F6",
      textSecondary: "#9CA3AF",
      textMuted: "#475569",
      iconContainerBg: "#1e293b",
      iconContainerBorder: "#334155",
      iconColor: "#cbd5e1",
      menuBg: "#1e293b",
      actionBtnBg: "#334155",
      actionBtnText: "#e2e8f0",

      // Status colors
      overdueBg: "rgba(159, 18, 57, 0.4)", // rose-950/40
      overdueText: "#fda4af", // rose-300
      overdueDot: "#f43f5e", // rose-500
      overdueBorder: "rgba(244, 63, 94, 0.3)",
      overdueActionBg: "#e11d48", // rose-600
      overdueActionText: "#ffffff",

      pendingBg: "rgba(69, 26, 3, 0.4)", // amber-950/40
      pendingText: "#fcd34d", // amber-300
      pendingDot: "#fbbf24", // amber-400
      pendingBorder: "rgba(245, 158, 11, 0.3)",

      laterBg: "#1e293b", // slate-800
      laterText: "#cbd5e1", // slate-300
      laterDot: "#94a3b8", // slate-400
      laterBorder: "#334155",

      paidBg: "rgba(13, 148, 136, 0.1)", // teal-900/40
      paidText: "#5eead4", // teal-300
      paidDot: "#2dd4bf", // teal-400
      paidBorder: "rgba(20, 184, 166, 0.3)",
    }
    : {
      cardBg: "#ffffff",
      cardBorder: "rgba(198, 198, 205, 0.4)",
      textPrimary: "#0b1c30",
      textSecondary: "#45464d",
      textMuted: "#94a3b8",
      iconContainerBg: "#eff4ff",
      iconContainerBorder: "rgba(198, 198, 205, 0.2)",
      iconColor: "#45464d",
      menuBg: "#ffffff",
      actionBtnBg: "#eff4ff",
      actionBtnText: "#0b1c30",

      // Status colors
      overdueBg: "#ffdad6", // error-container
      overdueText: "#93000a", // on-error-container
      overdueDot: "#ba1a1a", // error
      overdueBorder: "rgba(186, 26, 26, 0.2)",
      overdueActionBg: "#93000a",
      overdueActionText: "#ffffff",

      pendingBg: "#ffdcc3", // tertiary-fixed
      pendingText: "#6e3900", // on-tertiary-fixed-variant
      pendingDot: "#c76c00", // on-tertiary-container
      pendingBorder: "rgba(199, 108, 0, 0.2)",

      laterBg: "#eff4ff", // surface-container-low
      laterText: "#45464d", // on-surface-variant
      laterDot: "#76777d", // outline
      laterBorder: "rgba(198, 198, 205, 0.3)",

      paidBg: "#eaf1ff", // inverse-on-surface
      paidText: "#006f66", // on-secondary-container
      paidDot: "#006a61", // secondary
      paidBorder: "rgba(0, 111, 102, 0.2)",
    };

  const status = bill.status || 'pending';
  const isPaid = status === 'paid';

  // Determine specific status styling
  let statusTheme = { bg: theme.pendingBg, text: theme.pendingText, dot: theme.pendingDot, border: theme.pendingBorder, label: "DUE SOON" };

  if (status === 'overdue') {
    statusTheme = { bg: theme.overdueBg, text: theme.overdueText, dot: theme.overdueDot, border: theme.overdueBorder, label: "OVERDUE" };
  } else if (status === 'paid') {
    statusTheme = { bg: theme.paidBg, text: theme.paidText, dot: theme.paidDot, border: theme.paidBorder, label: "PAID" };
  } else if (status === 'skipped') {
    statusTheme = { bg: theme.laterBg, text: theme.laterText, dot: theme.laterDot, border: theme.laterBorder, label: "SKIPPED" };
  } else {
    // Check if it's "later" (e.g. > 7 days away)
    const dueDate = new Date(bill.due_date);
    const now = new Date();
    const diffTime = dueDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 7) {
      statusTheme = { bg: theme.laterBg, text: theme.laterText, dot: theme.laterDot, border: theme.laterBorder, label: "PENDING" };
    }
  }

  const handleDelete = () => {
    if (typeof onDelete === 'function') {
      onDelete(bill);
    }
  };

  const handleCardPress = () => {
    if (typeof onPress === 'function') {
      onPress(bill);
    }
  };

  return (
    <View
      style={{
        backgroundColor: theme.cardBg,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderLeftWidth: 4,
        borderColor: theme.cardBorder,
        borderLeftColor: statusTheme.dot,
        padding: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        opacity: isPaid || status === 'skipped' ? 0.9 : 1,
      }}
    >
      <TouchableOpacity activeOpacity={0.85} onPress={handleCardPress}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>

          <View style={{ flexDirection: 'row', flex: 1 }}>
            {/* CATEGORY ICON */}
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              backgroundColor: theme.iconContainerBg,
              borderWidth: 1,
              borderColor: theme.iconContainerBorder,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}>
              <MaterialCommunityIcons
                name={category?.icon || "receipt"}
                size={22}
                color={category?.color || theme.iconColor}
              />
            </View>

            {/* MIDDLE COLUMN: TITLE, DUE DATE */}
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text
                style={{
                  fontWeight: '600',
                  fontSize: 16,
                  color: isPaid ? theme.textSecondary : theme.textPrimary,
                  lineHeight: 20,
                }}
                numberOfLines={1}
              >
                {bill.name}
              </Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <MaterialCommunityIcons
                  name={status === 'paid' ? "check-circle" : (status === 'overdue' ? "history" : "clock-outline")}
                  size={13}
                  color={statusTheme.text}
                  style={{ marginRight: 4 }}
                />
                <Text style={{ color: statusTheme.text, fontSize: 12, fontWeight: '500' }}>
                  {bill._noDueDate || !bill.due_date ? 'No due date' : `Due ${formatDueDate(bill.due_date)}`}
                </Text>

                {category?.name && (
                  <>
                    <Text style={{ color: theme.textMuted, fontSize: 10, marginHorizontal: 4 }}>•</Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{category.name}</Text>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* RIGHT COLUMN: AMOUNT & MENU */}
          <View style={{ alignItems: 'center', flexDirection: 'row' }}>
            <CurrencyText
              style={{
                fontWeight: '700',
                fontSize: 16,
                color: isPaid ? theme.textMuted : theme.textPrimary,
                textDecorationLine: isPaid ? 'line-through' : 'none',
              }}
              amount={bill.amount}
            />

            {(typeof onEdit === 'function' || typeof onDelete === 'function' || typeof onToggleExpand === 'function') && (
              <View style={{ position: 'relative', zIndex: 10, marginLeft: 4 }}>
                {menuVisible && (
                  <Portal>
                    <View
                      style={{
                        ...StyleSheet.absoluteFillObject,
                        backgroundColor: isDarkMode ? 'rgba(0,0,0,0.4)' : 'rgba(230,230,240,0.3)',
                        // @ts-ignore
                        backdropFilter: 'blur(5px)'
                      }}
                      pointerEvents="none"
                    />
                  </Portal>
                )}
                <Menu
                  visible={menuVisible}
                  onDismiss={() => setMenuVisible(false)}
                  anchor={
                    <TouchableOpacity
                      onPress={() => setMenuVisible(true)}
                      style={{ padding: 4, borderRadius: 8 }}
                    >
                      <MaterialCommunityIcons name="dots-vertical" size={20} color={theme.textSecondary} />
                    </TouchableOpacity>
                  }
                  contentStyle={{
                    backgroundColor: theme.menuBg,
                    borderWidth: 1,
                    borderColor: theme.cardBorder,
                    borderRadius: 12,
                    paddingVertical: 4,
                  }}
                >
                  {typeof onEdit === 'function' && (
                    <Menu.Item
                      onPress={() => { setMenuVisible(false); onEdit(bill); }}
                      title="Edit Bill Details"
                      titleStyle={{ color: theme.textPrimary, fontSize: 13, fontWeight: '500' }}
                      leadingIcon={() => <MaterialCommunityIcons name="pencil-outline" size={18} color={theme.textPrimary} />}
                    />
                  )}
                  {typeof onMarkPaid === 'function' && (
                    <Menu.Item
                      onPress={() => { setMenuVisible(false); onMarkPaid(bill); }}
                      title="Mark as Paid"
                      titleStyle={{ color: isDarkMode ? '#2dd4bf' : '#006a61', fontSize: 13, fontWeight: '500' }}
                      leadingIcon={() => <MaterialCommunityIcons name="check-circle-outline" size={18} color={isDarkMode ? '#2dd4bf' : '#006a61'} />}
                    />
                  )}
                  {typeof onSkip === 'function' && (
                    <Menu.Item
                      onPress={() => { setMenuVisible(false); onSkip(bill); }}
                      title="Skip this cycle"
                      titleStyle={{ color: theme.textPrimary, fontSize: 13, fontWeight: '500' }}
                      leadingIcon={() => <MaterialCommunityIcons name="history" size={18} color={theme.textPrimary} />}
                    />
                  )}
                  {typeof onDelete === 'function' && (
                    <Menu.Item
                      onPress={() => { setMenuVisible(false); handleDelete(); }}
                      title="Delete Bill"
                      titleStyle={{ color: '#e11d48', fontSize: 13, fontWeight: '500' }}
                      leadingIcon={() => <MaterialCommunityIcons name="trash-can-outline" size={18} color="#e11d48" />}
                    />
                  )}
                </Menu>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* ====================================================
          ACTION BAR
          ==================================================== */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 10,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: theme.cardBorder,
        }}
      >
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 12,
          backgroundColor: statusTheme.bg,
        }}>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: statusTheme.dot, marginRight: 6 }} />
          <Text style={{ fontSize: 10, fontWeight: '700', color: statusTheme.text }}>
            {statusTheme.label}
          </Text>
        </View>

        <View style={{ flexDirection: 'row' }}>
          {showExpandButton ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onToggleExpand}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.actionBtnBg,
                borderWidth: 1,
                borderColor: theme.cardBorder,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 6,
                marginRight: 4,
              }}
            >
              <Text style={{ color: theme.actionBtnText, fontWeight: '600', fontSize: 12 }}>
                Review & Schedule
              </Text>
            </TouchableOpacity>
          ) : null}

          {status === 'overdue' && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => onPress?.(bill)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.overdueActionBg,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 6,
              }}
            >
              <Text style={{ color: theme.overdueActionText, fontWeight: '600', marginRight: 4, fontSize: 12 }}>Pay Now</Text>
              <MaterialCommunityIcons name="arrow-right" size={14} color={theme.overdueActionText} />
            </TouchableOpacity>
          )}

          {status === 'pending' && !showExpandButton && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => onMarkPaid?.(bill)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: theme.actionBtnBg,
                borderWidth: 1,
                borderColor: theme.cardBorder,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 6,
              }}
            >
              <Text style={{ color: theme.actionBtnText, fontWeight: '600', fontSize: 12 }}>Mark Paid</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

export default memo(BillCard);