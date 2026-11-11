// src/context/ThemeContext.js
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const lightTheme = {
  isDark: false,
  mode: 'light',
  bg: '#F8F9FF',
  bgApp: '#F5FAF7',
  cardBg: '#FFFFFF',
  cardBgSecondary: '#F1F5F9',
  cardBorder: '#E2E8F0',
  border: '#E2E8F0',
  borderSubtle: '#F0F2F5',
  textPrimary: '#0B1C30',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  primary: '#4B7CF3',
  accent: '#FFB86B',
  activeBg: '#EFF4FF',
  activeBorder: '#C6C6CD',
  activeText: '#000000',
  inactiveText: '#76777D',
  activeChipBg: '#EFF4FF',
  activeChipBorder: '#C6C6CD',
  activeChipText: '#0B1C30',
  inactiveChipText: '#64748B',
  inputBg: '#FFFFFF',
  inputBorder: '#E2E8F0',
  inputText: '#0B1C30',
  inputPlaceholder: '#94A3B8',
  modalBg: '#FFFFFF',
  modalText: '#0B1C30',
  modalOverlay: 'rgba(15, 23, 42, 0.65)',
  headerBg: '#FFFFFF',
  headerText: '#1A1D20',
  headerBorder: '#F0F2F5',
  drawerBg: '#FFFFFF',
  drawerText: '#4B5563',
  drawerDivider: '#F0F2F5',
  bottomBarBg: '#FFFFFF',
  bottomBarBorder: '#EEEEEE',
  searchBg: '#FFFFFF',
  searchBorder: '#C6C6CD',
  statementBg: '#F8F9FF',
  iconBg: '#EFF4FF',
  iconColor: '#000000',
  alertBg: '#FFDAD6',
  alertBorder: 'rgba(186, 26, 26, 0.2)',
  alertIconBg: '#FFB4AB',
  alertTextPrimary: '#93000A',
  alertTextSecondary: '#BA1A1A',
  successBg: '#E5EEFF',
  successText: '#006A61',
  danger: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  info: '#3B82F6',
  // Universal Convenience Aliases
  text: '#0B1C30',
  subText: '#64748B',
  title: '#0B1C30',
  subtitle: '#64748B',
  card: '#FFFFFF',
  background: '#F8F9FF',
  mutedText: '#94A3B8',
  divider: '#F0F2F5',
  cardElevated: '#FFFFFF',
};

export const darkTheme = {
  isDark: true,
  mode: 'dark',
  bg: '#0B0F17',
  bgApp: '#0B0F17',
  cardBg: '#182234',
  cardBgSecondary: '#1E293B',
  cardBorder: '#334155',
  border: '#334155',
  borderSubtle: '#1E293B',
  textPrimary: '#F3F4F6',
  textSecondary: '#9CA3AF',
  textMuted: '#64748B',
  primary: '#4B7CF3',
  accent: '#FFB86B',
  activeBg: '#1E293B',
  activeBorder: '#334155',
  activeText: '#FFFFFF',
  inactiveText: '#9CA3AF',
  activeChipBg: '#1E293B',
  activeChipBorder: '#334155',
  activeChipText: '#FFFFFF',
  inactiveChipText: '#9CA3AF',
  inputBg: '#182234',
  inputBorder: '#334155',
  inputText: '#F3F4F6',
  inputPlaceholder: '#64748B',
  modalBg: '#182234',
  modalText: '#F3F4F6',
  modalOverlay: 'rgba(0, 0, 0, 0.75)',
  headerBg: '#0B0F17',
  headerText: '#F3F4F6',
  headerBorder: '#1E293B',
  drawerBg: '#111827',
  drawerText: '#D1D5DB',
  drawerDivider: '#1F2937',
  bottomBarBg: '#111827',
  bottomBarBorder: '#1F2937',
  searchBg: '#182234',
  searchBorder: '#334155',
  statementBg: '#111827',
  iconBg: '#1E293B',
  iconColor: '#FFFFFF',
  alertBg: 'rgba(159, 18, 57, 0.4)',
  alertBorder: 'rgba(244, 63, 94, 0.3)',
  alertIconBg: 'rgba(244, 63, 94, 0.1)',
  alertTextPrimary: '#FDA4AF',
  alertTextSecondary: '#FBCFE8',
  successBg: '#134E4A',
  successText: '#5EEAD4',
  danger: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  info: '#3B82F6',
  // Universal Convenience Aliases
  text: '#F3F4F6',
  subText: '#9CA3AF',
  title: '#F3F4F6',
  subtitle: '#9CA3AF',
  card: '#182234',
  background: '#0B0F17',
  mutedText: '#9CA3AF',
  divider: '#334155',
  cardElevated: '#1E293B',
};

const ThemeContext = createContext({
  isDarkMode: false,
  toggleDarkMode: () => {},
  setDarkMode: () => {},
  theme: lightTheme,
});

const STORAGE_KEY = 'app_dark_mode';

export function ThemeProvider({ children }) {
  const [isDarkMode, setIsDarkModeState] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((val) => {
        if (val !== null) {
          setIsDarkModeState(val === 'true');
        } else {
          // If no stored value, check system preference or default false
          const systemDark = Appearance.getColorScheme() === 'dark';
          setIsDarkModeState(systemDark);
        }
      })
      .catch((err) => {
        console.warn('[ThemeContext] Failed to load theme setting:', err);
      })
      .finally(() => {
        setInitialized(true);
      });
  }, []);

  const toggleDarkMode = useCallback(async () => {
    setIsDarkModeState((prev) => {
      const next = !prev;
      AsyncStorage.setItem(STORAGE_KEY, String(next)).catch((err) =>
        console.warn('[ThemeContext] Failed to save theme setting:', err)
      );
      return next;
    });
  }, []);

  const setDarkMode = useCallback(async (value) => {
    const next = Boolean(value);
    setIsDarkModeState(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, String(next));
    } catch (err) {
      console.warn('[ThemeContext] Failed to save theme setting:', err);
    }
  }, []);

  const theme = useMemo(() => {
    return isDarkMode ? darkTheme : lightTheme;
  }, [isDarkMode]);

  const contextValue = useMemo(
    () => ({
      isDarkMode,
      toggleDarkMode,
      setDarkMode,
      theme,
      initialized,
    }),
    [isDarkMode, toggleDarkMode, setDarkMode, theme, initialized]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeContext;

