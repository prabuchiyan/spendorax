import React from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  Modal,
} from 'react-native';
import { Colors } from './Theme';

const DEFAULT_GIF = require('../../assets/loading-waiting.gif');

export default function PageLoader({
  visible = true,
  source = DEFAULT_GIF,
  size = 130,
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

    if (visible) {
      pulseAnimation.start();
    }
    return () => {
      pulseAnimation.stop();
    };
  }, [pulse, visible]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.06],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      hardwareAccelerated
      onRequestClose={() => {
        // Intentionally empty.
        // Loader visibility is controlled by PageLoaderContext.
      }}
    >
      <View
        style={styles.overlay}
        pointerEvents="auto"
      >
        <View style={styles.card}>
          <Animated.Image
            source={source}
            style={{
              width: size,
              height: size,
              transform: [{ scale }],
            }}
            resizeMode="contain"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      Platform.OS === 'web'
        ? 'rgba(255,255,255,0.30)'
        : 'rgba(255,255,255,0.42)',
    // Web
    zIndex: 999999,
    // Android
    elevation: 999999,
  },
  card: {
    width: 170,
    height: 170,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 18,
    },
    shadowOpacity: 0.14,
    shadowRadius: 28,
    elevation: 20,
    overflow: 'hidden',
  },
});