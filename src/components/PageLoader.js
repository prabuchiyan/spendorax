import React from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  Platform
} from
'react-native';

const DEFAULT_GIF = require('../../assets/loading-waiting.gif');

export default function PageLoader({
  visible = true,
  source = DEFAULT_GIF,
  size = 130
}) {
  const pulse = React.useRef(
    new Animated.Value(0)
  ).current;

  React.useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
      Animated.timing(pulse, {
        toValue: 1,
        duration: 700,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true
      }),
      Animated.timing(pulse, {
        toValue: 0,
        duration: 700,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true
      })]
      )
    );

    if (visible) {
      pulseAnimation.start();
    }
    return () => {
      pulseAnimation.stop();
    };
  }, [pulse, visible]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.06]
  });

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="auto">
        
        <View style={styles.card}>
          <Animated.Image
            source={source}
            style={{
              width: size,
              height: size,
              transform: [{ scale }]
            }}
            resizeMode="cover" />
      </View>
    </View>
  );

}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Platform.OS === 'web' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.6)',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(8px)' } : {}),
    zIndex: 999999,
    elevation: 999999
  },
  card: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  }
});