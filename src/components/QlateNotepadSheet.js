import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
} from 'react-native';

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

  // Ensure result rows match at least lineCount
  const displayLineCount = Math.max(lines.length, 6);
  const displayLines = Array.from({ length: displayLineCount }, (_, idx) => {
    return lines[idx] || { lineNum: idx + 1, amount: null, resultText: '' };
  });

  return (
    <View style={styles.sheetWrapper}>
      {/* Table Column Header: Notepad (Left ~80%) | Results (Right ~20%) - No row numbers gutter */}
      <View
        style={[
          styles.tableHeader,
          {
            backgroundColor: tableHeaderBg,
            borderBottomColor: rowDividerColor,
          },
        ]}
      >
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
        {/* Left: Continuous Multiline Text Document (Expanded Space like Qlate) */}
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

        {/* Right Margin: Parallel Live Calculation Results Column (Compact ~78px) */}
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
  headerColNote: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    paddingLeft: 10,
    borderRightWidth: 1,
  },
  headerColResult: {
    width: 78,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 8,
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
  textCol: {
    flex: 1,
    borderRightWidth: 1,
    position: 'relative',
  },
  resultsCol: {
    width: 78,
  },
  lineCellResult: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 6,
    borderBottomWidth: 1,
  },
  ruledGuideline: {
    borderBottomWidth: 1,
  },
  multilineInput: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: LINE_HEIGHT,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 8,
    margin: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        whiteSpace: 'pre',
        overflowX: 'auto',
      },
      android: {
        includeFontPadding: false,
      },
    }),
  },
  resultPill: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    maxWidth: 72,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  resultPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
