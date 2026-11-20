import React, { useRef, useImperativeHandle, forwardRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
} from 'react-native';

function QlateNotepadSheet(
  {
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
  },
  ref
) {
  const [focusedIndex, setFocusedIndex] = useState(null);
  const inputRefs = useRef([]);

  const rawLines = (text || '').split('\n');
  const evaluatedLines = (evaluatedDoc && evaluatedDoc.lines) || [];

  // Maintain at least 8 compact ruled lines for the open notebook stationery look
  const displayLineCount = Math.max(rawLines.length, 8);

  // Expose focus() to external refs if needed
  const forwardedRef = ref || textInputRef;
  useImperativeHandle(forwardedRef, () => ({
    focus: () => {
      let targetIdx = rawLines.length - 1;
      if (targetIdx < 0) targetIdx = 0;
      if (rawLines[targetIdx] && rawLines[targetIdx].trim().length > 0) {
        const nextLines = [...rawLines, ''];
        onChangeText(nextLines.join('\n'));
        targetIdx = nextLines.length - 1;
      }
      setTimeout(() => {
        inputRefs.current[targetIdx]?.focus();
      }, 50);
    },
  }));

  const handleLineChange = (index, newVal) => {
    if (newVal.includes('\n')) {
      const parts = newVal.split('\n');
      const currentLines = (text || '').split('\n');
      while (currentLines.length <= index) {
        currentLines.push('');
      }
      currentLines.splice(index, 1, ...parts);
      onChangeText(currentLines.join('\n'));

      const nextIndex = index + parts.length - 1;
      setTimeout(() => {
        inputRefs.current[nextIndex]?.focus();
      }, 30);
      return;
    }

    const currentLines = (text || '').split('\n');
    while (currentLines.length <= index) {
      currentLines.push('');
    }
    currentLines[index] = newVal;
    onChangeText(currentLines.join('\n'));
  };

  const handleKeyPress = (index, e) => {
    if (e?.nativeEvent?.key === 'Backspace') {
      const currentLines = (text || '').split('\n');
      if (currentLines[index] === '' && currentLines.length > 1) {
        currentLines.splice(index, 1);
        onChangeText(currentLines.join('\n'));
        const prevIdx = Math.max(0, index - 1);
        setTimeout(() => {
          inputRefs.current[prevIdx]?.focus();
        }, 30);
      }
    }
  };

  return (
    <View style={styles.sheetWrapper}>
      {/* Compact Table Header: NOTE / CALCULATION | AMOUNT */}
      <View
        style={[
          styles.tableHeader,
          {
            backgroundColor: tableHeaderBg,
            borderBottomColor: rowDividerColor,
          },
        ]}
      >
        <View style={styles.headerColNote}>
          <Text style={[styles.headerLabel, { color: textMuted }]}>
            NOTE / CALCULATION
          </Text>
        </View>

        <View style={styles.headerColResult}>
          <Text style={[styles.headerLabelRight, { color: textMuted }]}>
            AMOUNT (₹)
          </Text>
        </View>
      </View>

      {/* Main Ruled Rows: Tight, equal line height, single-line horizontal alignment */}
      <View style={[styles.sheetBody, { backgroundColor: cardBg }]}>
        {Array.from({ length: displayLineCount }).map((_, idx) => {
          const lineValue = rawLines[idx] !== undefined ? rawLines[idx] : '';
          const evalItem = idx < evaluatedLines.length ? evaluatedLines[idx] : null;
          const isEvaluated = evalItem && evalItem.amount !== null;
          const isIncome = evalItem && evalItem.type === 'income';
          const isFocused = focusedIndex === idx;

          return (
            <View
              key={`paragraph_row_${idx}`}
              style={[
                styles.paragraphRow,
                {
                  borderBottomColor: rowDividerColor,
                  backgroundColor: isFocused
                    ? (isDarkMode ? 'rgba(59, 130, 246, 0.08)' : 'rgba(37, 99, 235, 0.04)')
                    : 'transparent',
                },
              ]}
            >
              {/* Left Column: Note / Math Expression */}
              <View style={styles.noteInputWrapper}>
                <TextInput
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  multiline
                  numberOfLines={1}
                  scrollEnabled={false}
                  value={lineValue}
                  onChangeText={(val) => handleLineChange(idx, val)}
                  onKeyPress={(e) => handleKeyPress(idx, e)}
                  onFocus={() => setFocusedIndex(idx)}
                  onBlur={() => setFocusedIndex((prev) => (prev === idx ? null : prev))}
                  placeholder={
                    idx === 0 && !text
                      ? 'Type note & calculation, e.g. Dinner -450'
                      : ''
                  }
                  placeholderTextColor={isDarkMode ? '#475569' : '#94A3B8'}
                  style={[
                    styles.noteInput,
                    {
                      color: textColor,
                    },
                  ]}
                />
              </View>

              {/* Right Column: Amount text on the exact same horizontal baseline */}
              <View style={styles.resultColWrapper}>
                {isEvaluated ? (
                  <Text
                    style={[
                      styles.resultText,
                      {
                        color: isIncome
                          ? (isDarkMode ? '#34D399' : '#059669')
                          : (isDarkMode ? '#FB7185' : '#E11D48'),
                      },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {evalItem.resultText}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default forwardRef(QlateNotepadSheet);

const styles = StyleSheet.create({
  sheetWrapper: {
    width: '100%',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    height: 32,
  },
  headerColNote: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    paddingLeft: 10,
  },
  headerColResult: {
    width: 80,
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
    position: 'relative',
  },
  paragraphRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 32,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  noteInputWrapper: {
    flex: 1,
    paddingRight: 6,
    justifyContent: 'center',
  },
  noteInput: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 20,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    margin: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        fieldSizing: 'content',
        height: 'auto',
        minHeight: 20,
        overflow: 'hidden',
        resize: 'none',
      },
      android: {
        includeFontPadding: false,
        paddingTop: 0,
        paddingBottom: 0,
        textAlignVertical: 'center',
      },
      ios: {
        paddingTop: 0,
        paddingBottom: 0,
      },
    }),
  },
  resultColWrapper: {
    width: 80,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  resultText: {
    fontSize: 12.5,
    fontWeight: '700',
    lineHeight: 20,
    letterSpacing: 0.2,
    textAlign: 'right',
    paddingTop: 0,
    paddingBottom: 0,
    margin: 0,
  },
});
