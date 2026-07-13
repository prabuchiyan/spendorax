import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const ACTIONS = {
    add: {
        color: '#2563EB',
        bg: '#DBEAFE',
        icon: 'plus-circle-outline',
    },
    pay: {
        color: '#16A34A',
        bg: '#DCFCE7',
        icon: 'cash-fast',
    },
    prepay: {
        color: '#EA580C',
        bg: '#FED7AA',
        icon: 'trending-up',
    },
    all: {
        color: '#7C3AED',
        bg: '#EDE9FE',
        icon: 'view-grid-outline',
    },
};

function QuickButton({ theme, label, onPress }) {
    return (
        <TouchableOpacity
            style={styles.button}
            activeOpacity={0.85}
            onPress={onPress}
        >
            <View
                style={[
                    styles.iconBox,
                    {
                        backgroundColor: theme.bg,
                    },
                ]}
            >
                <MaterialCommunityIcons
                    name={theme.icon}
                    size={22}
                    color={theme.color}
                />
            </View>

            <Text style={styles.label}>{label}</Text>
        </TouchableOpacity>
    );
}

export default function LoanQuickActions({
    onAdd,
    onPay,
    onPrepay,
    onAll,
}) {
    return (
        <View style={styles.container}>
            <QuickButton
                theme={ACTIONS.add}
                label="Add Loan"
                onPress={onAdd}
            />

            <QuickButton
                theme={ACTIONS.pay}
                label="Pay EMI"
                onPress={onPay}
            />

            <QuickButton
                theme={ACTIONS.prepay}
                label="Prepay"
                onPress={onPrepay}
            />

            <QuickButton
                theme={ACTIONS.all}
                label="All Loans"
                onPress={onAll}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },

    button: {
        width: '23%',
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        paddingVertical: 12,
        alignItems: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: {
            width: 0,
            height: 2,
        },
    },

    iconBox: {
        width: 42,
        height: 42,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },

    label: {
        marginTop: 10,
        fontSize: 11,
        fontWeight: '700',
        color: '#374151',
        textAlign: 'center',
    },
});