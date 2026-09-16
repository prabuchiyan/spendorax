import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, SafeAreaView, Dimensions } from 'react-native';
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
          handleBiometricAuth();
        }
      }
    };
    init();
  }, []);

  const handleBiometricAuth = async () => {
    try {
      const result = await authenticateBiometric();
      if (result.success) {
        unlock();
      }
    } catch (e) {
      console.warn(e);
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

  const verify = async (code) => {
    const isValid = await verifyPasscode(code);
    if (isValid) {
      unlock();
    } else {
      setError('Incorrect passcode');
      setPasscode('');
    }
  };

  const renderDot = (index) => {
    const isFilled = index < passcode.length;
    return (
      <View
        key={index}
        style={[
          styles.dot,
          isFilled && styles.dotFilled,
          error ? {
            borderColor: '#E46A6A',
            backgroundColor: passcode.length > 0 ? '#E46A6A' : 'transparent'
          } : null
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
        activeOpacity={0.7}
      >
        <Text style={styles.keyText}>{num}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="lock" size={40} color={Colors.primary} />
        <Text style={styles.title}>Enter Passcode</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>

      <View style={styles.dotsContainer}>
        {Array(maxLength).fill(0).map((_, i) => renderDot(i))}
      </View>

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
            <TouchableOpacity style={styles.key} onPress={handleBiometricAuth}>
              <MaterialCommunityIcons name="fingerprint" size={32} color={Colors.primary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.key} /> // empty placeholder
          )}
          
          {renderKey(0)}
          
          <TouchableOpacity style={styles.key} onPress={handleDelete}>
            <MaterialCommunityIcons name="backspace-outline" size={28} color="#333" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    color: '#333',
  },
  errorText: {
    color: '#E46A6A',
    marginTop: 8,
    fontSize: 14,
    height: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginBottom: 60,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    marginHorizontal: 12,
  },
  dotFilled: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  keypad: {
    width: width * 0.8,
    maxWidth: 320,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  key: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#F5F7FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyText: {
    fontSize: 28,
    fontWeight: '500',
    color: '#333',
  },
});
