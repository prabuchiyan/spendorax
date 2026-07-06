import React, { useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { TextInput as PaperInput, Button, Avatar } from 'react-native-paper';
import Card from './Card';

export default function BudgetCreateModal({
    visible,
    onClose,
    onSave,
    editData,
    selectedCategory,
    setSelectedCategory,
    categoryBudgetAmount,
    setCategoryBudgetAmount,
    showCategoryDropdown,
    setShowCategoryDropdown,
    searchText,
    setSearchText,
    filteredCategories,
    handleSaveBudget,
}) {
    useEffect(() => {
        if (editData) {
            setSelectedCategory({
                id: editData.categoryId,
                name: editData.categoryName,
                icon: editData.icon,
                color: editData.color,
            });
            setCategoryBudgetAmount(String(editData.budget));
        } else {
            setSelectedCategory(null);
            setCategoryBudgetAmount('');
            setSearchText('');
            setShowCategoryDropdown(false);
        }
    }, [
        editData,
        visible,
        setSelectedCategory,
        setCategoryBudgetAmount,
        setSearchText,
        setShowCategoryDropdown,
    ]);
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <Card>
                        <Text style={styles.title}>
                            {editData ? 'Edit Category Budget' : 'Add Category Budget'}
                        </Text>

                        {/* Category */}
                        <TouchableOpacity
                            onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                            style={styles.dropdown}
                        >
                            <Text style={{ color: selectedCategory ? '#333' : '#999' }}>
                                {selectedCategory
                                    ? selectedCategory.name
                                    : 'Select Category'}
                            </Text>
                        </TouchableOpacity>

                        {showCategoryDropdown && (
                            <View style={styles.dropdownContainer}>
                                <PaperInput
                                    placeholder="Search categories..."
                                    value={searchText}
                                    onChangeText={setSearchText}
                                    mode="flat"
                                    style={{ backgroundColor: '#fff' }}
                                />

                                <FlatList
                                    data={filteredCategories}
                                    keyExtractor={(item) => String(item.id)}
                                    keyboardShouldPersistTaps="handled"
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={styles.item}
                                            onPress={() => {
                                                setSelectedCategory(item);
                                                setShowCategoryDropdown(false);
                                                setSearchText('');
                                            }}
                                        >
                                            <Avatar.Icon
                                                size={32}
                                                icon={item.icon}
                                                style={{
                                                    backgroundColor: item.color,
                                                    marginRight: 10,
                                                }}
                                            />
                                            <Text>{item.name}</Text>
                                        </TouchableOpacity>
                                    )}
                                />
                            </View>
                        )}

                        <PaperInput
                            label="Budget Amount"
                            mode="outlined"
                            value={categoryBudgetAmount}
                            keyboardType="numeric"
                            onChangeText={setCategoryBudgetAmount}
                            style={{ marginTop: 12 }}
                        />

                        <View style={styles.actions}>
                            <Button onPress={onClose}>Cancel</Button>

                            <Button
                                mode="contained"
                                onPress={async () => {
                                    const success = await handleSaveBudget();

                                    if (success) {
                                        onSave();
                                    }
                                }}
                            >
                                {editData ? 'Update' : 'Save'}
                            </Button>
                        </View>
                    </Card>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        padding: 16,
    },

    container: {
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 16,
    },

    title: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 16,
    },

    dropdown: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
    },

    dropdownContainer: {
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        maxHeight: 300,
    },

    item: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },

    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 20,
    },
});