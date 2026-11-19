import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatLedgerAmount } from '../utils/paperLedgerUtils';

const LINE_HEIGHT = 40;

export default function QlateNotepadSheet({
  text,
  onChangeText,
  evaluatedDoc,
  textInputRef,
  isDarkMode,
  textColor,
  textMuted,
  rowDividerColor,
  colDividerColor,
  tableHeaderBg,
  cardBg,
}) {
  const lines = evaluatedDoc.lines || [];
  const lineCount = Math.max(lines.length, 6); // Keep at least 6 ruled lines visible for an inviting pad

  // Ensure line numbers and result rows match at least lineCount
  const displayLineCount = Math.max(lines.length, 6);
  const displayLines = Array.from({ length: displayLineCount }, (_, idx) => {
    return lines[idx] || { lineNum: idx + 1, amount: null, resultText: '' };
  });

  return (
    <View style={styles.sheetWrapper}>
      {/* Table Column Header: Line # | Notepad (Left ~70%) | Results (Right ~30%) */}
      <View
        style={[
          styles.tableHeader,
          {
            backgroundColor: tableHeaderBg,
            borderBottomColor: rowDividerColor,
          },
        ]}
      >
        <View style={[styles.headerColNum, { borderRightColor: colDividerColor }]}>
          <Text style={[styles.headerLabel, { color: textMuted }]}>#</Text>
        </View>

        <View style={[styles.headerColNote, { borderRightColor: colDividerColor }]}>
          <Text style={[styles.headerLabel, { color: textMuted }]}>
            NOTE / CALCULATION (TYPE FREELY)
          </Text>
        </View>

        <View style={styles.headerColResult}>
          <Text style={[styles.headerLabelRight, { color: textMuted }]}>
            RESULT (₹)
          </Text>
        </View>
      </View>

      {/* Main Parallel Notepad Body */}
      <View style={[styles.sheetBody, { backgroundColor: cardBg }]}>
        {/* Far Left: Line Numbers Gutter */}
        <View style={[styles.gutterCol, { borderRightColor: colDividerColor }]}>
          {displayLines.map((lineItem, idx) => {
            const hasContent = idx < lines.length && (lines[idx].text || '').trim().length > 0;
            const lineNumStr = idx + 1 < 10 ? `0${idx + 1}` : `${idx + 1}`;
            return (
              <View
                key={`num_${idx}`}
                style={[
                  styles.lineCell,
                  { height: LINE_HEIGHT, borderBottomColor: rowDividerColor },
                ]}
              >
                <Text
                  style={[
                    styles.lineNumText,
                    {
                      color: hasContent
                        ? (isDarkMode ? '#8E9FB8' : '#64748B')
                        : (isDarkMode ? '#334155' : '#CBD5E1'),
                      fontWeight: hasContent ? '700' : '400',
                    },
                  ]}
                >
                  {lineNumStr}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Center: Continuous Multiline Text Document */}
        <View style={[styles.textCol, { borderRightColor: colDividerColor }]}>
          {/* Subtle background ruled horizontal lines */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {displayLines.map((_, idx) => (
              <View
                key={`rule_${idx}`}
                style={[
                  styles.ruledGuideline,
                  { height: LINE_HEIGHT, borderBottomColor: rowDividerColor },
                ]}
              />
            ))}
          </View>

          <TextInput
            ref={textInputRef}
            multiline
            scrollEnabled={false}
            textAlignVertical="top"
            value={text}
            onChangeText={onChangeText}
            placeholder={`Type notes and calculations here...\nDinner 450\nSalary +50000\nGrocery Mart 100+25\nElectricity Bill 1200`}
            placeholderTextColor={isDarkMode ? '#475569' : '#94A3B8'}
            style={[
              styles.multilineInput,
              {
                color: textColor,
                minHeight: displayLineCount * LINE_HEIGHT,
              },
            ]}
          />
        </View>

        {/* Right Margin: Parallel Live Calculation Results Column */}
        <View style={styles.resultsCol}>
          {displayLines.map((lineItem, idx) => {
            const isEvaluated = idx < lines.length && lines[idx].amount !== null;
            const item = lines[idx];
            const isIncome = item && item.type === 'income';

            return (
              <View
                key={`res_${idx}`}
                style={[
                  styles.lineCellResult,
                  { height: LINE_HEIGHT, borderBottomColor: rowDividerColor },
                ]}
              >
                {isEvaluated ? (
                  <View
                    style={[
                      styles.resultPill,
                      {
                        backgroundColor: isIncome
                          ? (isDarkMode ? '#064E3B' : '#ECFDF5')
                          : (isDarkMode ? '#4C0519' : '#FFF1F2'),
                        borderColor: isIncome
                          ? (isDarkMode ? '#065F46' : '#A7F3D0')
                          : (isDarkMode ? '#881337' : '#FECDD3'),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.resultPillText,
                        {
                          color: isIncome
                            ? (isDarkMode ? '#34D399' : '#059669')
                            : (isDarkMode ? '#FB7185' : '#E11D48'),
                        },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {item.resultText}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetWrapper: {
    width: '100%',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    height: 38,
  },
  headerColNum: {
    width: 44,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
  },
  headerColNote: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    paddingLeft: 12,
    borderRightWidth: 1,
  },
  headerColResult: {
    width: 116,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 12,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  headerLabelRight: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  sheetBody: {
    flexDirection: 'row',
    alignItems: 'stretch',
    position: 'relative',
  },
  gutterCol: {
    width: 44,
    borderRightWidth: 1,
  },
  textCol: {
    flex: 1,
    borderRightWidth: 1,
    position: 'relative',
  },
  resultsCol: {
    width: 116,
  },
  lineCell: {
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  lineCellResult: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 10,
    borderBottomWidth: 1,
  },
  lineNumText: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  ruledGuideline: {
    borderBottomWidth: 1,
  },
  multilineInput: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: LINE_HEIGHT,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 12,
    margin: 0,
    ...Platform.select({
      android: {
        includeFontPadding: false,
      },
    }),
  },
  resultPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    maxWidth: 104,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  resultPillText: {
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
