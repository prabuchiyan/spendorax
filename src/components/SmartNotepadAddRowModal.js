import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Colors } from './Theme';
import { evaluateMathExpression } from '../utils/mathExpressionParser';

export default function SmartNotepadAddRowModal({ visible, onClose, onAdd, initialItem = null }) {
  const { isDarkMode, theme } = useTheme();
  const [title, setTitle] = useState('');
  const [type, setType] = useState('expense'); // 'income' | 'expense'
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const isEditing = Boolean(initialItem);

  useEffect(() => {
    if (initialItem) {
      setTitle(initialItem.title || '');
      setType(initialItem.type || 'expense');
      setAmount(
        initialItem.formula
          ? String(initialItem.formula)
          : initialItem.amount !== undefined && initialItem.amount !== null
            ? String(initialItem.amount)
            : ''
      );
    } else {
      setTitle('');
      setType('expense');
      setAmount('');
    }
    setError('');
  }, [initialItem, visible]);

  // Live evaluation of amount or math expression
  const evalResult = useMemo(() => evaluateMathExpression(amount), [amount]);

  const handleInsertOperator = (op) => {
    if (op === 'C') {
      setAmount('');
      if (error) setError('');
      return;
    }
    const trimmed = (amount || '').trim();
    if (!trimmed) {
      if (op === '-' || op === '−') setAmount('-');
      else if (op === '(') setAmount('(');
      return;
    }
    if (op === '(') {
      const endsWithOp = /[+\-*/%−×÷]$/.test(trimmed);
      setAmount(endsWithOp ? `${trimmed} (` : `${trimmed} * (`);
      if (error) setError('');
      return;
    }
    if (op === ')') {
      setAmount(`${trimmed})`);
      if (error) setError('');
      return;
    }
    const endsWithOp = /[+\-*/%−×÷]$/.test(trimmed);
    if (endsWithOp) {
      setAmount(trimmed.slice(0, -1).trim() + ` ${op} `);
    } else {
      setAmount(`${trimmed} ${op} `);
    }
    if (error) setError('');
  };

  const handleAdd = () => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError('Please enter a description or note');
      return;
    }

    const evaluated = evaluateMathExpression(amount);
    if (!evaluated.isValid || evaluated.result === null || evaluated.result <= 0) {
      setError(
        evaluated.error
          ? evaluated.error
          : 'Please enter a valid amount or formula greater than 0'
      );
      return;
    }

    const payload = {
      title: trimmedTitle,
      type,
      amount: evaluated.result,
      formula: evaluated.hasOperator ? amount.trim() : null,
    };

    if (initialItem && initialItem.id) {
      payload.id = initialItem.id;
    }

    onAdd(payload);

    // Reset and close
    setTitle('');
    setAmount('');
    setType('expense');
    setError('');
    onClose();
  };

  const handleCancel = () => {
    setTitle('');
    setAmount('');
    setError('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <TouchableWithoutFeedback onPress={handleCancel}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={[
                styles.card,
                {
                  backgroundColor: isDarkMode ? '#1E232E' : '#FFFFFF',
                  borderColor: isDarkMode ? '#2E384D' : '#E2E8F0',
                },
              ]}
            >
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                  <MaterialCommunityIcons
                    name={isEditing ? 'pencil-box-outline' : 'notebook-edit'}
                    size={22}
                    color={isEditing ? '#3B82F6' : Colors.primary}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.title, { color: theme.textPrimary }]}>
                    {isEditing ? 'Edit Paper Entry' : 'Add Paper Entry'}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <MaterialCommunityIcons name="close" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Type Toggle: Income vs Expense */}
              <View style={[styles.typeContainer, { backgroundColor: isDarkMode ? '#151922' : '#F1F5F9' }]}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    type === 'expense' && styles.typeButtonActiveExpense,
                  ]}
                  onPress={() => setType('expense')}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name="arrow-down-bold"
                    size={16}
                    color={type === 'expense' ? '#FFF' : '#EF4444'}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.typeText,
                      { color: type === 'expense' ? '#FFF' : theme.textSecondary },
                    ]}
                  >
                    Expense (-)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    type === 'income' && styles.typeButtonActiveIncome,
                  ]}
                  onPress={() => setType('income')}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name="arrow-up-bold"
                    size={16}
                    color={type === 'income' ? '#FFF' : '#10B981'}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.typeText,
                      { color: type === 'income' ? '#FFF' : theme.textSecondary },
                    ]}
                  >
                    Income (+)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Description Input */}
              <Text style={[styles.label, { color: theme.textSecondary }]}>Description / Name</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDarkMode ? '#12161F' : '#F8FAFC',
                    borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                    color: theme.textPrimary,
                  },
                ]}
                placeholder="e.g. Salary, Groceries, Rent..."
                placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
                value={title}
                onChangeText={(t) => {
                  setTitle(t);
                  if (error) setError('');
                }}
                autoFocus
              />

              {/* Amount Label and Operator Strip */}
              <View style={styles.amountHeaderRow}>
                <Text style={[styles.label, { color: theme.textSecondary, marginBottom: 0 }]}>
                  Amount (₹) or Formula
                </Text>
                <Text style={[styles.amountHint, { color: theme.textSecondary }]}>
                  e.g. 100 + 25, 100 * 5, 100 % 25
                </Text>
              </View>

              {/* Quick Math Operators Strip */}
              <View style={styles.operatorStrip}>
                {['+', '−', '×', '÷', '%', '(', ')', 'C'].map((op) => (
                  <TouchableOpacity
                    key={op}
                    style={[
                      styles.operatorButton,
                      {
                        backgroundColor:
                          op === 'C'
                            ? isDarkMode
                              ? '#3A1E24'
                              : '#FEE2E2'
                            : isDarkMode
                              ? '#1E283A'
                              : '#EFF6FF',
                        borderColor:
                          op === 'C'
                            ? '#EF4444'
                            : isDarkMode
                              ? '#334155'
                              : '#BFDBFE',
                      },
                    ]}
                    onPress={() => handleInsertOperator(op)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.operatorButtonText,
                        {
                          color: op === 'C' ? '#EF4444' : Colors.primary,
                        },
                      ]}
                    >
                      {op}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDarkMode ? '#12161F' : '#F8FAFC',
                    borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                    color: theme.textPrimary,
                  },
                ]}
                placeholder="0.00 or e.g. 100 + 25"
                placeholderTextColor={isDarkMode ? '#64748B' : '#94A3B8'}
                value={amount}
                onChangeText={(a) => {
                  const sanitized = a.replace(/[^0-9.+−×÷*/%() ]/g, '');
                  setAmount(sanitized);
                  if (error) setError('');
                }}
                keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
              />

              {/* Live Evaluated Preview Badge */}
              {evalResult.isValid && evalResult.hasOperator && evalResult.result !== null && (
                <View
                  style={[
                    styles.evalPreviewRow,
                    {
                      backgroundColor: isDarkMode ? '#0F2C22' : '#ECFDF5',
                      borderColor: '#10B981',
                    },
                  ]}
                >
                  <MaterialCommunityIcons name="calculator-variant-outline" size={15} color="#10B981" />
                  <Text style={[styles.evalPreviewLabel, { color: isDarkMode ? '#A7F3D0' : '#065F46' }]}>
                    Evaluated:
                  </Text>
                  <Text style={styles.evalPreviewResult}>
                    ₹{evalResult.result.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </Text>
                </View>
              )}

              {/* Error text */}
              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {/* Actions */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[
                    styles.cancelButton,
                    {
                      borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                    },
                  ]}
                  onPress={handleCancel}
                >
                  <Text style={[styles.cancelText, { color: theme.textSecondary }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.addButton,
                    {
                      backgroundColor: isEditing
                        ? '#2563EB'
                        : type === 'income'
                          ? '#10B981'
                          : Colors.primary,
                    },
                  ]}
                  onPress={handleAdd}
                >
                  <MaterialCommunityIcons
                    name={isEditing ? 'content-save-outline' : 'plus'}
                    size={18}
                    color="#FFF"
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.addText}>
                    {isEditing ? 'Save Changes' : 'Add to Paper'}
                  </Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  typeContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  typeButtonActiveExpense: {
    backgroundColor: '#EF4444',
  },
  typeButtonActiveIncome: {
    backgroundColor: '#10B981',
  },
  typeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  amountHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 12,
    marginBottom: 6,
  },
  amountHint: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  operatorStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 4,
  },
  operatorButton: {
    flex: 1,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  operatorButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  evalPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  evalPreviewLabel: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  evalPreviewResult: {
    fontSize: 13,
    fontWeight: '800',
    color: '#10B981',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  addText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

