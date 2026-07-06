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

                        <Text style={{ marginBottom: 6, color: '#666' }}>Category</Text>

                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setShowCategoryDropdown(true)}
                            style={{
                                borderWidth: 1,
                                borderColor: '#eee',
                                padding: 12,
                                borderRadius: 8,
                                backgroundColor: '#fff',
                                flexDirection: 'row',
                                alignItems: 'center',
                            }}
                        >
                            <View
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 18,
                                    backgroundColor: selectedCategory?.color || '#eee',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 12,
                                }}
                            >
                                <Avatar.Icon
                                    size={24}
                                    icon={selectedCategory?.icon || 'tag'}
                                    style={{
                                        backgroundColor: 'transparent',
                                    }}
                                    color="#fff"
                                />
                            </View>

                            <Text style={{ fontSize: 16 }}>
                                {selectedCategory?.name || 'Select Category'}
                            </Text>
                        </TouchableOpacity>

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
                                        borderRadius: 8,
                                        maxHeight: '80%',
                                    }}
                                >
                                    <PaperInput
                                        label="Search"
                                        value={searchText}
                                        onChangeText={setSearchText}
                                        mode="outlined"
                                        style={{ marginBottom: 8 }}
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
                                                    padding: 10,
                                                    borderBottomWidth: 1,
                                                    borderColor: '#f3f3f3',
                                                    backgroundColor:
                                                        selectedCategory?.id === item.id
                                                            ? '#FFF9F9'
                                                            : '#fff',
                                                }}
                                            >
                                                <View
                                                    style={{
                                                        width: 36,
                                                        height: 36,
                                                        borderRadius: 18,
                                                        backgroundColor: item.color,
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        marginRight: 12,
                                                    }}
                                                >
                                                    <Avatar.Icon
                                                        size={22}
                                                        icon={item.icon}
                                                        style={{ backgroundColor: 'transparent' }}
                                                        color="#fff"
                                                    />
                                                </View>

                                                <Text style={{ fontSize: 16 }}>
                                                    {item.name}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    />

                                    <View style={{ height: 8 }} />

                                    <Button
                                        mode="outlined"
                                        onPress={() => setShowCategoryDropdown(false)}
                                    >
                                        Close
                                    </Button>
                                </View>
                            </View>
                        </Modal>

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