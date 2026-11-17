import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function PaperSwipeableRow({
  item,
  index,
  isIncome,
  formatLedgerAmount,
  onRequestDelete,
  onRequestEdit,
  paperBg,
  ruledLineColor,
  redMarginLine,
  textColor,
  textMuted,
  isDarkMode,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  onLongPress,
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
        // Disable swipe gesture in selection mode
        if (isSelectionMode) return false;
        // Only claim gesture if horizontal movement is dominant
        return (
          Math.abs(gestureState.dx) > 15 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5
        );
      },
      onPanResponderMove: (_, gestureState) => {
        pan.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        const absDx = Math.abs(gestureState.dx);
        const absVx = Math.abs(gestureState.vx);
        if (absDx > 40 || absVx > 0.3) {
          if (gestureState.dx > 0) {
            // Swiping right reveals left delete action
            Animated.spring(pan, {
              toValue: 80,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
            onRequestDelete && onRequestDelete(item, resetPosition);
          } else {
            // Swiping left reveals right edit action
            Animated.spring(pan, {
              toValue: -80,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
            onRequestEdit && onRequestEdit(item, resetPosition);
          }
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
  const effectiveBg = isSelected
    ? isDarkMode
      ? '#1C2940'
      : '#EBF3FF'
    : paperBg;

  // Render row content
  const rowContent = (
    <>
      {/* 75% Left: Checkbox (if selection mode), Serial, Description, Badge */}
      <View
        style={[
          styles.col75,
          styles.cell75,
          { borderRightColor: redMarginLine },
        ]}
      >
        <View style={styles.rowMain}>
          {isSelectionMode && (
            <MaterialCommunityIcons
              name={isSelected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
              size={20}
              color={isSelected ? '#3B82F6' : textMuted}
              style={{ marginRight: 6 }}
            />
          )}

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
    </>
  );

  return (
    <View style={[styles.container, { borderBottomColor: ruledLineColor }]}>
      {/* Background reveal showing delete action on right swipe (left side) and edit action on left swipe (right side) */}
      {!isSelectionMode && (
        <View style={styles.backgroundActionsContainer}>
          <TouchableOpacity
            style={styles.leftDeleteIndicator}
            onPress={() => onRequestDelete && onRequestDelete(item, resetPosition)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={20} color="#FFF" />
            <Text style={styles.actionText}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rightEditIndicator}
            onPress={() => onRequestEdit && onRequestEdit(item, resetPosition)}
            activeOpacity={0.8}
          >
            <Text style={styles.actionText}>Edit</Text>
            <MaterialCommunityIcons name="pencil" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Foreground paper row */}
      {isSelectionMode ? (
        <TouchableOpacity
          style={[
            styles.rowForeground,
            {
              backgroundColor: effectiveBg,
            },
          ]}
          onPress={() => onToggleSelect && onToggleSelect(item.id)}
          activeOpacity={0.7}
        >
          {rowContent}
        </TouchableOpacity>
      ) : (
        <Animated.View
          style={[
            styles.rowForeground,
            {
              backgroundColor: effectiveBg,
              transform: [{ translateX: pan }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity
            style={styles.touchableWrapper}
            onLongPress={() => onLongPress && onLongPress(item.id)}
            delayLongPress={300}
            activeOpacity={0.9}
          >
            {rowContent}
          </TouchableOpacity>
        </Animated.View>
      )}
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
  backgroundActionsContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  leftDeleteIndicator: {
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 18,
    width: '50%',
    gap: 6,
  },
  rightEditIndicator: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
    width: '50%',
    gap: 6,
  },
  actionText: {
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
  touchableWrapper: {
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
