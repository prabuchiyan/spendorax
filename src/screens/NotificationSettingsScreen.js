import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, Switch, Modal, Platform, Alert
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button as PaperButton } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
    getNotifications,
    updateNotification,
} from '../database/notifications';
import {
    scheduleNotification,
    cancelNotification,
    requestPermission,
    checkYesterdaySpend,
    checkBillDue,
    checkLoanEmi,
} from '../services/notificationService';

const TYPE_META = {
    DAILY_SPEND: {
        icon: 'calendar-check-outline',
        color: '#7C3AED',
        bg: '#EDE9FE',
        label: 'Daily Expense Reminder',
        description: 'Reminds you every day to log your expenses.',
    },
    YESTERDAY_SPEND: {
        icon: 'calendar-clock',
        color: '#EA580C',
        bg: '#FED7AA',
        label: 'Missed Expense Alert',
        description: "Notifies if you didn't record any expense yesterday.",
    },
    BILL_DUE: {
        icon: 'file-document-alert-outline',
        color: '#DC2626',
        bg: '#FEE2E2',
        label: 'Bill Due Reminder',
        description: 'Alerts you before bills are due based on reminder days set per bill.',
    },
    LOAN_EMI: {
        icon: 'bank-outline',
        color: '#2563EB',
        bg: '#DBEAFE',
        label: 'Loan EMI Reminder',
        description: "Reminds you on your EMI due day for each active loan.",
    },
};

function pad(n) {
    return String(n).padStart(2, '0');
}

function formatTime(hour, minute) {
    const h = hour % 12 || 12;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${h}:${pad(minute)} ${ampm}`;
}

export default function NotificationSettingsScreen() {
    const [notifications, setNotifications] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [tempTime, setTempTime] = useState(new Date());
    const [saving, setSaving] = useState(null);
    const editingNotificationRef = useRef(null);

    const load = useCallback(async () => {
        const rows = await getNotifications();
        setNotifications(rows);
    }, []);

    useEffect(() => { load(); }, [load]);

    async function handleToggle(notification) {
        const newEnabled = notification.enabled ? 0 : 1;

        if (newEnabled === 1) {
            const granted = await requestPermission();
            if (!granted) {
                Alert.alert(
                    'Permission Required',
                    'Please enable notifications for SpendoraX in your device settings.',
                    [{ text: 'OK' }]
                );
                return;
            }
        }

        setSaving(notification.id);
        try {
            if (newEnabled === 1) {
                const identifier = await scheduleNotification({
                    id: notification.id,
                    title: notification.title,
                    body: notification.body,
                    hour: notification.hour,
                    minute: notification.minute,
                    payload: notification.payload,
                });
                // Save enabled + identifier, hour/minute stay unchanged
                await updateNotification(notification.id, {
                    enabled: 1,
                    notification_identifier: identifier,
                });
            } else {
                if (notification.notification_identifier) {
                    await cancelNotification(notification.notification_identifier);
                }
                await updateNotification(notification.id, {
                    enabled: 0,
                    notification_identifier: null,
                });
            }

            await load();
        } catch (e) {
            console.warn('Toggle notification failed', e);
            Alert.alert('Error', 'Failed to update notification. Please try again.');
        } finally {
            setSaving(null);
        }
    }

    function openTimePicker(notification) {
        const d = new Date();
        d.setHours(notification.hour, notification.minute, 0, 0);
        setTempTime(d);
        setEditingId(notification.id);
        editingNotificationRef.current = notification; // ← store full object in ref
        setShowTimePicker(true);
    }

    async function saveTime(selectedTime) {
        const notification = editingNotificationRef.current;
        if (!notification) return;

        const timeToSave = selectedTime || tempTime;
        const hour = timeToSave.getHours();
        const minute = timeToSave.getMinutes();

        setSaving(notification.id);
        try {
            if (notification.enabled) {
                // Schedule with new time, get back new identifier
                const identifier = await scheduleNotification({
                    id: notification.id,
                    title: notification.title,
                    body: notification.body,
                    hour,
                    minute,
                    payload: notification.payload,
                });

                // Save hour, minute AND new identifier together atomically
                await updateNotification(notification.id, {
                    hour,
                    minute,
                    notification_identifier: identifier,
                });
            } else {
                // Not enabled — just save the time preference for when it gets enabled
                await updateNotification(notification.id, { hour, minute });
            }

            setShowTimePicker(false);
            setEditingId(null);
            editingNotificationRef.current = null;
            await load();
        } catch (e) {
            console.warn('Save time failed', e);
            Alert.alert('Error', 'Failed to save reminder time.');
        } finally {
            setSaving(null);
        }
    }

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* Header info */}
                <View style={styles.infoCard}>
                    <MaterialCommunityIcons name="bell-ring-outline" size={24} color="#7C3AED" />
                    <Text style={styles.infoText}>
                        Enable reminders to stay on top of your expenses, bills, and loan EMIs.
                        Each reminder can be scheduled at your preferred time.
                    </Text>
                </View>

                {notifications.map(notification => {
                    const meta = TYPE_META[notification.type] || {
                        icon: 'bell-outline',
                        color: '#64748B',
                        bg: '#F1F5F9',
                        label: notification.title,
                        description: notification.body,
                    };
                    const isSaving = saving === notification.id;
                    const isEnabled = Boolean(notification.enabled);

                    return (
                        <View key={notification.id} style={[
                            styles.card,
                            isEnabled && styles.cardActive,
                        ]}>
                            {/* Icon + Label row */}
                            <View style={styles.cardHeader}>
                                <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
                                    <MaterialCommunityIcons
                                        name={meta.icon}
                                        size={24}
                                        color={meta.color}
                                    />
                                </View>
                                <View style={{ flex: 1, marginLeft: 14 }}>
                                    <Text style={styles.cardTitle}>{meta.label}</Text>
                                    <Text style={styles.cardDesc}>{meta.description}</Text>
                                </View>
                                <Switch
                                    value={isEnabled}
                                    onValueChange={() => handleToggle(notification)}
                                    disabled={isSaving}
                                    trackColor={{ false: '#E2E8F0', true: meta.color + '60' }}
                                    thumbColor={isEnabled ? meta.color : '#94A3B8'}
                                />
                            </View>

                            {/* Time row — only shown when enabled */}
                            {isEnabled && (
                                <TouchableOpacity
                                    style={[styles.timeRow, { borderColor: meta.color + '40' }]}
                                    onPress={() => openTimePicker(notification)}
                                    activeOpacity={0.8}
                                >
                                    <MaterialCommunityIcons
                                        name="clock-outline"
                                        size={18}
                                        color={meta.color}
                                    />
                                    <Text style={[styles.timeText, { color: meta.color }]}>
                                        {formatTime(notification.hour, notification.minute)}
                                    </Text>
                                    <MaterialCommunityIcons
                                        name="pencil-outline"
                                        size={16}
                                        color={meta.color}
                                        style={{ marginLeft: 'auto' }}
                                    />
                                </TouchableOpacity>
                            )}
                        </View>
                    );
                })}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Time Picker */}
            {showTimePicker && Platform.OS !== 'web' && (
                <Modal visible={showTimePicker} transparent animationType="slide">
                    <View style={styles.pickerOverlay}>
                        <View style={styles.pickerSheet}>
                            <View style={styles.pickerHandle} />
                            <Text style={styles.pickerTitle}>Set Reminder Time</Text>

                            <DateTimePicker
                                value={tempTime}
                                mode="time"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                is24Hour={false}
                                onChange={(event, selected) => {
                                    if (Platform.OS === 'android') {
                                        setShowTimePicker(false);
                                        if (event.type === 'dismissed') {
                                            editingNotificationRef.current = null;
                                            setEditingId(null);
                                            return;
                                        }
                                        if (selected) {
                                            setTempTime(selected);
                                            saveTime(selected);
                                        }
                                        return;
                                    }
                                    if (selected) setTempTime(selected);
                                }}
                            />

                            {Platform.OS === 'ios' && (
                                <View style={styles.pickerButtons}>
                                    <PaperButton
                                        mode="outlined"
                                        onPress={() => { setShowTimePicker(false); setEditingId(null); }}
                                        style={{ flex: 1, marginRight: 10 }}
                                    >
                                        Cancel
                                    </PaperButton>
                                    <PaperButton
                                        mode="contained"
                                        onPress={saveTime}
                                        style={{ flex: 1 }}
                                        loading={!!saving}
                                    >
                                        Save
                                    </PaperButton>
                                </View>
                            )}
                        </View>
                    </View>
                </Modal>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F6FB' },
    content: { padding: 16, paddingBottom: 80 },

    infoCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#EDE9FE',
        borderRadius: 18,
        padding: 16,
        marginBottom: 20,
        gap: 12,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: '#4C1D95',
        lineHeight: 20,
    },

    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
    },
    cardActive: {
        borderColor: '#C4B5FD',
        backgroundColor: '#FDFCFF',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconWrap: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: '#111827',
    },
    cardDesc: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 3,
        lineHeight: 18,
    },

    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 14,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        gap: 8,
    },
    timeText: {
        fontSize: 15,
        fontWeight: '700',
    },

    pickerOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(15,23,42,0.45)',
    },
    pickerSheet: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 24,
        paddingBottom: 40,
    },
    pickerHandle: {
        width: 42,
        height: 5,
        borderRadius: 3,
        backgroundColor: '#D6D6D6',
        alignSelf: 'center',
        marginBottom: 16,
    },
    pickerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 20,
        textAlign: 'center',
    },
    pickerButtons: {
        flexDirection: 'row',
        marginTop: 24,
    },
});