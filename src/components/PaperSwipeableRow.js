import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function PaperSwipeableRow({
  item,
  index,
  isIncome,
  formatLedgerAmount,
  onRequestDelete,
  paperBg,
  ruledLineColor,
  redMarginLine,
  textColor,
  textMuted,
  isDarkMode,
}) {
  const pan = useRef(new Animated.Value(0)).current;

  const resetPosition = () => {
    Animated.spring(pan, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 6,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only claim gesture if horizontal movement is dominant
        return (
          Math.abs(gestureState.dx) > 15 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5
        );
      },
      onPanResponderMove: (_, gestureState) => {
        // Direct tracking with subtle resistance for large gestures
        pan.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > 75) {
          // Threshold reached: trigger confirmation warning
          onRequestDelete(item, resetPosition);
        } else {
          resetPosition();
        }
      },
      onPanResponderTerminate: () => {
        resetPosition();
      },
    })
  ).current;

  const serialNo = `${index + 1}) `;

  return (
    <View style={[styles.container, { borderBottomColor: ruledLineColor }]}>
      {/* Background reveal showing delete actions on both left and right swipe */}
      <View style={styles.backgroundDelete}>
        <View style={styles.leftDeleteIndicator}>
          <MaterialCommunityIcons name="trash-can-outline" size={20} color="#FFF" />
          <Text style={styles.deleteText}>Delete</Text>
        </View>
        <View style={styles.rightDeleteIndicator}>
          <Text style={styles.deleteText}>Delete</Text>
          <MaterialCommunityIcons name="trash-can-outline" size={20} color="#FFF" />
        </View>
      </View>

      {/* Foreground paper row */}
      <Animated.View
        style={[
          styles.rowForeground,
          {
            backgroundColor: paperBg,
            transform: [{ translateX: pan }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* 75% Left: Serial, Description, Badge */}
        <View
          style={[
            styles.col75,
            styles.cell75,
            { borderRightColor: redMarginLine },
          ]}
        >
          <View style={styles.rowMain}>
            <Text style={[styles.serialText, { color: textMuted }]}>
              {serialNo}
            </Text>
            <View style={{ flex: 1, paddingRight: 4 }}>
              <Text
                style={[styles.itemTitle, { color: textColor }]}
                numberOfLines={2}
              >
                {item.title}
              </Text>
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.typeBadge,
                    {
                      backgroundColor: isIncome
                        ? isDarkMode
                          ? '#0A3324'
                          : '#E6F9F0'
                        : isDarkMode
                        ? '#3B171C'
                        : '#FEECEC',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.typeBadgeText,
                      { color: isIncome ? '#10B981' : '#EF4444' },
                    ]}
                  >
                    {isIncome ? '+ Income' : '- Expense'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* 25% Right: Amount Only */}
        <View style={[styles.col25, styles.cell25]}>
          <Text
            style={[
              styles.amountText,
              { color: isIncome ? '#10B981' : '#EF4444' },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {isIncome ? '+' : '-'}
            {formatLedgerAmount(item.amount)}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderBottomWidth: 1,
    minHeight: 52,
    overflow: 'hidden',
  },
  backgroundDelete: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  leftDeleteIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rightDeleteIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deleteText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rowForeground: {
    flexDirection: 'row',
    width: '100%',
    minHeight: 52,
  },
  col75: {
    width: '75%',
    borderRightWidth: 1.5,
  },
  col25: {
    width: '25%',
  },
  cell75: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  cell25: {
    paddingVertical: 8,
    paddingLeft: 2,
    paddingRight: 8,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serialText: {
    fontSize: 13,
    fontWeight: '700',
    width: 24,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  amountText: {
    fontSize: 13.5,
    fontWeight: '700',
    textAlign: 'right',
  },
});
