import React, { useEffect, useMemo, useState } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from './Theme';

const ANIMATION_DURATION = 250;

export default function ExitConfirmationModal({ visible, onCancel, onExit }) {
    const colorScheme = useColorScheme();
    const [showModal, setShowModal] = useState(visible);
    const animation = useState(() => new Animated.Value(0))[0];

    useEffect(() => {
        if (visible) {
            setShowModal(true);
            Animated.timing(animation, {
                toValue: 1,
                duration: ANIMATION_DURATION,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(animation, {
                toValue: 0,
                duration: ANIMATION_DURATION,
                useNativeDriver: true,
            }).start(() => setShowModal(false));
        }
    }, [animation, visible]);

    const overlayStyle = useMemo(
        () => [
            styles.overlay,
            { backgroundColor: colorScheme === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(15,23,42,0.45)' },
        ],
        [colorScheme]
    );

    const containerStyle = useMemo(() => [
        styles.modalCard,
        {
            backgroundColor: colorScheme === 'dark' ? '#111827' : '#FFFFFF',
            shadowColor: colorScheme === 'dark' ? '#000' : '#0F172A',
        },
    ], [colorScheme]);

    const animatedStyle = {
        opacity: animation,
        transform: [
            {
                scale: animation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.94, 1],
                }),
            },
        ],
    };

    if (!showModal) return null;

    return (
        <Modal
            visible={showModal}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={onCancel}
        >
            <Pressable style={overlayStyle} onPress={onCancel} />
            <View style={styles.centeredView} pointerEvents="box-none">
                <Animated.View style={[containerStyle, animatedStyle]}>
                    <View style={styles.iconWrapper}>
                        <MaterialCommunityIcons name="exit-to-app" size={30} color={Colors.primary} />
                    </View>
                    <Text style={[styles.title, { color: colorScheme === 'dark' ? '#F8FAFC' : '#111827' }]}>Exit SpendoraX?</Text>
                    <View style={styles.buttonRow}>
                        <Pressable style={({ pressed }) => [styles.cancelButton, pressed && styles.pressedButton]} onPress={onCancel}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </Pressable>
                        <Pressable style={({ pressed }) => [styles.exitButton, pressed && styles.pressedExit]} onPress={onExit}>
                            <Text style={styles.exitText}>Exit App</Text>
                        </Pressable>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
    },
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalCard: {
        width: '100%',
        maxWidth: 420,
        borderRadius: 24,
        padding: 24,
        elevation: 20,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
    },
    iconWrapper: {
        width: 60,
        height: 60,
        borderRadius: 18,
        backgroundColor: `${Colors.primary}20`,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 18,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 12,
    },
    message: {
        fontSize: 14,
        lineHeight: 22,
        marginBottom: 24,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        borderWidth: 1,
        borderColor: Colors.primary,
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    cancelText: {
        color: Colors.primary,
        fontWeight: '700',
        fontSize: 14,
    },
    exitButton: {
        flex: 1,
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        backgroundColor: Colors.primary,
    },
    exitText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 14,
    },
    pressedButton: {
        opacity: 0.7,
    },
    pressedExit: {
        opacity: 0.8,
    },
});
