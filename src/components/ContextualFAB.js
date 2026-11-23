import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Animated,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Text,
  Platform,
} from 'react-native';
import { FAB, Portal } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useAppLock } from '../context/AppLockContext';
import { useTheme } from '../context/ThemeContext';

/**
 * Maps standard transaction action labels to clear, user-friendly descriptive subtitles.
 */
function getActionSubtitle(label) {
  if (!label) return null;
  const l = String(label).toLowerCase();
  if (l.includes('expense')) return 'Log money spent';
  if (l.includes('income')) return 'Add money received';
  if (l.includes('transfer')) return 'Between accounts';
  if (l.includes('given') || l.includes('lent')) return 'Lent money';
  if (l.includes('received') || l.includes('borrow')) return 'Borrowed money';
  return null;
}

export default function ContextualFAB({
  actions = [],
  onPress,
  icon = 'plus',
  color = '#FFFFFF',
  style,
  fabStyle,
}) {
  const [open, setOpen] = useState(false);
  const isFocused = useIsFocused();
  const appLock = useAppLock();
  const isLocked = Boolean(appLock?.isLocked);

  const themeContext = useTheme ? useTheme() : null;
  const isDarkMode = Boolean(themeContext?.isDarkMode);
  const theme = themeContext?.theme || {};

  // Animation values
  const mainFabAnim = useRef(new Animated.Value(0)).current;
  const itemAnims = useRef(actions.map(() => new Animated.Value(0))).current;

  // Dynamically ensure enough animated values if actions change
  while (itemAnims.length < actions.length) {
    itemAnims.push(new Animated.Value(0));
  }

  // Close speed dial when app lock engages or screen loses focus
  useEffect(() => {
    if ((isLocked || !isFocused) && open) {
      setOpen(false);
      mainFabAnim.setValue(0);
      itemAnims.forEach((anim) => anim.setValue(0));
    }
  }, [isLocked, isFocused]);

  // Spring physics speed dial opening
  const openSpeedDial = () => {
    setOpen(true);
    Animated.parallel([
      Animated.spring(mainFabAnim, {
        toValue: 1,
        friction: 5.5,
        tension: 75,
        useNativeDriver: true,
      }),
      Animated.stagger(
        35,
        // Reverse order so items blossom upward starting from closest to the FAB
        [...itemAnims.slice(0, actions.length)].reverse().map((anim) =>
          Animated.spring(anim, {
            toValue: 1,
            friction: 5.8,
            tension: 65,
            useNativeDriver: true,
          })
        )
      ),
    ]).start();
  };

  // Snappy collapse closing
  const closeSpeedDial = (callback) => {
    Animated.parallel([
      Animated.spring(mainFabAnim, {
        toValue: 0,
        friction: 7,
        tension: 85,
        useNativeDriver: true,
      }),
      Animated.stagger(
        18,
        itemAnims.slice(0, actions.length).map((anim) =>
          Animated.timing(anim, {
            toValue: 0,
            duration: 130,
            useNativeDriver: true,
          })
        )
      ),
    ]).start(() => {
      setOpen(false);
      if (typeof callback === 'function') callback();
    });
  };

  const toggleSpeedDial = () => {
    if (open) {
      closeSpeedDial();
    } else {
      openSpeedDial();
    }
  };

  const handleActionPress = (action) => {
    closeSpeedDial();
    setTimeout(() => {
      if (action.onPress) action.onPress();
    }, 60);
  };

  // Do not render when app is locked
  if (isLocked) return null;

  // Single FAB fallback when actions are empty
  if (!actions || actions.length === 0) {
    return (
      <FAB
        icon={icon}
        onPress={onPress}
        color={color}
        visible={isFocused}
        style={[styles.fab, style, fabStyle]}
      />
    );
  }

  if (!isFocused) return null;

  // Interpolations
  const backdropOpacity = mainFabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const fabRotation = mainFabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const fabScale = mainFabAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.88, 1],
  });

  const glowOpacity = mainFabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  const glowScale = mainFabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.35],
  });

  // Dynamic theme colors
  const pillBg = isDarkMode ? (theme?.cardBg || '#1E293B') : '#FFFFFF';
  const pillBorder = isDarkMode ? (theme?.border || '#334155') : '#E2E8F0';
  const textSecondary = isDarkMode ? '#94A3B8' : '#64748B';
  const backdropBg = isDarkMode ? 'rgba(0, 0, 0, 0.72)' : 'rgba(15, 23, 42, 0.55)';

  // Extract layout positioning so action rows can span full screen width to prevent text wrapping
  const flattenedStyle = StyleSheet.flatten(style) || {};
  const fabBottom = flattenedStyle.bottom !== undefined ? flattenedStyle.bottom : 24;
  const fabRight = flattenedStyle.right !== undefined ? flattenedStyle.right : 20;

  return (
    <Portal>
      {/* 1. Translucent Backdrop */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.backdrop,
          {
            opacity: backdropOpacity,
            backgroundColor: backdropBg,
          },
        ]}
        pointerEvents={open ? 'auto' : 'none'}
      >
        <TouchableWithoutFeedback onPress={() => closeSpeedDial()}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      </Animated.View>

      {/* 2. Full-Screen Anchor Container (prevents Yoga width squishing) */}
      <View style={[StyleSheet.absoluteFill, { zIndex: 999 }]} pointerEvents="box-none">
        {/* Glow behind main FAB when open */}
        <Animated.View
          style={[
            styles.mainFabGlow,
            {
              bottom: fabBottom,
              right: fabRight,
              opacity: glowOpacity,
              transform: [{ scale: glowScale }],
            },
          ]}
          pointerEvents="none"
        />

        {/* Action Items List */}
        {actions.map((action, i) => {
          const targetY = (actions.length - i) * 62 + 6;
          const anim = itemAnims[i];

          const translateY = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [16, -targetY],
          });

          const translateX = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [16, 0],
          });

          const scale = anim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.35, 1],
          });

          const opacity = anim.interpolate({
            inputRange: [0, 0.35, 1],
            outputRange: [0, 1, 1],
            extrapolate: 'clamp',
          });

          const actionColor = action.color || '#3F8F6B';
          const subtitle = action.subtitle || getActionSubtitle(action.label);

          return (
            <Animated.View
              key={action.label || `fab-action-${i}`}
              style={[
                styles.actionRow,
                {
                  bottom: fabBottom,
                  right: fabRight,
                  opacity,
                  transform: [{ translateY }, { translateX }, { scale }],
                },
              ]}
              pointerEvents={open ? 'auto' : 'none'}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleActionPress(action)}
                style={styles.actionRowTouchable}
              >
                {/* Descriptive Label Pill */}
                <View
                  style={[
                    styles.labelPill,
                    {
                      backgroundColor: pillBg,
                      borderColor: pillBorder,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[styles.labelText, { color: actionColor }]}
                  >
                    {action.label}
                  </Text>
                  {subtitle ? (
                    <Text
                      numberOfLines={1}
                      style={[styles.labelSubtext, { color: textSecondary }]}
                    >
                      {subtitle}
                    </Text>
                  ) : null}
                </View>

                {/* Circular Action Button */}
                <View
                  style={[
                    styles.actionCircle,
                    {
                      backgroundColor: actionColor,
                      shadowColor: actionColor,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={action.icon || 'plus'}
                    size={22}
                    color="#FFFFFF"
                  />
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        {/* Main Floating Action Button */}
        <Animated.View
          style={[
            styles.mainFabWrapper,
            {
              bottom: fabBottom,
              right: fabRight,
              transform: [
                { rotate: fabRotation },
                { scale: fabScale },
              ],
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={toggleSpeedDial}
            style={[styles.mainFab, fabStyle]}
          >
            <MaterialCommunityIcons name={icon} size={28} color={color} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 24,
    backgroundColor: '#3F8F6B',
    borderRadius: 30,
  },
  backdrop: {
    ...(Platform.OS === 'web' && { backdropFilter: 'blur(8px)' }),
  },
  mainFabGlow: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3F8F6B',
    ...(Platform.OS === 'web' && { filter: 'blur(16px)' }),
  },
  mainFabWrapper: {
    position: 'absolute',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3F8F6B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3F8F6B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  actionRow: {
    position: 'absolute',
    height: 56,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  actionRowTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: 4,
    paddingLeft: 12,
  },
  labelPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
  },
  labelText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  labelSubtext: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  actionCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 4, // Centers 48px circle nicely over the 56px FAB below
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
});
