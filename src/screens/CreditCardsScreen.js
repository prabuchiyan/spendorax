import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getCreditCards, deleteCreditCard } from '../services/creditCards';
import Card from '../components/Card';
import ConfirmDialog from '../components/ConfirmDialog';
import CreditCardCreateModal from '../components/CreditCardCreateModal';
import FAB from '../components/FAB';
import { Colors, Spacing } from '../components/Theme';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { createCreditCard, updateCreditCard, getCreditCardById } from '../services/creditCards';

export default function CreditCardsScreen({ navigation }) {
    const [cards, setCards] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editCard, setEditCard] = useState(null);
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [confirmTargetId, setConfirmTargetId] = useState(null);

    const load = async () => {
        const items = await getCreditCards(true);
        setCards(items);
    };

    useFocusEffect(
        useCallback(() => {
            load();
        }, [])
    );

    const handleDelete = async () => {
        await deleteCreditCard(confirmTargetId);
        setConfirmVisible(false);
        setConfirmTargetId(null);
        load();
    };

    const totals = cards.reduce(
        (acc, card) => {
            acc.limit += Number(card.credit_limit || 0);
            acc.outstanding += Number(card.outstanding || 0);
            acc.available += Number(card.available_limit || 0);
            return acc;
        },
        { limit: 0, outstanding: 0, available: 0 }
    );

    return (
        <View style={{ flex: 1, backgroundColor: Colors.background }}>
            <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Total Limit</Text>
                    <Text style={styles.summaryValue}>₹{totals.limit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                </View>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Outstanding</Text>
                    <Text style={styles.summaryValue}>₹{totals.outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                </View>
            </View>
            <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Available</Text>
                    <Text style={styles.summaryValue}>₹{totals.available.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                </View>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Cards</Text>
                    <Text style={styles.summaryValue}>{cards.length}</Text>
                </View>
            </View>

            <FlatList
                data={cards}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={{ padding: Spacing.s, paddingBottom: 100 }}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <MaterialCommunityIcons name="credit-card-outline" size={48} color="#ccc" />
                        <Text style={styles.emptyText}>No credit cards added yet</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <Card style={{ marginBottom: Spacing.s }}>
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => {
                                if (item.source_id) {
                                    navigation.navigate('SourcesDetails', {
                                        sourceId: item.source_id,
                                        sourceName: item.name,
                                    });
                                }
                            }}
                        >
                            <View style={styles.cardRow}>
                                <View style={styles.cardInfo}>
                                    <View style={[styles.iconBadge, { backgroundColor: (item.color || Colors.primary) + '15' }]}>
                                        <MaterialCommunityIcons name="credit-card" size={24} color={item.color || Colors.primary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.cardName}>{item.name}</Text>
                                        <Text style={styles.cardMeta}>{item.bank || 'Bank'} • •••• {item.last4 || '0000'}</Text>
                                        <Text style={styles.cardMeta}>{item.network || 'Card'} • {item.currency || 'INR'}</Text>
                                    </View>
                                </View>
                                <View style={styles.cardActions}>
                                    <Text style={styles.cardAmount}>₹{Number(item.outstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                                    <Text style={styles.cardSubtext}>Outstanding</Text>
                                    <View style={styles.actionButtons}>
                                        <TouchableOpacity
                                            onPress={async () => {
                                                const card = await getCreditCardById(item.id);
                                                setEditCard({ ...card });
                                                setShowModal(true);
                                            }}
                                            style={styles.iconButton}>
                                            <Feather name="edit-2" size={18} color={Colors.primary} />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => { setConfirmTargetId(item.id); setConfirmVisible(true); }} style={styles.iconButton}>
                                            <Feather name="trash-2" size={18} color="#E46A6A" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    </Card>
                )}
            />

            <ConfirmDialog
                visible={confirmVisible}
                title="Delete Credit Card"
                message="Archive this credit card? Transactions will remain intact."
                onCancel={() => setConfirmVisible(false)}
                onConfirm={handleDelete}
            />

            <CreditCardCreateModal
                key={editCard ? `edit-${editCard.id}` : 'new'}
                visible={showModal}
                onClose={() => {
                    setShowModal(false);
                    setEditCard(null);
                }}
                editData={editCard}
                onSave={async (payload) => {
                    if (editCard) {
                        await updateCreditCard(editCard.id, payload);
                    } else {
                        await createCreditCard(payload);
                    }
                    load();
                }}
            />

            <FAB onPress={() => { setEditCard(null); setShowModal(true); }} />
        </View>
    );
}

const styles = StyleSheet.create({
    summaryRow: {
        flexDirection: 'row',
        padding: Spacing.s,
    },
    summaryCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 14,
        marginRight: 10,
        elevation: 1,
    },
    summaryLabel: {
        fontSize: 12,
        color: Colors.muted,
        marginBottom: 6,
    },
    summaryValue: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.text,
    },
    cardRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBadge: {
        width: 52,
        height: 52,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    cardName: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.text,
    },
    cardMeta: {
        color: Colors.muted,
        fontSize: 12,
        marginTop: 2,
    },
    cardActions: {
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        minWidth: 110,
    },
    cardAmount: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.text,
    },
    cardSubtext: {
        color: Colors.muted,
        fontSize: 12,
    },
    actionButtons: {
        flexDirection: 'row',
        marginTop: 10,
    },
    iconButton: {
        padding: 8,
        marginLeft: 8,
    },
    actionRow: {
        paddingHorizontal: Spacing.s,
        paddingBottom: Spacing.s,
    },
    statementButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    statementButtonText: {
        marginLeft: 10,
        color: Colors.primary,
        fontWeight: '700',
        fontSize: 14,
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 60,
    },
    emptyText: {
        color: Colors.muted,
        marginTop: 10,
        fontSize: 14,
    },
});
