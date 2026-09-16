import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, SafeAreaView, Dimensions, AppState, Animated, Easing } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from './Theme';
import { useAppLock } from '../context/AppLockContext';
import { verifyPasscode, authenticateBiometric, getSecuritySettings, isBiometricSupported, getPasscodeLength } from '../services/authService';

const { width } = Dimensions.get('window');

export default function AppLockScreen() {
  const { unlock } = useAppLock();
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [settings, setSettings] = useState(null);
  
  const [maxLength, setMaxLength] = useState(4);
  const isAuthenticatingRef = React.useRef(false);

  useEffect(() => {
    const init = async () => {
      const s = await getSecuritySettings();
      setSettings(s);
      
      const len = await getPasscodeLength();
      setMaxLength(len);

      if (s.biometricEnabled) {
        const supported = await isBiometricSupported();
        setBiometricAvailable(supported);
        if (supported) {
          // Extremely strict safety check for Android:
          // We must wait for the AppState to settle and be unequivocally 'active'.
          // Calling the biometric prompt while the app is transitioning crashes the OS service.
          setTimeout(() => {
            if (AppState.currentState === 'active') {
              handleBiometricAuth();
            }
          }, 600);
        }
      }
    };
    init();
  }, []);

  const handleBiometricAuth = async () => {
    if (isAuthenticatingRef.current) return;
    isAuthenticatingRef.current = true;
    try {
      const result = await authenticateBiometric();
      if (result.success) {
        unlock();
      }
    } catch (e) {
      console.warn(e);
    } finally {
      isAuthenticatingRef.current = false;
    }
  };

  const handlePress = (num) => {
    if (passcode.length < maxLength) {
      const newPasscode = passcode + num;
      setPasscode(newPasscode);
      setError('');
      
      if (newPasscode.length === maxLength) {
        verify(newPasscode);
      }
    }
  };

  const handleDelete = () => {
    if (passcode.length > 0) {
      setPasscode(passcode.slice(0, -1));
      setError('');
    }
  };

  const shakeAnim = React.useRef(new Animated.Value(0)).current;
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (biometricAvailable) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
        ])
      ).start();
    }
  }, [biometricAvailable]);

  const verify = async (code) => {
    const isValid = await verifyPasscode(code);
    if (isValid) {
      unlock();
    } else {
      setError('Incorrect passcode');
      
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 12, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -12, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 12, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -12, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true })
      ]).start(() => {
        setPasscode('');
      });
    }
  };

  const AnimatedDot = ({ isFilled, isError }) => {
    const scale = React.useRef(new Animated.Value(1)).current;
    
    useEffect(() => {
      Animated.spring(scale, {
        toValue: isFilled ? 1.3 : 1,
        useNativeDriver: true,
        bounciness: 12,
        speed: 20
      }).start();
    }, [isFilled]);

    return (
      <Animated.View
        style={[
          styles.dot,
          isFilled && styles.dotFilled,
          isError ? {
            borderColor: '#E46A6A',
            backgroundColor: isFilled ? '#E46A6A' : 'transparent'
          } : null,
          { transform: [{ scale }] }
        ]}
      />
    );
  };

  const renderKey = (num) => {
    return (
      <TouchableOpacity
        key={num}
        style={styles.key}
        onPress={() => handlePress(num)}
        activeOpacity={0.5}
      >
        <Text style={styles.keyText}>{num}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name="shield-lock-outline" size={48} color={Colors.primary} />
        </View>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Enter your passcode to continue</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>

      <Animated.View style={[styles.dotsContainer, { transform: [{ translateX: shakeAnim }] }]}>
        {Array(maxLength).fill(0).map((_, i) => (
          <AnimatedDot key={i} isFilled={i < passcode.length} isError={!!error} />
        ))}
      </Animated.View>

      <View style={styles.keypad}>
        <View style={styles.row}>
          {[1, 2, 3].map(renderKey)}
        </View>
        <View style={styles.row}>
          {[4, 5, 6].map(renderKey)}
        </View>
        <View style={styles.row}>
          {[7, 8, 9].map(renderKey)}
        </View>
        <View style={styles.row}>
          {biometricAvailable ? (
            <TouchableOpacity style={[styles.key, { backgroundColor: 'transparent', elevation: 0 }]} onPress={handleBiometricAuth} activeOpacity={0.6}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <MaterialCommunityIcons name="fingerprint" size={38} color={Colors.primary} />
              </Animated.View>
            </TouchableOpacity>
          ) : (
            <View style={styles.keyPlaceholder} />
          )}
          
          {renderKey(0)}
          
          <TouchableOpacity style={[styles.key, { backgroundColor: 'transparent', elevation: 0 }]} onPress={handleDelete} activeOpacity={0.6}>
            <MaterialCommunityIcons name="backspace-outline" size={28} color="#555" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FBFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2D3748',
  },
  subtitle: {
    fontSize: 15,
    color: '#718096',
    marginTop: 8,
    marginBottom: 8,
  },
  errorText: {
    color: '#E46A6A',
    fontWeight: '600',
    fontSize: 14,
    height: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginBottom: 50,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#CBD5E0',
    marginHorizontal: 12,
    backgroundColor: '#fff',
  },
  dotFilled: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  keypad: {
    width: width * 0.85,
    maxWidth: 340,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  key: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  keyPlaceholder: {
    width: 76,
    height: 76,
  },
  keyText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#2D3748',
  },
});
