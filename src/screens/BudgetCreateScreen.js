import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput as PaperInput, Button as PaperButton, Avatar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { saveCategoryBudget, getCategoryBudgetSummary } from '../services/categoryBudgets';
import { getBudgetsForMonth, updateBudget, createBudget } from '../services/budgets';
import { getCategories } from '../services/categories';
import events from '../services/events';

function FieldCard({ icon, title, value, color = "#2563EB", onPress, error, disabled }) {
    const hasError = !!error;
    return (
        <View style={{ marginBottom: 16 }}>
            <TouchableOpacity
                activeOpacity={0.85}
                onPress={onPress}
                disabled={disabled}
                style={[
                    {
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "#FFFFFF",
                        borderRadius: 18,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        borderWidth: 1,
                        borderColor: hasError ? "#FECACA" : "#F1F5F9",
                    },
                    disabled && { opacity: 0.6 }
                ]}
            >
                <View
                    style={[
                        {
                            width: 44,
                            height: 44,
                            borderRadius: 14,
                            justifyContent: "center",
                            alignItems: "center",
                            marginRight: 14,
                        },
                        {
                            backgroundColor: hasError ? "#FEE2E2" : color + "20",
                        },
                    ]}
                >
                    <MaterialCommunityIcons
                        name={hasError ? "alert-circle-outline" : icon}
                        size={22}
                        color={hasError ? "#DC2626" : color}
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[{ fontSize: 13, color: "#64748B", fontWeight: "600", marginBottom: 2 }, hasError && { color: "#DC2626" }]}>
                        {title}
                        <Text style={{ color: "#DC2626" }}> *</Text>
                    </Text>
                    <Text
                        style={[{ fontSize: 16, color: "#0F172A", fontWeight: "700" }, hasError && { color: "#991B1B" }]}
                        numberOfLines={1}
                    >
                        {value}
                    </Text>
                </View>
                <MaterialCommunityIcons
                    name={hasError ? "alert-circle" : "chevron-right"}
                    size={22}
                    color={hasError ? "#DC2626" : "#94A3B8"}
                />
            </TouchableOpacity>
            {hasError && (
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, marginLeft: 4 }}>
                    <MaterialCommunityIcons name="alert-circle" size={16} color="#DC2626" />
                    <Text style={{ color: "#DC2626", fontSize: 12, marginLeft: 6, fontWeight: "500" }}>{error}</Text>
                </View>
            )}
        </View>
    );
}

export default function BudgetCreateScreen({ route, navigation }) {
    const editData = route.params?.editData;
    const selectedMonth = route.params?.selectedMonth;
    const selectedYear = route.params?.selectedYear;
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [categoryBudgetAmount, setCategoryBudgetAmount] = useState('');
    const [searchText, setSearchText] = useState('');
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (editData) {
            setSelectedCategory({
                id: editData.categoryId,
                name: editData.categoryName,
                icon: editData.icon,
                color: editData.color,
            });
            setCategoryBudgetAmount(String(editData.budget));
        }
        loadCategories();
    }, [editData]);

    async function loadCategories() {
        const cats = await getCategories(true);
        setCategories(cats || []);
    }

    async function syncOverallBudget() {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const budgets = await getCategoryBudgetSummary(currentMonth, currentYear);
        const totalCategoryBudgets = budgets.reduce((sum, item) => sum + item.budget, 0);
        const rows = await getBudgetsForMonth();
        const general = rows.find((r) => r.category_id == null);
        if (general) {
            await updateBudget(general.id, {
                category_id: null,
                monthly_limit: totalCategoryBudgets,
                month: null
            });
        } else if (totalCategoryBudgets > 0) {
            await createBudget({
                monthly_limit: totalCategoryBudgets,
                category_id: null,
                month: null
            });
        }
    }

    async function handleSaveBudget() {
        let newErrors = {};
        if (!selectedCategory) {
            newErrors.category = 'Please select a category';
        }
        const amount = parseFloat(categoryBudgetAmount) || 0;
        if (amount <= 0) {
            newErrors.amount = 'Please enter a valid amount';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        try {
            setLoading(true);
            await new Promise(resolve => requestAnimationFrame(resolve)); // Allow UI to render the loading state on button
            await saveCategoryBudget(
                selectedCategory.id,
                amount,
                selectedMonth,
                selectedYear
            );
            await syncOverallBudget();
            events.emit('budgetsChanged');
            navigation.goBack();
        } catch (e) {
            Alert.alert("Error", e?.message || "Failed to save category budget.");
        } finally {
            setLoading(false);
        }
    }

    const filteredCategories = categories.filter((c) =>
        c.name.toLowerCase().includes(searchText.toLowerCase())
    );

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: "#FFF" }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ flexGrow: 1 }}
            >
                {/* ── HEADER ── */}
                <View
                    style={{
                        backgroundColor: "#36B37E",
                        padding: 24,
                        paddingTop: 32,
                        paddingBottom: 40,
                        borderBottomLeftRadius: 40,
                        borderBottomRightRadius: 40,
                        marginBottom: 32,
                    }}
                >
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View
                            style={{
                                width: 64,
                                height: 64,
                                borderRadius: 20,
                                backgroundColor: "rgba(255,255,255,0.2)",
                                justifyContent: "center",
                                alignItems: "center",
                                marginRight: 16,
                            }}
                        >
                            <MaterialCommunityIcons
                                name="bullseye-arrow"
                                size={32}
                                color="#FFF"
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: "#FFF", fontSize: 26, fontWeight: "900", letterSpacing: 0.5 }}>
                                {editData ? 'Edit Budget' : 'Add Budget'}
                            </Text>
                            <Text style={{ color: "#E8F8F0", marginTop: 6, fontSize: 14 }}>
                                Set a spending limit for a specific category to track your goals
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ── FORM ── */}
                <View style={{ paddingHorizontal: 24, flex: 1 }}>
                    {/* ── CATEGORY ── */}
                    <FieldCard
                        icon={selectedCategory?.icon || "shape-outline"}
                        color={selectedCategory?.color || "#EA580C"}
                        title="Category"
                        value={selectedCategory ? selectedCategory.name : "Select Category"}
                        error={errors.category}
                        disabled={loading}
                        onPress={() => {
                            setShowCategoryDropdown(true);
                            setErrors((prev) => ({ ...prev, category: undefined }));
                        }}
                    />

                    {/* ── AMOUNT ── */}
                    <View style={{ marginBottom: 16, marginTop: 12 }}>
                        <Text style={{ fontSize: 13, color: "#64748B", fontWeight: "700", marginBottom: 8, marginLeft: 4 }}>
                            BUDGET LIMIT
                        </Text>
                        <PaperInput
                            mode="outlined"
                            keyboardType="numeric"
                            value={categoryBudgetAmount}
                            onChangeText={(val) => {
                                setCategoryBudgetAmount(val);
                                setErrors((prev) => ({ ...prev, amount: undefined }));
                            }}
                            error={!!errors.amount}
                            outlineColor="#E2E8F0"
                            activeOutlineColor="#36B37E"
                            style={{ backgroundColor: "#FAFAFA", fontSize: 24, fontWeight: '700', paddingVertical: 8 }}
                            disabled={loading}
                            left={<PaperInput.Affix text="₹ " textStyle={{ fontSize: 24, color: '#36B37E', fontWeight: '700' }} />}
                            placeholder="0.00"
                        />
                        {!!errors.amount && (
                            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, marginLeft: 4 }}>
                                <MaterialCommunityIcons name="alert-circle" size={16} color="#DC2626" />
                                <Text style={{ color: "#DC2626", fontSize: 12, marginLeft: 6, fontWeight: "500" }}>
                                    {errors.amount}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* SPACER TO PUSH BUTTON TO BOTTOM */}
                    <View style={{ flex: 1, minHeight: 40 }} />

                    <PaperButton
                        mode="contained"
                        onPress={handleSaveBudget}
                        loading={loading}
                        disabled={loading}
                        buttonColor="#36B37E"
                        style={{ borderRadius: 16, paddingVertical: 8, marginBottom: 24 }}
                        labelStyle={{ fontSize: 18, fontWeight: "800", color: "#FFF", letterSpacing: 0.5 }}
                    >
                        Save Budget
                    </PaperButton>
                </View>
            </ScrollView>

            {/* CATEGORY PICKER MODAL */}
            <Modal
                visible={showCategoryDropdown}
                transparent
                animationType="slide"
                onRequestClose={() => setShowCategoryDropdown(false)}
            >
                <View
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0,0,0,0.4)',
                        justifyContent: 'center',
                        padding: 20,
                    }}
                >
                    <View
                        style={{
                            backgroundColor: '#fff',
                            padding: 12,
                            borderRadius: 16,
                            maxHeight: '80%',
                        }}
                    >
                        <Text style={{ fontSize: 18, fontWeight: '800', marginBottom: 12, marginLeft: 4 }}>
                            Select Category
                        </Text>
                        <PaperInput
                            label="Search"
                            value={searchText}
                            onChangeText={setSearchText}
                            mode="outlined"
                            style={{ marginBottom: 12 }}
                            activeOutlineColor="#36B37E"
                        />
                        <FlatList
                            data={filteredCategories}
                            keyExtractor={(item) => item.id.toString()}
                            keyboardShouldPersistTaps="handled"
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    onPress={() => {
                                        setSelectedCategory(item);
                                        setShowCategoryDropdown(false);
                                        setSearchText('');
                                    }}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        padding: 12,
                                        borderBottomWidth: 1,
                                        borderColor: '#f3f3f3',
                                        backgroundColor:
                                            selectedCategory?.id === item.id
                                                ? '#F6FBF7'
                                                : '#fff',
                                        borderRadius: 8,
                                    }}
                                >
                                    <View
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 20,
                                            backgroundColor: item.color,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginRight: 12,
                                        }}
                                    >
                                        <Avatar.Icon
                                            size={26}
                                            icon={item.icon}
                                            style={{ backgroundColor: 'transparent' }}
                                            color="#fff"
                                        />
                                    </View>
                                    <Text style={{ fontSize: 16, fontWeight: '600' }}>
                                        {item.name}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        />
                        <View style={{ height: 8 }} />
                        <PaperButton
                            mode="outlined"
                            textColor="#64748B"
                            style={{ borderColor: "#CBD5E1", borderRadius: 12 }}
                            onPress={() => setShowCategoryDropdown(false)}
                        >
                            Cancel
                        </PaperButton>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}