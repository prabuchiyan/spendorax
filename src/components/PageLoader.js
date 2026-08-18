import React from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { Colors } from './Theme';

const DEFAULT_GIF = require('../../assets/loading-waiting.gif');

export default function PageLoader({ visible = true, source = DEFAULT_GIF, size = 130 }) {
  const pulse = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    pulseAnimation.start();
    return () => pulseAnimation.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.06] });

  if (!visible) return null;

  const webBlur = Platform.OS === 'web' ? { backdropFilter: 'blur(6px)' } : {};

  return (
    <Animated.View pointerEvents="auto" style={[styles.overlay, webBlur]}>
      <View style={styles.card}>
        <Animated.Image source={source} style={{ width: size, height: size, transform: [{ scale }] }} resizeMode="contain" />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Platform.OS === 'web' ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.36)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  card: {
    width: 170,
    height: 170,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4B7CF3',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 10,
    overflow: 'hidden',
  },
});
