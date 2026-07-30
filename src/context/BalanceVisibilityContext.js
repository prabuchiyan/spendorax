// src/context/BalanceVisibilityContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BalanceVisibilityContext = createContext();

const STORAGE_KEY = 'balance_visible';

export function BalanceVisibilityProvider({ children }) {
    const [balanceVisible, setBalanceVisible] = useState(true);

    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEY).then(val => {
            if (val !== null) setBalanceVisible(val === 'true');
        });
    }, []);

    const toggleBalance = async () => {
        const next = !balanceVisible;
        setBalanceVisible(next);
        await AsyncStorage.setItem(STORAGE_KEY, String(next));
    };

    return (
        <BalanceVisibilityContext.Provider value={{ balanceVisible, toggleBalance }}>
            {children}
        </BalanceVisibilityContext.Provider>
    );
}

export function useBalanceVisibility() {
    return useContext(BalanceVisibilityContext);
}