import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { TextInput as PaperInput, Button, Avatar, IconButton } from 'react-native-paper';
import { createBudget, getBudgetsForMonth, updateBudget } from '../services/budgets';
import { saveCategoryBudget, deleteCategoryBudget, getCategoryBudgetSummary } from '../services/categoryBudgets';
import { getCategories } from '../services/categories';
import events from '../services/events';
import Card from '../components/Card';
import { Spacing } from '../components/Theme';
import ConfirmDialog from '../components/ConfirmDialog';

export default function BudgetsScreen({ route, navigation }) {
  const [tab, setTab] = useState('overall');
  const [limit, setLimit] = useState('');
  const [currentBudgetId, setCurrentBudgetId] = useState(null);

  // Category budget tab
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryBudgetAmount, setCategoryBudgetAmount] = useState('');
  const [categoryBudgets, setCategoryBudgets] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [deletingBudgetId, setDeletingBudgetId] = useState(null);
  const [editingBudgetId, setEditingBudgetId] = useState(null);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  async function load() {
    // Load overall budget
    const rows = await getBudgetsForMonth();
    const general = rows.find(r => r.category_id == null) || rows[0];
    if (general) {
      setCurrentBudgetId(general.id);
      setLimit(String(general.monthly_limit || ''));
    } else {
      setCurrentBudgetId(null);
      setLimit('');
    }

    // Load categories
    const cats = await getCategories(true);
    setCategories(cats);

    // Load category budgets
    const budgets = await getCategoryBudgetSummary(currentMonth, currentYear);
    setCategoryBudgets(budgets);
  }

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', () => { load(); });
    return unsub;
  }, [navigation]);

  async function setNow() {
    const value = parseFloat(limit) || 0;
    if (currentBudgetId) {
      await updateBudget(currentBudgetId, { category_id: null, monthly_limit: value, month: null });
      events.emit('budgetsChanged', currentBudgetId);
    } else {
      const id = await createBudget({ monthly_limit: value, category_id: null, month: null });
      events.emit('budgetsChanged', id);
    }
    await load();
    if (typeof navigation !== 'undefined' && navigation) {
      navigation.navigate('Dashboard');
    }
  }

  async function syncOverallBudget() {
    const budgets = await getCategoryBudgetSummary(
      currentMonth,
      currentYear
    );

    const totalCategoryBudgets = budgets.reduce(
      (sum, item) => sum + item.budget,
      0
    );

    const rows = await getBudgetsForMonth();
    const general = rows.find(r => r.category_id == null);

    if (general) {
      await updateBudget(general.id, {
        category_id: null,
        monthly_limit: totalCategoryBudgets,
        month: null,
      });
    } else if (totalCategoryBudgets > 0) {
      const id = await createBudget({
        monthly_limit: totalCategoryBudgets,
        category_id: null,
        month: null,
      });

      setCurrentBudgetId(id);
    }
  }

  async function saveCategoryBudgetNow() {
    if (!selectedCategory) {
      alert('Please select a category');
      return;
    }
    const amount = parseFloat(categoryBudgetAmount) || 0;
    if (amount <= 0) {
      alert('Please enter valid amount');
      return;
    }
    await saveCategoryBudget(selectedCategory.id, amount, currentMonth, currentYear);
    await syncOverallBudget();
    events.emit('budgetsChanged', null);
    await load();
    setSelectedCategory(null);
    setCategoryBudgetAmount('');
    setEditingBudgetId(null);
  }

  const filteredCategories = categories.filter(c =>
    c.name.toLowerCase().includes(searchText.toLowerCase()) &&
    !categoryBudgets.some(b => b.categoryId === c.id)
  );

  async function handleDeleteCategoryBudget(id) {
    setDeletingBudgetId(id);
    setConfirmMessage('Delete this category budget?');
    setConfirmVisible(true);
  }

  async function confirmDeleteCategoryBudget() {
    if (deletingBudgetId) {
      await deleteCategoryBudget(deletingBudgetId);
      await syncOverallBudget();
      events.emit('budgetsChanged', null);
      await load();
      setConfirmVisible(false);
      setDeletingBudgetId(null);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Tab Navigation */}
      <View style={{ flexDirection: 'row', backgroundColor: '#f5f5f5' }}>
        <TouchableOpacity
          onPress={() => setTab('overall')}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderBottomWidth: tab === 'overall' ? 3 : 0,
            borderBottomColor: '#36B37E',
            alignItems: 'center'
          }}
        >
          <Text style={{ fontWeight: tab === 'overall' ? '700' : '500', color: tab === 'overall' ? '#36B37E' : '#666' }}>
            Overall Budget
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTab('category')}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderBottomWidth: tab === 'category' ? 3 : 0,
            borderBottomColor: '#36B37E',
            alignItems: 'center'
          }}
        >
          <Text style={{ fontWeight: tab === 'category' ? '700' : '500', color: tab === 'category' ? '#36B37E' : '#666' }}>
            Category Budget
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.m, paddingBottom: 80 }}>
        {tab === 'overall' ? (
          <Card style={{ paddingVertical: 28 }}>
            <View style={{ alignItems: 'center' }}>
              <Avatar.Icon size={56} icon="cash" style={{ backgroundColor: '#E8F7EF', marginBottom: 12 }} />
              <Text style={{ fontSize: 22, fontWeight: '800', marginBottom: 6 }}>Monthly Budget</Text>
              <Text style={{ color: '#666', textAlign: 'center', maxWidth: 360, marginBottom: 16 }}>One simple box — set a monthly spending limit and tap Set Now.</Text>

              <View style={{ width: '92%', maxWidth: 520, alignItems: 'center' }}>
                <View style={{ width: '100%', backgroundColor: '#F6FBF7', borderRadius: 12, paddingVertical: 18, paddingHorizontal: 16, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#E6F4EA' }}>
                  <Text style={{ color: '#2E7D32', fontSize: 14, fontWeight: '700', marginBottom: 6 }}>Preview</Text>
                  <Text style={{ fontSize: 28, fontWeight: '900', color: '#1B5E20' }}>₹ {limit ? Number(limit).toLocaleString('en-IN') : '0'}</Text>
                </View>

                <PaperInput
                  label="Monthly limit"
                  mode="outlined"
                  value={limit}
                  keyboardType="numeric"
                  onChangeText={setLimit}
                  placeholder="e.g. 50,000"
                  style={{ backgroundColor: 'white', width: '100%' }}
                  theme={{ colors: { primary: '#36B37E' } }}
                  outlineColor="#eee"
                />

                <Button mode="contained" onPress={setNow} style={{ marginTop: 18, paddingVertical: 12, borderRadius: 10, width: '100%' }} contentStyle={{ paddingVertical: 6 }}>
                  Set Now
                </Button>

                <Text style={{ color: '#999', fontSize: 12, marginTop: 10, textAlign: 'center' }}>This will create or update your general monthly budget.</Text>
              </View>
            </View>
          </Card>
        ) : (
          <>
            <Card style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12 }}>Add Category Budget</Text>

              {/* Category Dropdown */}
              <TouchableOpacity
                onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                style={{
                  borderWidth: 1,
                  borderColor: '#ddd',
                  borderRadius: 4,
                  padding: 12,
                  marginBottom: 12,
                  backgroundColor: selectedCategory ? '#f9f9f9' : 'white'
                }}
              >
                <Text style={{ color: selectedCategory ? '#333' : '#999' }}>
                  {selectedCategory ? selectedCategory.name : 'Select Category'}
                </Text>
              </TouchableOpacity>

              {showCategoryDropdown && (
                <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 4, marginBottom: 12, maxHeight: 300 }}>
                  <PaperInput
                    placeholder="Search categories..."
                    value={searchText}
                    onChangeText={setSearchText}
                    mode="flat"
                    style={{ backgroundColor: 'white' }}
                  />
                  <FlatList
                    data={filteredCategories}
                    keyExtractor={item => String(item.id)}
                    scrollEnabled={false}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedCategory(item);
                          setShowCategoryDropdown(false);
                          setSearchText('');
                        }}
                        style={{ padding: 12, borderTopWidth: 1, borderTopColor: '#eee', flexDirection: 'row', alignItems: 'center' }}
                      >
                        <Avatar.Icon size={32} icon={item.icon} style={{ backgroundColor: item.color, marginRight: 10 }} />
                        <Text>{item.name}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              )}

              {/* Amount Input */}
              <PaperInput
                label="Budget Amount"
                mode="outlined"
                value={categoryBudgetAmount}
                keyboardType="numeric"
                onChangeText={setCategoryBudgetAmount}
                placeholder="e.g. 5000"
                style={{ backgroundColor: 'white', marginBottom: 12 }}
                theme={{ colors: { primary: '#36B37E' } }}
                outlineColor="#eee"
              />

              <Button
                mode="contained"
                onPress={saveCategoryBudgetNow}
                style={{ paddingVertical: 10, borderRadius: 10 }}
                contentStyle={{ paddingVertical: 4 }}
              >
                {editingBudgetId ? 'Update Budget' : 'Save Budget'}
              </Button>
            </Card>

            {/* Existing Category Budgets */}
            {categoryBudgets.length > 0 ? (
              <Card>
                <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12 }}>Category Budgets for {currentMonth}/{currentYear}</Text>
                {categoryBudgets.map(budget => {
                  let barColor = '#36B37E';

                  if (budget.percentage >= 80 && budget.percentage <= 100) {
                    barColor = '#FFB020';
                  } else if (budget.percentage > 100) {
                    barColor = '#E46A6A';
                  }

                  return (
                    <TouchableOpacity
                      key={budget.id}
                      onPress={() =>
                        navigation.navigate('CategoriesDetails', {
                          categoryId: budget.categoryId,
                          categoryName: budget.categoryName,
                        })
                      }
                      style={{
                        paddingVertical: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: '#eee',
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 6,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            flex: 1,
                          }}
                        >
                          <Avatar.Icon
                            size={36}
                            icon={budget.icon}
                            style={{
                              backgroundColor: budget.color,
                              marginRight: 10,
                            }}
                          />

                          <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '600' }}>
                              {budget.categoryName}
                            </Text>

                            <Text
                              style={{
                                fontSize: 12,
                                color: '#666',
                              }}
                            >
                              ₹{budget.spent.toLocaleString('en-IN')} / ₹{budget.budget.toLocaleString('en-IN')}
                            </Text>
                          </View>
                        </View>

                        <View
                          style={{
                            alignItems: 'flex-end',
                            marginLeft: 8,
                          }}
                        >
                          <Text
                            style={{
                              fontWeight: '700',
                              color: barColor,
                              fontSize: 16,
                            }}
                          >
                            {Math.round(budget.percentage)}%
                          </Text>

                          <Text
                            style={{
                              fontSize: 11,
                              color: budget.exceeded ? '#E46A6A' : '#36B37E',
                            }}
                          >
                            {budget.exceeded
                              ? `+₹${Math.abs(budget.remaining).toLocaleString('en-IN')}`
                              : `₹${budget.remaining.toLocaleString('en-IN')}`}
                          </Text>
                        </View>

                        <View
                          style={{
                            flexDirection: 'row',
                            marginLeft: 8,
                          }}
                        >
                          <IconButton
                            icon="pencil"
                            size={20}
                            onPress={() => {
                              setEditingBudgetId(budget.id);
                              setSelectedCategory(
                                categories.find(c => c.id === budget.categoryId)
                              );
                              setCategoryBudgetAmount(String(budget.budget));
                            }}
                          />

                          <IconButton
                            icon="delete"
                            size={20}
                            onPress={() => handleDeleteCategoryBudget(budget.id)}
                          />
                        </View>
                      </View>

                      <View
                        style={{
                          height: 8,
                          backgroundColor: '#eee',
                          borderRadius: 4,
                          overflow: 'hidden',
                        }}
                      >
                        <View
                          style={{
                            width: `${Math.min(100, budget.percentage)}%`,
                            height: '100%',
                            backgroundColor: barColor,
                          }}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </Card>
            ) : (
              <Card>
                <Text style={{ color: '#999', textAlign: 'center', paddingVertical: 20 }}>No category budgets yet. Add one above!</Text>
              </Card>
            )}
          </>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={confirmVisible}
        title="Delete Budget"
        message={confirmMessage}
        onCancel={() => {
          setConfirmVisible(false);
          setDeletingBudgetId(null);
        }}
        onConfirm={confirmDeleteCategoryBudget}
      />
    </View>
  );
}
