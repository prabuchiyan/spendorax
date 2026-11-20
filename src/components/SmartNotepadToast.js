import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export default function SmartNotepadToast({
  visible,
  message,
  type = 'success', // 'success' | 'info' | 'error'
  duration = 2600,
  onDismiss,
}) {
  const { isDarkMode, theme } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-24)).current;

  useEffect(() => {
    let timer;
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();

      if (duration > 0) {
        timer = setTimeout(() => {
          hideToast();
        }, duration);
      }
    } else {
      hideToast();
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -24,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onDismiss) onDismiss();
    });
  };

  if (!visible) return null;

  const getIconConfig = () => {
    switch (type) {
      case 'error':
        return { name: 'alert-circle', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)' };
      case 'info':
        return { name: 'information', color: '#0EA5E9', bg: 'rgba(14, 165, 233, 0.15)' };
      case 'success':
      default:
        return { name: 'check-circle', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)' };
    }
  };

  const iconConfig = getIconConfig();

  return (
    <View style={styles.outerContainer} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.toastCard,
          {
            backgroundColor: isDarkMode ? '#1E293B' : '#0F172A',
            borderColor: isDarkMode ? '#334155' : '#1E293B',
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={hideToast}
          style={styles.innerContent}
        >
          <View style={[styles.iconWrap, { backgroundColor: iconConfig.bg }]}>
            <MaterialCommunityIcons
              name={iconConfig.name}
              size={18}
              color={iconConfig.color}
            />
          </View>
          <Text
            style={[
              styles.toastText,
              { color: '#F8FAFC' },
            ]}
            numberOfLines={2}
          >
            {message}
          </Text>
          <MaterialCommunityIcons
            name="close"
            size={14}
            color="#94A3B8"
            style={styles.closeIcon}
          />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 36,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 99999,
  },
  toastCard: {
    minHeight: 46,
    maxWidth: 520,
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 4px 14px rgba(0,0,0,0.22)',
      },
    }),
  },
  innerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  toastText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    lineHeight: 18,
  },
  closeIcon: {
    marginLeft: 8,
    opacity: 0.8,
  },
});

