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
  rowDividerColor,
  columnDividerColor,
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
              toValue: 84,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
            onRequestDelete && onRequestDelete(item, resetPosition);
          } else {
            // Swiping left reveals right edit action
            Animated.spring(pan, {
              toValue: -84,
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

  const effectiveBg = isSelected
    ? (isDarkMode ? '#1C2940' : '#EBF3FF')
    : (paperBg || (isDarkMode ? '#131926' : '#FFFFFF'));

  const effectiveRowDivider = rowDividerColor || ruledLineColor || (isDarkMode ? '#1F293D' : '#F1F5F9');
  const effectiveColDivider = columnDividerColor || redMarginLine || (isDarkMode ? '#1F293D' : '#F1F5F9');

  const serialText = index + 1 < 10 ? `0${index + 1}` : `${index + 1}`;

  // Modern Fintech colors
  const badgeBg = isIncome
    ? (isDarkMode ? '#064E3B' : '#ECFDF5')
    : (isDarkMode ? '#4C0519' : '#FFF1F2');
  const badgeText = isIncome
    ? (isDarkMode ? '#34D399' : '#059669')
    : (isDarkMode ? '#FB7185' : '#E11D48');
  const amountColor = isIncome
    ? (isDarkMode ? '#34D399' : '#059669')
    : (isDarkMode ? '#FB7185' : '#E11D48');

  // Render row content
  const rowContent = (
    <>
      {/* 65% Left: Checkbox (if selection mode), Serial badge, Description, Type & Formula Badges */}
      <View
        style={[
          styles.col65,
          styles.cell65,
          { borderRightColor: effectiveColDivider },
        ]}
      >
        <View style={styles.rowMain}>
          {isSelectionMode ? (
            <MaterialCommunityIcons
              name={isSelected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
              size={20}
              color={isSelected ? '#3B82F6' : (textMuted || '#94A3B8')}
              style={{ marginRight: 8 }}
            />
          ) : (
            <View
              style={[
                styles.serialBadge,
                { backgroundColor: isDarkMode ? '#1C2433' : '#F1F5F9' },
              ]}
            >
              <Text
                style={[
                  styles.serialText,
                  { color: isDarkMode ? '#8E9FB8' : '#64748B' },
                ]}
              >
                {serialText}
              </Text>
            </View>
          )}

          <View style={{ flex: 1, paddingRight: 6 }}>
            <Text
              style={[styles.itemTitle, { color: textColor || (isDarkMode ? '#F8FAFC' : '#0F172A') }]}
            >
              {item.title}
            </Text>
            <View style={styles.badgeRow}>
              <View style={[styles.typeBadge, { backgroundColor: badgeBg }]}>
                <Text style={[styles.typeBadgeText, { color: badgeText }]}>
                  {isIncome ? '+ Inflow' : '− Outflow'}
                </Text>
              </View>

              {item.formula ? (
                <View
                  style={[
                    styles.formulaBadge,
                    {
                      backgroundColor: isDarkMode ? '#162238' : '#F1F5F9',
                      borderColor: isDarkMode ? '#243452' : '#CBD5E1',
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="calculator-variant-outline"
                    size={11}
                    color={isDarkMode ? '#60A5FA' : '#2563EB'}
                    style={{ marginRight: 3 }}
                  />
                  <Text
                    style={[styles.formulaBadgeText, { color: isDarkMode ? '#93C5FD' : '#2563EB' }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.formula}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </View>

      {/* 35% Right: Amount Only */}
      <View style={[styles.col35, styles.cell35]}>
        <Text
          style={[styles.amountText, { color: amountColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
        >
          {isIncome ? '+' : '−'}
          {formatLedgerAmount(item.amount)}
        </Text>
      </View>
    </>
  );

  return (
    <View style={[styles.container, { borderBottomColor: effectiveRowDivider }]}>
      {/* Background reveal showing delete action on right swipe (left side) and edit action on left swipe (right side) */}
      {!isSelectionMode && (
        <View style={styles.backgroundActionsContainer}>
          <TouchableOpacity
            style={[
              styles.leftDeleteIndicator,
              { backgroundColor: isDarkMode ? '#3B121C' : '#FEE2E2' },
            ]}
            onPress={() => onRequestDelete && onRequestDelete(item, resetPosition)}
            activeOpacity={0.8}
          >
            <View style={styles.actionIconCircleDelete}>
              <MaterialCommunityIcons name="trash-can-outline" size={17} color="#FFF" />
            </View>
            <Text style={[styles.actionText, { color: '#EF4444' }]}>Delete</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.rightEditIndicator,
              { backgroundColor: isDarkMode ? '#132447' : '#DBEAFE' },
            ]}
            onPress={() => onRequestEdit && onRequestEdit(item, resetPosition)}
            activeOpacity={0.8}
          >
            <Text style={[styles.actionText, { color: '#2563EB' }]}>Edit</Text>
            <View style={styles.actionIconCircleEdit}>
              <MaterialCommunityIcons name="pencil" size={17} color="#FFF" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Foreground fintech row */}
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
            onPress={() => onRequestEdit && onRequestEdit(item, resetPosition)}
            delayLongPress={350}
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
    minHeight: 56,
    overflow: 'hidden',
  },
  backgroundActionsContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },
  leftDeleteIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    width: '50%',
    gap: 8,
  },
  rightEditIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    width: '50%',
    gap: 8,
  },
  actionIconCircleDelete: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconCircleEdit: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  rowForeground: {
    flexDirection: 'row',
    width: '100%',
    minHeight: 56,
  },
  touchableWrapper: {
    flexDirection: 'row',
    width: '100%',
    minHeight: 56,
  },
  col65: {
    width: '65%',
    borderRightWidth: 1,
  },
  col35: {
    width: '35%',
  },
  cell65: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  cell35: {
    paddingVertical: 10,
    paddingLeft: 6,
    paddingRight: 14,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  serialBadge: {
    width: 26,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 1,
  },
  serialText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  typeBadge: {
    paddingHorizontal: 6.5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  typeBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  formulaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6.5,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1,
    marginLeft: 6,
    maxWidth: 140,
    flexShrink: 1,
  },
  formulaBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  amountText: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    letterSpacing: 0.2,
  },
});
