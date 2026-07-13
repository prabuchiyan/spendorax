import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Snackbar } from 'react-native-paper';
import { getLoanById, unlinkTransactionFromLoan } from '../services/loans';
import { getTransactions } from '../services/transactions';
import events from '../services/events';
import Card from '../components/Card';
import calc from '../services/loanCalculations';
import { Colors } from '../components/Theme';
import LoanPrepaymentModal from '../components/LoanPrepaymentModal';
import LoanForeclosureModal from '../components/LoanForeclosureModal';

function ActionButton({
    icon,
    title,
    color,
    onPress,
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.85}
            style={{
                width: '31%',
                backgroundColor: '#F8FAFC',
                borderRadius: 18,
                paddingVertical: 14,
                marginBottom: 12,
                alignItems: 'center',
            }}
        >
            <View
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: color + '20',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                <MaterialCommunityIcons
                    name={icon}
                    size={22}
                    color={color}
                />
            </View>

            <Text
                style={{
                    marginTop: 8,
                    fontSize: 12,
                    fontWeight: '700',
                    color: '#374151',
                }}
            >
                {title}
            </Text>
        </TouchableOpacity>
    );
}

function Metric({
    label,
    value,
    color,
}) {
    return (
        <View style={{ alignItems: 'center' }}>

            <Text
                style={{
                    fontSize: 11,
                    color: '#64748B',
                }}
            >
                {label}
            </Text>

            <Text
                style={{
                    marginTop: 4,
                    color,
                    fontWeight: '800',
                    fontSize: 13,
                }}
            >
                ₹{Number(value || 0).toLocaleString('en-IN')}
            </Text>

        </View>
    );
}

export default function LoanDetailsScreen({ route, navigation }) {
    const id = route?.params?.id;
    const [loan, setLoan] = useState(null);
    const [showPrepayment, setShowPrepayment] = useState(false);
    const [showForeclosure, setShowForeclosure] = useState(false);
    const [linkedTxs, setLinkedTxs] = useState([]);
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMsg, setSnackbarMsg] = useState('');

    useEffect(() => {
        (async () => {
            if (!id) return;
            const l = await getLoanById(id);
            setLoan(l);
        })();
    }, [id]);

    useEffect(() => {
        loadLinkedTransactions();
        const offTx = events.on('transactionsChanged', () => loadLinkedTransactions());
        const offLoans = events.on('loansChanged', () => loadLinkedTransactions());
        return () => {
            offTx && offTx();
            offLoans && offLoans();
        };
    }, [id]);

    async function loadLinkedTransactions() {
        if (!id) return setLinkedTxs([]);
        const txs = await getTransactions(1000, 'Yes');
        const linked = txs.filter(t => Number(t.loan_id) === Number(id));
        // sort desc by date
        linked.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setLinkedTxs(linked);
    }

    async function refresh() {
        const l = await getLoanById(id);
        setLoan(l);
    }

    if (!loan) return null;

    const originalPrincipal = Number(loan.principal_amount || 0);
    const paidSoFar = Number(loan.total_paid || 0);
    const remainingAmount = Number(loan.outstanding_amount || 0);
    const remainingMonths = Number(loan.remaining_months || 0) === Infinity ? 0 : Number(loan.remaining_months || 0);
    const interestToPay = remainingAmount > 0 && remainingMonths > 0 && loan.emi_amount > 0
        ? calc.generateAmortizationSchedule(remainingAmount, loan.interest_rate, remainingMonths).reduce((sum, item) => sum + Number(item.interest || 0), 0)
        : 0;

    return (
        <ScrollView style={{ flex: 1, backgroundColor: Colors.background, padding: 12 }}>
            <Card style={{ borderRadius: 24, overflow: 'hidden' }}>

                {/* ================= HEADER ================= */}

                <View
                    style={{
                        backgroundColor: '#2563EB',
                        margin: -16,
                        marginBottom: 18,
                        padding: 20,
                        borderBottomLeftRadius: 24,
                        borderBottomRightRadius: 24,
                    }}
                >

                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >

                        <View style={{ flex: 1 }}>

                            <Text
                                style={{
                                    color: '#FFFFFF',
                                    fontSize: 22,
                                    fontWeight: '900',
                                }}
                            >
                                {loan.loan_name}
                            </Text>

                            <Text
                                style={{
                                    color: '#DCE8FF',
                                    marginTop: 4,
                                    fontSize: 14,
                                }}
                            >
                                {loan.lender}
                            </Text>

                        </View>

                        <View
                            style={{
                                backgroundColor:
                                    loan.status === 'Closed'
                                        ? '#DCFCE7'
                                        : '#DBEAFE',
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                                borderRadius: 30,
                            }}
                        >

                            <Text
                                style={{
                                    color:
                                        loan.status === 'Closed'
                                            ? '#16A34A'
                                            : '#2563EB',
                                    fontWeight: '800',
                                }}
                            >
                                {loan.status || 'Active'}
                            </Text>

                        </View>

                    </View>

                    <View style={{ marginTop: 24 }}>

                        <Text
                            style={{
                                color: '#DCE8FF',
                                fontSize: 13,
                            }}
                        >
                            Outstanding Balance
                        </Text>

                        <Text
                            style={{
                                color: '#FFFFFF',
                                fontSize: 34,
                                fontWeight: '900',
                                marginTop: 4,
                            }}
                        >
                            ₹{remainingAmount.toLocaleString('en-IN')}
                        </Text>

                    </View>

                </View>

                {/* ================= REPAYMENT ================= */}

                <View>

                    <View
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            marginBottom: 8,
                        }}
                    >
                        <Text
                            style={{
                                fontWeight: '700',
                                color: '#374151',
                            }}
                        >
                            Loan Repayment
                        </Text>

                        <Text
                            style={{
                                fontWeight: '900',
                                color: '#16A34A',
                            }}
                        >
                            {originalPrincipal > 0
                                ? Math.round(
                                    ((originalPrincipal - remainingAmount) /
                                        originalPrincipal) *
                                    100
                                )
                                : 0}
                            %
                        </Text>

                    </View>

                    <View
                        style={{
                            height: 10,
                            backgroundColor: '#E5E7EB',
                            borderRadius: 10,
                            overflow: 'hidden',
                        }}
                    >

                        <View
                            style={{
                                width: `${originalPrincipal > 0
                                    ? Math.round(
                                        ((originalPrincipal -
                                            remainingAmount) /
                                            originalPrincipal) *
                                        100
                                    )
                                    : 0
                                    }%`,
                                height: 10,
                                backgroundColor: '#22C55E',
                                borderRadius: 10,
                            }}
                        />

                    </View>

                </View>

                {/* ================= METRICS ================= */}

                <View
                    style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        marginTop: 22,
                    }}
                >

                    {[
                        {
                            label: 'Original',
                            value: `₹${originalPrincipal.toLocaleString('en-IN')}`,
                        },
                        {
                            label: 'Paid',
                            value: `₹${paidSoFar.toLocaleString('en-IN')}`,
                        },
                        {
                            label: 'EMI',
                            value: `₹${Number(
                                loan.emi_amount || 0
                            ).toLocaleString('en-IN')}`,
                        },
                        {
                            label: 'Interest',
                            value: `${loan.interest_rate}%`,
                        },
                        {
                            label: 'Remaining',
                            value: remainingMonths,
                        },
                        {
                            label: 'Interest Left',
                            value: `₹${interestToPay.toLocaleString(
                                'en-IN'
                            )}`,
                        },
                    ].map((item, index) => (

                        <View
                            key={index}
                            style={{
                                width: '48%',
                                backgroundColor: '#F8FAFC',
                                padding: 14,
                                borderRadius: 16,
                                marginBottom: 12,
                            }}
                        >

                            <Text
                                style={{
                                    color: '#64748B',
                                    fontSize: 12,
                                }}
                            >
                                {item.label}
                            </Text>

                            <Text
                                style={{
                                    marginTop: 6,
                                    fontSize: 18,
                                    fontWeight: '900',
                                    color: '#111827',
                                }}
                            >
                                {item.value}
                            </Text>

                        </View>

                    ))}

                </View>

                {/* ================= ACTIONS ================= */}

                <View
                    style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        marginTop: 8,
                    }}
                >

                    <ActionButton
                        color="#2563EB"
                        icon="cash-fast"
                        title="Pay EMI"
                        onPress={() =>
                            navigation.navigate('LoanPayment', {
                                id: loan.id,
                            })
                        }
                    />

                    <ActionButton
                        color="#16A34A"
                        icon="cash-plus"
                        title="Prepay"
                        onPress={() => setShowPrepayment(true)}
                    />

                    <ActionButton
                        color="#EA580C"
                        icon="bank-remove"
                        title="Close"
                        onPress={() => setShowForeclosure(true)}
                    />

                    <ActionButton
                        color="#7C3AED"
                        icon="history"
                        title="History"
                        onPress={() =>
                            navigation.navigate('LoanHistory', {
                                id: loan.id,
                            })
                        }
                    />

                    <ActionButton
                        color="#64748B"
                        icon="file-chart"
                        title="Reports"
                        onPress={() =>
                            navigation.navigate('LoanReports')
                        }
                    />

                    <ActionButton
                        color="#0F766E"
                        icon="pencil"
                        title="Edit"
                        onPress={() =>
                            navigation.navigate('LoanForm', {
                                id: loan.id,
                            })
                        }
                    />

                </View>

            </Card>

            <LoanPrepaymentModal visible={showPrepayment} onClose={() => setShowPrepayment(false)} loanId={loan.id} onSaved={refresh} />
            <LoanForeclosureModal visible={showForeclosure} onClose={() => setShowForeclosure(false)} loanId={loan.id} onSaved={refresh} />
            <View style={{ height: 12 }} />
            <Card style={{ borderRadius: 22 }}>

                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 18,
                    }}
                >

                    <Text
                        style={{
                            fontSize: 18,
                            fontWeight: '900',
                        }}
                    >
                        Linked Transactions
                    </Text>

                    <View
                        style={{
                            backgroundColor: '#EEF2FF',
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 20,
                        }}
                    >

                        <Text
                            style={{
                                color: '#2563EB',
                                fontWeight: '800',
                            }}
                        >
                            {linkedTxs.length}
                        </Text>

                    </View>

                </View>

                {linkedTxs.length === 0 ? (

                    <View
                        style={{
                            alignItems: 'center',
                            paddingVertical: 30,
                        }}
                    >

                        <MaterialCommunityIcons
                            name="link-variant-off"
                            size={48}
                            color="#CBD5E1"
                        />

                        <Text
                            style={{
                                marginTop: 12,
                                fontSize: 16,
                                fontWeight: '700',
                            }}
                        >
                            No linked transactions
                        </Text>

                        <Text
                            style={{
                                marginTop: 6,
                                color: '#64748B',
                            }}
                        >
                            Payments will appear here.
                        </Text>

                    </View>

                ) : (

                    linkedTxs.map((tx, index) => (

                        <View
                            key={tx.id}
                            style={{
                                flexDirection: 'row',
                                marginBottom:
                                    index === linkedTxs.length - 1
                                        ? 0
                                        : 18,
                            }}
                        >

                            {/* Timeline */}

                            <View
                                style={{
                                    alignItems: 'center',
                                    marginRight: 14,
                                }}
                            >

                                <View
                                    style={{
                                        width: 42,
                                        height: 42,
                                        borderRadius: 21,
                                        backgroundColor: '#DCFCE7',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                    }}
                                >

                                    <MaterialCommunityIcons
                                        name="cash-check"
                                        size={20}
                                        color="#16A34A"
                                    />

                                </View>

                                {index !== linkedTxs.length - 1 && (

                                    <View
                                        style={{
                                            width: 2,
                                            flex: 1,
                                            backgroundColor: '#E5E7EB',
                                            marginTop: 4,
                                        }}
                                    />

                                )}

                            </View>

                            {/* Card */}

                            <View
                                style={{
                                    flex: 1,
                                    backgroundColor: '#F8FAFC',
                                    borderRadius: 18,
                                    padding: 14,
                                }}
                            >

                                <View
                                    style={{
                                        flexDirection: 'row',
                                        justifyContent: 'space-between',
                                    }}
                                >

                                    <Text
                                        style={{
                                            fontWeight: '800',
                                            fontSize: 15,
                                            flex: 1,
                                        }}
                                    >
                                        {tx.notes || 'Loan Payment'}
                                    </Text>

                                    <Text
                                        style={{
                                            color: '#16A34A',
                                            fontWeight: '900',
                                            fontSize: 16,
                                        }}
                                    >
                                        ₹{Number(tx.amount || 0).toLocaleString('en-IN')}
                                    </Text>

                                </View>

                                <Text
                                    style={{
                                        color: '#64748B',
                                        marginTop: 6,
                                        fontSize: 12,
                                    }}
                                >
                                    {new Date(tx.date).toLocaleString()}
                                </Text>

                                <View
                                    style={{
                                        flexDirection: 'row',
                                        justifyContent: 'space-between',
                                        marginTop: 14,
                                    }}
                                >

                                    <Metric
                                        label="Principal"
                                        value={tx.principal_component}
                                        color="#2563EB"
                                    />

                                    <Metric
                                        label="Interest"
                                        value={tx.interest_component}
                                        color="#EA580C"
                                    />

                                    <Metric
                                        label="Balance"
                                        value={
                                            tx.outstanding_after_payment ||
                                            loan.outstanding_amount
                                        }
                                        color="#DC2626"
                                    />

                                </View>

                                <TouchableOpacity
                                    style={{
                                        alignSelf: 'flex-end',
                                        marginTop: 14,
                                    }}
                                    onPress={async () => {
                                        try {
                                            await unlinkTransactionFromLoan(tx.id);
                                            await loadLinkedTransactions();
                                            await refresh();
                                            setSnackbarMsg("Transaction unlinked");
                                        } catch (e) {
                                            console.error(e);
                                            setSnackbarMsg(e.message);
                                        }
                                        setSnackbarVisible(true);
                                    }}
                                >
                                    <Text
                                        style={{
                                            color: '#DC2626',
                                            fontWeight: '800',
                                        }}
                                    >
                                        Unlink
                                    </Text>
                                </TouchableOpacity>

                            </View>

                        </View>

                    ))

                )}

            </Card>
            <Snackbar visible={snackbarVisible} onDismiss={() => setSnackbarVisible(false)} duration={3000} action={{ label: 'OK', onPress: () => setSnackbarVisible(false) }}>
                {snackbarMsg}
            </Snackbar>
        </ScrollView>
    );
}
