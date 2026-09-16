import React, { createContext, useState, useEffect, useRef, useContext } from 'react';
import { AppState } from 'react-native';
import { getSecuritySettings, hasPasscode, isSecuritySupported } from '../services/authService';

const AppLockContext = createContext();

export const useAppLock = () => useContext(AppLockContext);

export const AppLockProvider = ({ children }) => {
  const [isLocked, setIsLocked] = useState(false);
  const [isReady, setIsReady] = useState(false); // To prevent flashing content before settings load
  const appState = useRef(AppState.currentState);
  const backgroundTime = useRef(null);

  const checkLockRequirement = async (fromBackground = false) => {
    if (!isSecuritySupported()) {
      setIsReady(true);
      return;
    }
    
    const settings = await getSecuritySettings();
    const passcodeExists = await hasPasscode();

    if (settings.appLockEnabled && passcodeExists) {
      if (fromBackground) {
        if (backgroundTime.current) {
          const timeInBackground = Date.now() - backgroundTime.current;
          const delayMs = settings.autoLockDelay * 1000;
          if (timeInBackground >= delayMs) {
            setIsLocked(true);
          }
        } else {
          // If we don't know how long it was in background, lock it to be safe
          setIsLocked(true);
        }
      } else {
        // Initial launch
        setIsLocked(true);
      }
    } else {
      setIsLocked(false);
    }
    setIsReady(true);
  };

  useEffect(() => {
    checkLockRequirement(false);

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        checkLockRequirement(true);
      } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        backgroundTime.current = Date.now();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const unlock = () => {
    setIsLocked(false);
    backgroundTime.current = null;
  };

  const lock = () => {
    setIsLocked(true);
  };

  return (
    <AppLockContext.Provider value={{ isLocked, unlock, lock, isReady }}>
      {children}
    </AppLockContext.Provider>
  );
};
