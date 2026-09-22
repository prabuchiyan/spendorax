import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Animated, TouchableWithoutFeedback, Text, Platform } from 'react-native';
import { FAB, Portal } from 'react-native-paper';
import { useIsFocused } from '@react-navigation/native';
import { Colors } from './Theme';

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
  const animation = useRef(new Animated.Value(0)).current;

  // Sync open state changes with animation
  useEffect(() => {
    const toValue = open ? 1 : 0;
    Animated.spring(animation, {
      toValue,
      friction: 6,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [open]);

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

  const backdropOpacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const fabRotation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <Portal>
      {/* Backdrop */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.backdrop,
          { opacity: backdropOpacity },
        ]}
        pointerEvents={open ? 'auto' : 'none'}
      >
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      </Animated.View>

      <View style={[styles.container, style]} pointerEvents="box-none">
        
        {/* Glow behind main FAB when open */}
        <Animated.View
          style={[
            styles.mainFabGlow,
            {
              opacity: animation.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.6],
              }),
              transform: [
                {
                  scale: animation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1.4],
                  }),
                },
              ],
            },
          ]}
          pointerEvents="none"
        />

        {/* Actions */}
        {actions.map((action, i) => {
          const R = 110; // Perfect sweet-spot radius
          
          // Use a fixed 45 degree (PI/4) step, centered around 135 degrees (3*PI/4)
          const ARC_STEP = Math.PI / 4; 
          const CENTER_ANGLE = (3 * Math.PI) / 4; 
          const startAngle = CENTER_ANGLE - ((actions.length - 1) * ARC_STEP) / 2;
          
          const angle = startAngle + i * ARC_STEP;
          
          const targetX = R * Math.cos(angle);
          const targetY = -R * Math.sin(angle);

          // Staggered animation values
          const delay = i * 0.1;

          const translateX = animation.interpolate({
            inputRange: [0, delay, 1],
            outputRange: [0, 0, targetX],
          });
          const translateY = animation.interpolate({
            inputRange: [0, delay, 1],
            outputRange: [0, 0, targetY],
          });
          const scale = animation.interpolate({
            inputRange: [0, delay, 1],
            outputRange: [0.3, 0.3, 1],
          });
          const opacity = animation.interpolate({
            inputRange: [0, delay, Math.min(1, delay + 0.4)],
            outputRange: [0, 0, 1],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={action.label}
              style={[
                styles.actionContainer,
                {
                  opacity,
                  transform: [{ translateX }, { translateY }, { scale }],
                },
              ]}
              pointerEvents={open ? 'auto' : 'none'}
            >
              <FAB
                icon={action.icon}
                color={action.color}
                style={[styles.actionFab, action.style]}
                onPress={() => {
                  setOpen(false);
                  setTimeout(() => {
                    if (action.onPress) action.onPress();
                  }, 200);
                }}
                size="small"
              />
            </Animated.View>
          );
        })}

        {/* Main FAB */}
        <Animated.View style={{ transform: [{ rotate: fabRotation }] }}>
          <FAB
            icon={icon}
            onPress={() => setOpen(!open)}
            color={color}
            style={[styles.mainFab, fabStyle]}
          />
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
    borderRadius: 30, // Circular FAB
  },
  backdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)', // Darker, rich slate overlay for high contrast
    ...(Platform.OS === 'web' && { backdropFilter: 'blur(10px)' }),
  },
  container: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    // Uses the style injected by the parent (e.g. { bottom: 70, right: 20 })
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainFabGlow: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3F8F6B',
    ...(Platform.OS === 'web' && { filter: 'blur(15px)' }),
  },
  mainFab: {
    backgroundColor: '#3F8F6B',
    borderRadius: 30,
    shadowColor: '#3F8F6B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, // Stronger glow
    shadowRadius: 16,
    elevation: 10,
  },
  actionContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
  },
  actionFab: {
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
});
