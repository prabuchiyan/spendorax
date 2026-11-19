import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Colors } from './Theme';
import { SAMPLE_SMART_NOTEPAD_TEXT, SAMPLE_PAPER_LEDGER_TEXT } from '../utils/smartNotepadUtils';

export { SAMPLE_SMART_NOTEPAD_TEXT, SAMPLE_PAPER_LEDGER_TEXT };

const MATH_EXAMPLES = [
  {
    title: 'Income / Credit (Default)',
    desc: 'Unsigned number or name + amount',
    input: 'Dinner 450',
    result: '+ ₹450',
    isIncome: true,
    icon: 'cash-plus',
  },
  {
    title: 'Expense / Debit with (-)',
    desc: 'Amount with minus sign (-)',
    input: 'Dinner - 450',
    result: '− ₹450',
    isIncome: false,
    icon: 'cart-outline',
  },
  {
    title: 'Math Expression (Income)',
    desc: 'Common math like multiplication',
    input: '100*5',
    result: '+ ₹500',
    isIncome: true,
    icon: 'calculator-variant-outline',
  },
  {
    title: 'Units in Name (400g, 5L, 3rd)',
    desc: 'Takes only the last number as amount',
    input: 'Gold 400g 700',
    result: '+ ₹700',
    isIncome: true,
    icon: 'weight',
  },
  {
    title: 'Units with Expense (-)',
    desc: 'Units in title with expense amount',
    input: 'Milk 5L -700',
    result: '− ₹700',
    isIncome: false,
    icon: 'scale',
  },
  {
    title: 'Math Addition (+)',
    desc: 'Common user math: 2000 + 5',
    input: '2000 + 5',
    result: '+ ₹2,005',
    isIncome: true,
    icon: 'plus',
  },
  {
    title: 'Math Subtraction (−)',
    desc: 'Common user math: 400- 100',
    input: '400- 100',
    result: '+ ₹300',
    isIncome: true,
    icon: 'minus',
  },
  {
    title: 'Expense with Minus & Bill',
    desc: 'Split expense with minus sign',
    input: 'Room Rent -2000',
    result: '− ₹2,000',
    isIncome: false,
    icon: 'slash-forward',
  },
  {
    title: 'Percentage (%) Tip or Tax',
    desc: 'Calculate tip, tax or discount %',
    input: 'Restaurant Tip -50',
    result: '− ₹50',
    isIncome: false,
    icon: 'percent-outline',
  },
  {
    title: 'Plain Note / Heading',
    desc: 'Lines without numbers are notes',
    input: '--- Trip Expenses ---',
    result: '(Note only)',
    isIncome: null,
    icon: 'text',
  },
];

export default function SmartNotepadGuideModal({
  visible,
  onClose,
  onInsertTemplate,
}) {
  const { isDarkMode, theme } = useTheme();

  const cardBg = isDarkMode ? '#1E293B' : '#FFFFFF';
  const rowBorder = isDarkMode ? '#334155' : '#E2E8F0';
  const textColor = isDarkMode ? '#F8FAFC' : '#0F172A';
  const textMuted = isDarkMode ? '#94A3B8' : '#64748B';
  const codeBg = isDarkMode ? '#0F172A' : '#F1F5F9';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.modalCard, { backgroundColor: cardBg }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: rowBorder }]}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconCircle}>
                <MaterialCommunityIcons name="lightbulb-on" size={20} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.headerTitle, { color: textColor }]}>
                  How to Use Smart Notepad
                </Text>
                <Text style={[styles.headerSubtitle, { color: textMuted }]}>
                  Simple rules and all math calculations
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="close" size={18} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Scrollable Body */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollBody}
          >
            {/* Quick Simple Rules */}
            <View style={[styles.ruleBox, { backgroundColor: isDarkMode ? '#172554' : '#EFF6FF', borderColor: isDarkMode ? '#1E3A8A' : '#BFDBFE' }]}>
              <Text style={[styles.ruleBoxTitle, { color: isDarkMode ? '#93C5FD' : '#1D4ED8' }]}>
                4 Simple Rules for Common Users:
              </Text>

              <View style={styles.ruleItem}>
                <Text style={styles.ruleBullet}>1.</Text>
                <Text style={[styles.ruleText, { color: textColor }]}>
                  <Text style={{ fontWeight: '700' }}>Unsigned numbers or (+)</Text> = Income / Credit. Example: <Text style={styles.monoText}>Dinner 450</Text> → <Text style={{ color: '#10B981', fontWeight: '700' }}>+ ₹450</Text>, or <Text style={styles.monoText}>100*5</Text> → <Text style={{ color: '#10B981', fontWeight: '700' }}>+ ₹500</Text>
                </Text>
              </View>

              <View style={styles.ruleItem}>
                <Text style={styles.ruleBullet}>2.</Text>
                <Text style={[styles.ruleText, { color: textColor }]}>
                  <Text style={{ fontWeight: '700' }}>(-) Minus sign on amount</Text> = Expense / Debit. Example: <Text style={styles.monoText}>Dinner - 450</Text> or <Text style={styles.monoText}>Dinner -450</Text> → <Text style={{ color: '#EF4444', fontWeight: '700' }}>− ₹450</Text>
                </Text>
              </View>

              <View style={styles.ruleItem}>
                <Text style={styles.ruleBullet}>3.</Text>
                <Text style={[styles.ruleText, { color: textColor }]}>
                  <Text style={{ fontWeight: '700' }}>Units like 400g, 5L, 3rd</Text> stay in title. Example: <Text style={styles.monoText}>Gold 400g 700</Text> takes <Text style={styles.monoText}>700</Text> as amount.
                </Text>
              </View>

              <View style={styles.ruleItem}>
                <Text style={styles.ruleBullet}>4.</Text>
                <Text style={[styles.ruleText, { color: textColor }]}>
                  <Text style={{ fontWeight: '700' }}>Common math</Text> evaluates live: <Text style={styles.monoText}>2000 + 5</Text> gives <Text style={styles.monoText}>+ ₹2,005</Text>, and <Text style={styles.monoText}>400- 100</Text> gives <Text style={styles.monoText}>+ ₹300</Text>.
                </Text>
              </View>
            </View>

            {/* Calculations List */}
            <Text style={[styles.sectionHeading, { color: textColor }]}>
              All Math Calculations Supported:
            </Text>

            <View style={[styles.examplesList, { borderColor: rowBorder }]}>
              {MATH_EXAMPLES.map((item, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.exampleRow,
                    {
                      borderBottomColor: rowBorder,
                      borderBottomWidth: idx === MATH_EXAMPLES.length - 1 ? 0 : 1,
                    },
                  ]}
                >
                  <View style={styles.exampleLeft}>
                    <View style={styles.exampleTitleRow}>
                      <MaterialCommunityIcons
                        name={item.icon}
                        size={14}
                        color={item.isIncome === true ? '#10B981' : item.isIncome === false ? '#EF4444' : textMuted}
                        style={{ marginRight: 5 }}
                      />
                      <Text style={[styles.exampleTitle, { color: textColor }]}>
                        {item.title}
                      </Text>
                    </View>
                    <Text style={[styles.exampleDesc, { color: textMuted }]}>
                      {item.desc}
                    </Text>
                    <View style={[styles.codeBadge, { backgroundColor: codeBg }]}>
                      <Text style={[styles.codeText, { color: textColor }]}>
                        {item.input}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.exampleRight}>
                    <View
                      style={[
                        styles.resultBadge,
                        {
                          backgroundColor:
                            item.isIncome === true
                              ? isDarkMode ? '#064E3B' : '#ECFDF5'
                              : item.isIncome === false
                                ? isDarkMode ? '#4C0519' : '#FFF1F2'
                                : isDarkMode ? '#334155' : '#F1F5F9',
                          borderColor:
                            item.isIncome === true
                              ? isDarkMode ? '#065F46' : '#A7F3D0'
                              : item.isIncome === false
                                ? isDarkMode ? '#881337' : '#FECDD3'
                                : isDarkMode ? '#475569' : '#CBD5E1',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.resultBadgeText,
                          {
                            color:
                              item.isIncome === true
                                ? isDarkMode ? '#34D399' : '#059669'
                                : item.isIncome === false
                                  ? isDarkMode ? '#FB7185' : '#E11D48'
                                  : textMuted,
                          },
                        ]}
                      >
                        {item.result}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {/* Summary Explanation Box */}
            <View style={[styles.summaryBox, { backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC', borderColor: rowBorder }]}>
              <Text style={[styles.summaryBoxTitle, { color: textColor }]}>
                What the Bottom Numbers Mean:
              </Text>
              <Text style={[styles.summaryBoxLine, { color: textMuted }]}>
                🟢 <Text style={{ fontWeight: '700', color: isDarkMode ? '#34D399' : '#059669' }}>Money In</Text>: Total amount earned or received.
              </Text>
              <Text style={[styles.summaryBoxLine, { color: textMuted }]}>
                🔴 <Text style={{ fontWeight: '700', color: isDarkMode ? '#FB7185' : '#E11D48' }}>Money Out</Text>: Total amount spent or paid.
              </Text>
              <Text style={[styles.summaryBoxLine, { color: textMuted }]}>
                ⚖️ <Text style={{ fontWeight: '700', color: Colors.primary }}>Remaining Balance</Text>: Money In minus Money Out.
              </Text>
              <Text style={[styles.summaryBoxLine, { color: textMuted }]}>
                • If balance is positive, it shows <Text style={{ fontWeight: '700', color: '#10B981' }}>Saved</Text>.
              </Text>
              <Text style={[styles.summaryBoxLine, { color: textMuted }]}>
                • If you spent more than you earned, it shows <Text style={{ fontWeight: '700', color: '#EF4444' }}>Overspent</Text>.
              </Text>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.footer, { borderTopColor: rowBorder }]}>
            <TouchableOpacity
              style={[styles.insertBtn, { backgroundColor: Colors.primary }]}
              onPress={() => {
                if (onInsertTemplate) {
                  onInsertTemplate(SAMPLE_PAPER_LEDGER_TEXT);
                }
              }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="content-paste" size={16} color="#FFF" />
              <Text style={styles.insertBtnText}>Try Sample Notes in Smart Notepad</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.closeFooterBtn, { borderColor: rowBorder }]}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={[styles.closeFooterBtnText, { color: textColor }]}>Got It</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15.5,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    padding: 16,
    gap: 14,
  },
  ruleBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  ruleBoxTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  ruleBullet: {
    fontWeight: '700',
    fontSize: 12.5,
    color: '#3B82F6',
  },
  ruleText: {
    fontSize: 12.5,
    flex: 1,
    lineHeight: 18,
  },
  monoText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginTop: 4,
  },
  examplesList: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  exampleLeft: {
    flex: 1,
    gap: 2,
  },
  exampleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exampleTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  exampleDesc: {
    fontSize: 11,
  },
  codeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  codeText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
  },
  exampleRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  resultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 70,
    alignItems: 'center',
  },
  resultBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  summaryBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  summaryBoxTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryBoxLine: {
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  insertBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  insertBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  closeFooterBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeFooterBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
