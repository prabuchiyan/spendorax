import React, { useRef, useImperativeHandle, forwardRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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

  // Maintain at least 6 ruled lines for the open notebook look
  const displayLineCount = Math.max(rawLines.length, 6);

  // Expose focus() to external refs (e.g. pencil FAB)
  const forwardedRef = ref || textInputRef;
  useImperativeHandle(forwardedRef, () => ({
    focus: () => {
      let targetIdx = rawLines.length - 1;
      if (targetIdx < 0) targetIdx = 0;
      // If the last line already has text, append a new line
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
      // User pressed Enter on keyboard or pasted multiline text
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
      // If the line is empty and document has more than 1 line, delete line and focus previous
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

  const handleAddLine = () => {
    const currentLines = (text || '').split('\n');
    currentLines.push('');
    onChangeText(currentLines.join('\n'));
    const nextIdx = currentLines.length - 1;
    setTimeout(() => {
      inputRefs.current[nextIdx]?.focus();
    }, 50);
  };

  return (
    <View style={styles.sheetWrapper}>
      {/* Table Column Header: NOTE / CALCULATION (PARAGRAPH) on Left | = AMOUNT on Right */}
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
            NOTE / CALCULATION (PARAGRAPH)
          </Text>
        </View>

        <View style={styles.headerColResult}>
          <Text style={[styles.headerLabelRight, { color: textMuted }]}>
            = AMOUNT
          </Text>
        </View>
      </View>

      {/* Main Ruled Rows: Each transaction is a single paragraph row */}
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
              {/* Left Column: Note and Math Expression (Wraps freely as a single paragraph) */}
              <View style={styles.noteInputWrapper}>
                <TextInput
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  multiline
                  scrollEnabled={false}
                  textAlignVertical="center"
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

              {/* Right Column: Inline Equals Sign and Amount Pill (Attached to THIS paragraph) */}
              <View style={styles.resultColWrapper}>
                {isEvaluated ? (
                  <View style={styles.resultInner}>
                    <Text
                      style={[
                        styles.equalsSymbol,
                        { color: isDarkMode ? '#94A3B8' : '#64748B' },
                      ]}
                    >
                      =
                    </Text>
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
                        {evalItem.resultText}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}

        {/* Add Line Action Button */}
        <TouchableOpacity
          style={[
            styles.addLineBtn,
            {
              borderTopColor: rowDividerColor,
            },
          ]}
          onPress={handleAddLine}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="plus-circle-outline"
            size={16}
            color={isDarkMode ? '#60A5FA' : '#2563EB'}
            style={styles.addLineIcon}
          />
          <Text
            style={[
              styles.addLineText,
              { color: isDarkMode ? '#60A5FA' : '#2563EB' },
            ]}
          >
            Add Line
          </Text>
        </TouchableOpacity>
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
    height: 38,
  },
  headerColNote: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    paddingLeft: 12,
  },
  headerColResult: {
    width: 96,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 10,
  },
  headerLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  headerLabelRight: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  sheetBody: {
    position: 'relative',
  },
  paragraphRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    minHeight: 44,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  noteInputWrapper: {
    flex: 1,
    paddingRight: 8,
    justifyContent: 'center',
  },
  noteInput: {
    fontSize: 13.5,
    fontWeight: '500',
    lineHeight: 20,
    paddingTop: 2,
    paddingBottom: 2,
    paddingHorizontal: 0,
    margin: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
      android: {
        includeFontPadding: false,
      },
    }),
  },
  resultColWrapper: {
    width: 96,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  resultInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  equalsSymbol: {
    fontSize: 13,
    fontWeight: '700',
    marginRight: 4,
  },
  resultPill: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    maxWidth: 78,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  resultPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  addLineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addLineIcon: {
    marginRight: 6,
  },
  addLineText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
});
