import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Colors } from './Theme';
import { SAMPLE_SMART_NOTEPAD_TEXT } from '../utils/smartNotepadUtils';

export { SAMPLE_SMART_NOTEPAD_TEXT };

const EASY_EXAMPLES = [
  {
    input: 'Salary 50000',
    meaning: 'Salary money received',
    result: '+ ₹50,000',
    type: 'income',
    icon: 'cash-plus',
  },
  {
    input: 'Dinner 450',
    meaning: 'Money received for dinner',
    result: '+ ₹450',
    type: 'income',
    icon: 'cash',
  },
  {
    input: 'Dinner - 450',
    meaning: 'Money spent for dinner',
    result: '− ₹450',
    type: 'expense',
    icon: 'silverware-fork-knife',
  },
  {
    input: 'Tea -20',
    meaning: 'Daily small tea expense',
    result: '− ₹20',
    type: 'expense',
    icon: 'coffee',
  },
  {
    input: '5 Shirts 100*5',
    meaning: '5 shirts at ₹100 each',
    result: '+ ₹500',
    type: 'income',
    icon: 'calculator-variant-outline',
  },
  {
    input: 'Rice 25kg 1200',
    meaning: 'Rice with weight unit (kg)',
    result: '+ ₹1,200',
    type: 'income',
    icon: 'scale',
  },
  {
    input: 'Milk 2L -60',
    meaning: 'Milk bought with litre unit (L)',
    result: '− ₹60',
    type: 'expense',
    icon: 'cup-water',
  },
  {
    input: 'Petrol 1000 + 200',
    meaning: 'Two petrol bills added together',
    result: '+ ₹1,200',
    type: 'income',
    icon: 'gas-station',
  },
  {
    input: 'House Rent -12000',
    meaning: 'Monthly house rent paid',
    result: '− ₹12,000',
    type: 'expense',
    icon: 'home-outline',
  },
  {
    input: '--- Trip Expenses ---',
    meaning: 'Heading or note with no money',
    result: 'Note',
    type: 'note',
    icon: 'format-text',
  },
];

export default function SmartNotepadGuideModal({
  visible,
  onClose,
  onInsertTemplate,
}) {
  const { isDarkMode, theme } = useTheme();

  const cardBg = isDarkMode ? '#131926' : '#FFFFFF';
  const rowBorder = isDarkMode ? '#283244' : '#E2E8F0';
  const textColor = isDarkMode ? '#F8FAFC' : '#0F172A';
  const textMuted = isDarkMode ? '#94A3B8' : '#64748B';
  const codeBg = isDarkMode ? '#1E293B' : '#F1F5F9';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.bottomSheet,
                {
                  backgroundColor: cardBg,
                  borderColor: rowBorder,
                },
              ]}
            >
              {/* Drag Handle */}
              <View
                style={[
                  styles.dragHandle,
                  { backgroundColor: isDarkMode ? '#334155' : '#CBD5E1' },
                ]}
              />

              {/* Header */}
              <View style={[styles.header, { borderBottomColor: rowBorder }]}>
                <View style={styles.headerTitleRow}>
                  <View
                    style={[
                      styles.headerIconCircle,
                      { backgroundColor: isDarkMode ? '#2D2006' : '#FEF3C7' },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="lightbulb-on"
                      size={22}
                      color="#F59E0B"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.headerTitle, { color: textColor }]}>
                      How to Use Smart Notepad
                    </Text>
                    <Text style={[styles.headerSubtitle, { color: textMuted }]}>
                      Very easy • Simple as writing on paper
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={onClose}
                  style={[
                    styles.closeBtn,
                    { backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9' },
                  ]}
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <MaterialCommunityIcons name="close" size={18} color={textColor} />
                </TouchableOpacity>
              </View>

              {/* Scrollable Content */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollBody}
              >
                {/* 2 MAIN RULES IN SIMPLE CARDS */}
                <Text style={[styles.mainSectionTitle, { color: textColor }]}>
                  Only 2 Simple Rules to Remember:
                </Text>

                {/* Rule 1: Money In */}
                <View
                  style={[
                    styles.simpleRuleCard,
                    {
                      backgroundColor: isDarkMode ? '#06281E' : '#ECFDF5',
                      borderColor: isDarkMode ? '#065F46' : '#A7F3D0',
                    },
                  ]}
                >
                  <View style={styles.ruleBadgeRow}>
                    <View style={[styles.rulePill, { backgroundColor: '#10B981' }]}>
                      <MaterialCommunityIcons name="arrow-bottom-left" size={14} color="#FFF" />
                      <Text style={styles.rulePillText}>Rule 1</Text>
                    </View>
                    <Text
                      style={[
                        styles.ruleCardTitle,
                        { color: isDarkMode ? '#34D399' : '#065F46' },
                      ]}
                    >
                      Money Coming In (Income / Cash Received)
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.ruleExplanationText,
                      { color: isDarkMode ? '#D1FAE5' : '#064E3B' },
                    ]}
                  >
                    Just write what it is and the amount. No minus sign needed!
                  </Text>

                  <View
                    style={[
                      styles.exampleVisualRow,
                      { backgroundColor: isDarkMode ? '#0A3B2C' : '#FFFFFF' },
                    ]}
                  >
                    <View style={styles.typeBox}>
                      <Text style={styles.typeLabel}>You write:</Text>
                      <Text style={[styles.typeCode, { color: textColor }]}>Dinner 450</Text>
                    </View>
                    <MaterialCommunityIcons name="arrow-right" size={18} color="#10B981" />
                    <View style={styles.resultBox}>
                      <Text style={styles.resultLabel}>Result:</Text>
                      <Text style={[styles.resultGreen, { color: '#10B981' }]}>+ ₹450</Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.exampleVisualRow,
                      { backgroundColor: isDarkMode ? '#0A3B2C' : '#FFFFFF' },
                    ]}
                  >
                    <View style={styles.typeBox}>
                      <Text style={styles.typeLabel}>You write:</Text>
                      <Text style={[styles.typeCode, { color: textColor }]}>Salary 25000</Text>
                    </View>
                    <MaterialCommunityIcons name="arrow-right" size={18} color="#10B981" />
                    <View style={styles.resultBox}>
                      <Text style={styles.resultLabel}>Result:</Text>
                      <Text style={[styles.resultGreen, { color: '#10B981' }]}>+ ₹25,000</Text>
                    </View>
                  </View>
                </View>

                {/* Rule 2: Money Out */}
                <View
                  style={[
                    styles.simpleRuleCard,
                    {
                      backgroundColor: isDarkMode ? '#2D0F16' : '#FFF1F2',
                      borderColor: isDarkMode ? '#881337' : '#FECDD3',
                    },
                  ]}
                >
                  <View style={styles.ruleBadgeRow}>
                    <View style={[styles.rulePill, { backgroundColor: '#EF4444' }]}>
                      <MaterialCommunityIcons name="arrow-top-right" size={14} color="#FFF" />
                      <Text style={styles.rulePillText}>Rule 2</Text>
                    </View>
                    <Text
                      style={[
                        styles.ruleCardTitle,
                        { color: isDarkMode ? '#FB7185' : '#9F1239' },
                      ]}
                    >
                      Money Going Out (Expense / Cash Spent)
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.ruleExplanationText,
                      { color: isDarkMode ? '#FFE4E6' : '#881337' },
                    ]}
                  >
                    Put a minus sign <Text style={{ fontWeight: '800' }}>(-)</Text> with the amount whenever you spend money!
                  </Text>

                  <View
                    style={[
                      styles.exampleVisualRow,
                      { backgroundColor: isDarkMode ? '#3B131D' : '#FFFFFF' },
                    ]}
                  >
                    <View style={styles.typeBox}>
                      <Text style={styles.typeLabel}>You write:</Text>
                      <Text style={[styles.typeCode, { color: textColor }]}>Dinner - 450</Text>
                    </View>
                    <MaterialCommunityIcons name="arrow-right" size={18} color="#EF4444" />
                    <View style={styles.resultBox}>
                      <Text style={styles.resultLabel}>Result:</Text>
                      <Text style={[styles.resultRed, { color: '#EF4444' }]}>− ₹450</Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.exampleVisualRow,
                      { backgroundColor: isDarkMode ? '#3B131D' : '#FFFFFF' },
                    ]}
                  >
                    <View style={styles.typeBox}>
                      <Text style={styles.typeLabel}>You write:</Text>
                      <Text style={[styles.typeCode, { color: textColor }]}>Tea -20</Text>
                    </View>
                    <MaterialCommunityIcons name="arrow-right" size={18} color="#EF4444" />
                    <View style={styles.resultBox}>
                      <Text style={styles.resultLabel}>Result:</Text>
                      <Text style={[styles.resultRed, { color: '#EF4444' }]}>− ₹20</Text>
                    </View>
                  </View>
                </View>

                {/* HELPFUL DAILY TRICKS */}
                <Text style={[styles.mainSectionTitle, { color: textColor, marginTop: 4 }]}>
                  Helpful Everyday Features:
                </Text>

                <View
                  style={[
                    styles.tipsContainer,
                    {
                      backgroundColor: isDarkMode ? '#1A2234' : '#F8FAFC',
                      borderColor: rowBorder,
                    },
                  ]}
                >
                  {/* Tip 1: Math calculation */}
                  <View style={styles.tipRow}>
                    <View
                      style={[
                        styles.tipIconCircle,
                        { backgroundColor: isDarkMode ? '#1E293B' : '#EFF6FF' },
                      ]}
                    >
                      <MaterialCommunityIcons name="calculator" size={18} color="#3B82F6" />
                    </View>
                    <View style={styles.tipContent}>
                      <Text style={[styles.tipTitle, { color: textColor }]}>
                        ⚡ Automatic Math (Multiplication & Plus)
                      </Text>
                      <Text style={[styles.tipText, { color: textMuted }]}>
                        Buying 5 items at ₹100? Just write <Text style={styles.boldSnippet}>100*5</Text> ➔ gives <Text style={{ color: '#10B981', fontWeight: '700' }}>+ ₹500</Text>.
                        {'\n'}Adding two bills? Write <Text style={styles.boldSnippet}>1000 + 200</Text> ➔ gives <Text style={{ color: '#10B981', fontWeight: '700' }}>+ ₹1,200</Text>.
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.tipDivider, { backgroundColor: rowBorder }]} />

                  {/* Tip 2: Units like kg, litre, gram */}
                  <View style={styles.tipRow}>
                    <View
                      style={[
                        styles.tipIconCircle,
                        { backgroundColor: isDarkMode ? '#241433' : '#F5F3FF' },
                      ]}
                    >
                      <MaterialCommunityIcons name="scale" size={18} color="#8B5CF6" />
                    </View>
                    <View style={styles.tipContent}>
                      <Text style={[styles.tipTitle, { color: textColor }]}>
                        ⚖️ Weights and Quantities (kg, Litre, Gram)
                      </Text>
                      <Text style={[styles.tipText, { color: textMuted }]}>
                        You can freely write units! <Text style={styles.boldSnippet}>Rice 25kg 1200</Text> or <Text style={styles.boldSnippet}>Milk 2L -60</Text>. The app automatically knows the last number is your money!
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.tipDivider, { backgroundColor: rowBorder }]} />

                  {/* Tip 3: Plain notes */}
                  <View style={styles.tipRow}>
                    <View
                      style={[
                        styles.tipIconCircle,
                        { backgroundColor: isDarkMode ? '#2D2006' : '#FEF3C7' },
                      ]}
                    >
                      <MaterialCommunityIcons name="format-title" size={18} color="#F59E0B" />
                    </View>
                    <View style={styles.tipContent}>
                      <Text style={[styles.tipTitle, { color: textColor }]}>
                        📝 Headings & Plain Notes
                      </Text>
                      <Text style={[styles.tipText, { color: textMuted }]}>
                        Lines without numbers (like <Text style={styles.boldSnippet}>Trip to Village</Text> or <Text style={styles.boldSnippet}>Shopping List</Text>) stay as clean notes with no calculation.
                      </Text>
                    </View>
                  </View>
                </View>

                {/* REAL-LIFE EXAMPLES LIST */}
                <Text style={[styles.mainSectionTitle, { color: textColor, marginTop: 4 }]}>
                  Daily Life Examples:
                </Text>

                <View style={[styles.examplesList, { borderColor: rowBorder }]}>
                  {EASY_EXAMPLES.map((item, idx) => {
                    const isIncome = item.type === 'income';
                    const isExpense = item.type === 'expense';
                    const isNote = item.type === 'note';

                    const badgeBg = isIncome
                      ? isDarkMode ? '#064E3B' : '#ECFDF5'
                      : isExpense
                        ? isDarkMode ? '#4C0519' : '#FFF1F2'
                        : isDarkMode ? '#1E293B' : '#F1F5F9';

                    const badgeBorder = isIncome
                      ? isDarkMode ? '#065F46' : '#A7F3D0'
                      : isExpense
                        ? isDarkMode ? '#881337' : '#FECDD3'
                        : isDarkMode ? '#334155' : '#CBD5E1';

                    const badgeColor = isIncome
                      ? isDarkMode ? '#34D399' : '#059669'
                      : isExpense
                        ? isDarkMode ? '#FB7185' : '#E11D48'
                        : textMuted;

                    return (
                      <View
                        key={idx}
                        style={[
                          styles.exampleRow,
                          {
                            borderBottomColor: rowBorder,
                            borderBottomWidth: idx === EASY_EXAMPLES.length - 1 ? 0 : 1,
                            backgroundColor: idx % 2 === 0
                              ? isDarkMode ? '#141C2B' : '#FAFAFA'
                              : 'transparent',
                          },
                        ]}
                      >
                        <View style={styles.exampleLeft}>
                          <View style={styles.exampleHeaderRow}>
                            <MaterialCommunityIcons
                              name={item.icon}
                              size={15}
                              color={isIncome ? '#10B981' : isExpense ? '#EF4444' : textMuted}
                              style={{ marginRight: 6 }}
                            />
                            <View style={[styles.codeBadge, { backgroundColor: codeBg }]}>
                              <Text style={[styles.codeText, { color: textColor }]}>
                                {item.input}
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.exampleMeaning, { color: textMuted }]}>
                            {item.meaning}
                          </Text>
                        </View>

                        <View style={styles.exampleRight}>
                          <View
                            style={[
                              styles.resultBadge,
                              {
                                backgroundColor: badgeBg,
                                borderColor: badgeBorder,
                              },
                            ]}
                          >
                            <Text style={[styles.resultBadgeText, { color: badgeColor }]}>
                              {item.result}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* BOTTOM SUMMARY CARD EXPLANATION */}
                <View
                  style={[
                    styles.summaryHelpBox,
                    {
                      backgroundColor: isDarkMode ? '#162032' : '#F0F9FF',
                      borderColor: isDarkMode ? '#1E3A8A' : '#BAE6FD',
                    },
                  ]}
                >
                  <Text style={[styles.summaryHelpTitle, { color: textColor }]}>
                    What the Cards at the Bottom Mean:
                  </Text>

                  <View style={styles.summaryHelpItem}>
                    <Text style={styles.summaryHelpIcon}>🟢</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.summaryHelpHeading, { color: '#10B981' }]}>
                        Money In
                      </Text>
                      <Text style={[styles.summaryHelpText, { color: textMuted }]}>
                        Total money you got, earned, or received.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.summaryHelpItem}>
                    <Text style={styles.summaryHelpIcon}>🔴</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.summaryHelpHeading, { color: '#EF4444' }]}>
                        Money Out
                      </Text>
                      <Text style={[styles.summaryHelpText, { color: textMuted }]}>
                        Total money you spent, bought, or paid out.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.summaryHelpItem}>
                    <Text style={styles.summaryHelpIcon}>⚖️</Text>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.summaryHelpHeading,
                          { color: isDarkMode ? '#60A5FA' : (Colors.primary || '#2563EB') },
                        ]}
                      >
                        Remaining Balance
                      </Text>
                      <Text style={[styles.summaryHelpText, { color: textMuted }]}>
                        Money In minus Money Out (what is left in your pocket):
                        {'\n'}• If <Text style={{ color: '#10B981', fontWeight: '700' }}>Green</Text>: You saved money! 🎉
                        {'\n'}• If <Text style={{ color: '#EF4444', fontWeight: '700' }}>Red</Text>: You spent more than you earned.
                      </Text>
                    </View>
                  </View>
                </View>
              </ScrollView>

              {/* Bottom Footer Actions */}
              <View style={[styles.footer, { borderTopColor: rowBorder }]}>
                <TouchableOpacity
                  style={[styles.insertBtn, { backgroundColor: Colors.primary || '#3B82F6' }]}
                  onPress={() => {
                    if (onInsertTemplate) {
                      onInsertTemplate(SAMPLE_SMART_NOTEPAD_TEXT);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="content-paste" size={17} color="#FFF" />
                  <Text style={styles.insertBtnText}>Try Sample in Notepad</Text>
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
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: Platform.OS === 'web' ? '88vh' : '88%',
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  headerIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16.5,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12.5,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 14,
  },
  mainSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  simpleRuleCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    gap: 10,
  },
  ruleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rulePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  rulePillText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  ruleCardTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    flex: 1,
  },
  ruleExplanationText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  exampleVisualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  typeBox: {
    flex: 1,
  },
  typeLabel: {
    fontSize: 10,
    color: '#64748B',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  typeCode: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  resultBox: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  resultLabel: {
    fontSize: 10,
    color: '#64748B',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  resultGreen: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  resultRed: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  tipsContainer: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tipIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  tipContent: {
    flex: 1,
    gap: 3,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  tipText: {
    fontSize: 12,
    lineHeight: 18,
  },
  boldSnippet: {
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  tipDivider: {
    height: 1,
    width: '100%',
  },
  examplesList: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  exampleLeft: {
    flex: 1,
    gap: 3,
  },
  exampleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codeText: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
  },
  exampleMeaning: {
    fontSize: 11.5,
    marginLeft: 2,
  },
  exampleRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  resultBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  resultBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  summaryHelpBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  summaryHelpTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryHelpItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  summaryHelpIcon: {
    fontSize: 14,
    marginTop: 1,
  },
  summaryHelpHeading: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  summaryHelpText: {
    fontSize: 11.5,
    lineHeight: 17,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 18,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  insertBtn: {
    flex: 1.4,
    height: 44,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  insertBtnText: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  closeFooterBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeFooterBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
});
