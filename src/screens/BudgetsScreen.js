import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { TextInput as PaperInput, Button, Avatar, IconButton } from 'react-native-paper';
import { createBudget, getBudgetsForMonth, updateBudget } from '../services/budgets';
import { saveCategoryBudget, deleteCategoryBudget, getCategoryBudgetSummary, copyCategoryBudgets } from '../services/categoryBudgets';
import { getCategories } from '../services/categories';
import events from '../services/events';
import Card from '../components/Card';
import { Spacing } from '../components/Theme';
import ConfirmDialog from '../components/ConfirmDialog';
import BudgetCreateModal from '../components/BudgetCreateModal';
import FAB from '../components/FAB';

function getMonthLabel(date) {
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

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
  const [showModal, setShowModal] = useState(false);
  const [editBudget, setEditBudget] = useState(null);
  const [selectedMonthDate, setSelectedMonthDate] = useState(new Date());

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const currentMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const selectedMonth = selectedMonthDate.getMonth() + 1;
  const selectedYear = selectedMonthDate.getFullYear();
  const isCurrentMonthSelected =
    selectedMonth === currentMonth &&
    selectedYear === currentYear;
  const hasCurrentMonthCategoryBudgets =
    isCurrentMonthSelected &&
    categoryBudgets.length > 0;

  /*
   * Copy is available ONLY when:
   *
   * 1. Current month is selected
   * 2. Current month has NO category budgets
   */
  const shouldShowCopyOption =
    isCurrentMonthSelected &&
    categoryBudgets.length === 0;
  const monthCarousel = useMemo(() => {
    const current = new Date(
      currentYear,
      currentMonth - 1,
      1
    );
    const previous = new Date(
      currentYear,
      currentMonth - 2,
      1
    );
    return [previous, current];
  }, [currentYear, currentMonth]);

  async function loadCategoryBudgetsForMonth(month = selectedMonth, year = selectedYear) {
    const budgets = await getCategoryBudgetSummary(month, year);
    setCategoryBudgets(budgets);
  }

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

    await loadCategoryBudgetsForMonth(selectedMonth, selectedYear);
  }

  useEffect(() => {
    load();
    const unsub = navigation.addListener('focus', () => { load(); });
    return unsub;
  }, [navigation]);

  useEffect(() => {
    loadCategoryBudgetsForMonth(selectedMonth, selectedYear);
  }, [selectedMonthDate]);

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

  async function handleSaveBudget() {
    if (!selectedCategory) {
      alert('Please select a category');
      return false;
    }
    const amount = parseFloat(categoryBudgetAmount) || 0;
    if (amount <= 0) {
      alert('Please enter valid amount');
      return false;
    }
    await saveCategoryBudget(
      selectedCategory.id,
      amount,
      selectedMonth,
      selectedYear
    );
    await syncOverallBudget();
    events.emit('budgetsChanged');
    await loadCategoryBudgetsForMonth(selectedMonth, selectedYear);
    setSelectedCategory(null);
    setCategoryBudgetAmount('');
    return true;
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
      await loadCategoryBudgetsForMonth(selectedMonth, selectedYear);
      setConfirmVisible(false);
      setDeletingBudgetId(null);
    }
  }

  async function handleCopyPreviousMonth() {
    /*
     * Safety check:
     * Copying is ONLY allowed into the current month.
     */
    if (!isCurrentMonthSelected) {
      alert(
        'Copying category budgets is only available for the current month.'
      );
      return;
    }
    /*
     * Extra safety:
     * Never show/use copy if current month already
     * has category budgets.
     */
    if (categoryBudgets.length > 0) {
      alert(
        'Category budgets are already set for this month.'
      );
      return;
    }
    const previousDate = new Date(
      currentYear,
      currentMonth - 2,
      1
    );
    const fromMonth =
      previousDate.getMonth() + 1;
    const fromYear =
      previousDate.getFullYear();
    try {
      const copied =
        await copyCategoryBudgets({
          fromMonth,
          fromYear,
          toMonth: currentMonth,
          toYear: currentYear,
          overwrite: false,
        });
      if (copied.length === 0) {
        alert(
          `No category budgets were found in ${getMonthLabel(previousDate)} to copy.`
        );
        return;
      }
      await syncOverallBudget();
      events.emit('budgetsChanged');
      await loadCategoryBudgetsForMonth(
        currentMonth,
        currentYear
      );
      alert(
        `Copied ${copied.length} category ${copied.length === 1
          ? 'budget'
          : 'budgets'
        } from ${getMonthLabel(previousDate)} to ${getMonthLabel(currentMonthDate)}.`
      );
    } catch (error) {
      console.error(
        'Copy category budgets failed:',
        error
      );

      alert(
        error?.message ||
        'Unable to copy category budgets.'
      );
    }
  }

  function moveMonthBy(offset) {
    const next = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + offset, 1);
    const limit = new Date(currentYear, currentMonth - 1, 1);
    if (next > limit) {
      return;
    }
    setSelectedMonthDate(next);
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

      <ScrollView contentContainerStyle={{ padding: Spacing.xs, paddingBottom: 80 }}>
        {tab === 'overall' ? (
          <Card>
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
            <Card style={{ marginBottom: 12 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <TouchableOpacity
                  onPress={() => moveMonthBy(-1)}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: '#F3F9F6',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: '700',
                      color: '#36B37E',
                    }}
                  >
                    ‹
                  </Text>
                </TouchableOpacity>

                <View
                  style={{
                    alignItems: 'center',
                    flex: 1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: '800',
                      color: '#1F2937',
                    }}
                  >
                    {getMonthLabel(selectedMonthDate)}
                  </Text>

                  {isCurrentMonthSelected && (
                    <View
                      style={{
                        marginTop: 4,
                        paddingHorizontal: 9,
                        paddingVertical: 3,
                        borderRadius: 10,
                        backgroundColor: '#E8F7EF',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '800',
                          color: '#1B5E20',
                        }}
                      >
                        CURRENT MONTH
                      </Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => moveMonthBy(1)}
                  disabled={
                    selectedMonthDate.getTime() >=
                    currentMonthDate.getTime()
                  }
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor:
                      selectedMonthDate.getTime() >=
                        currentMonthDate.getTime()
                        ? '#F3F4F6'
                        : '#F3F9F6',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: '700',
                      color:
                        selectedMonthDate.getTime() >=
                          currentMonthDate.getTime()
                          ? '#B8BEC6'
                          : '#36B37E',
                    }}
                  >
                    ›
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 6 }}>
                {monthCarousel.map((monthDate) => {
                  const isActive = monthDate.getMonth() === selectedMonthDate.getMonth() && monthDate.getFullYear() === selectedMonthDate.getFullYear();
                  return (
                    <TouchableOpacity
                      key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}
                      onPress={() => setSelectedMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1))}
                      style={{
                        width: 140,
                        marginRight: 12,
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: isActive ? '#36B37E' : '#E5E7EB',
                        backgroundColor: isActive ? '#E8F7EF' : '#F9FAFB',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 12, color: isActive ? '#1B5E20' : '#6B7280', fontWeight: '700' }}>
                        {monthDate.toLocaleDateString('en-IN', { month: 'short' })}
                      </Text>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: isActive ? '#1B5E20' : '#111827', marginTop: 4 }}>
                        {monthDate.getFullYear()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {isCurrentMonthSelected ? (
                shouldShowCopyOption ? (
                  <View
                    style={{
                      marginTop: 14,
                      borderRadius: 16,
                      backgroundColor: '#F3F9FF',
                      borderWidth: 1,
                      borderColor: '#D9EAFF',
                      padding: 16,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <View
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 21,
                          backgroundColor: '#E3F0FF',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 12,
                        }}
                      >
                        <Text style={{ fontSize: 20 }}>
                          📋
                        </Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: '800',
                            color: '#1F2937',
                          }}
                        >
                          Start with last month's budgets
                        </Text>

                        <Text
                          style={{
                            marginTop: 4,
                            color: '#667085',
                            fontSize: 12,
                            lineHeight: 18,
                          }}
                        >
                          Your current month has no category
                          budgets yet. Copy last month's limits
                          to get started quickly.
                        </Text>
                      </View>
                    </View>

                    <Button
                      mode="contained"
                      icon="content-copy"
                      onPress={handleCopyPreviousMonth}
                      style={{
                        marginTop: 14,
                        borderRadius: 10,
                      }}
                      contentStyle={{
                        paddingVertical: 4,
                      }}
                    >
                      Copy Previous Month
                    </Button>
                  </View>
                ) : (
                  <View
                    style={{
                      marginTop: 14,
                      borderRadius: 16,
                      backgroundColor: '#F5FBF7',
                      borderWidth: 1,
                      borderColor: '#D7F1DD',
                      padding: 15,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 20,
                          marginRight: 10,
                        }}
                      >
                        ✓
                      </Text>

                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            color: '#166534',
                            fontWeight: '800',
                            fontSize: 14,
                          }}
                        >
                          Category budgets are set
                        </Text>

                        <Text
                          style={{
                            marginTop: 3,
                            color: '#4B5563',
                            fontSize: 12,
                          }}
                        >
                          You already have category budgets
                          for this month.
                        </Text>
                      </View>
                    </View>
                  </View>
                )
              ) : (
                <View
                  style={{
                    marginTop: 14,
                    borderRadius: 16,
                    backgroundColor: '#F9FAFB',
                    borderWidth: 1,
                    borderColor: '#E5E7EB',
                    padding: 15,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 20,
                        marginRight: 10,
                      }}
                    >
                      📅
                    </Text>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: '#374151',
                          fontWeight: '800',
                          fontSize: 14,
                        }}
                      >
                        Viewing {getMonthLabel(selectedMonthDate)}
                      </Text>

                      <Text
                        style={{
                          marginTop: 3,
                          color: '#6B7280',
                          fontSize: 12,
                        }}
                      >
                        Copying budgets is available only for
                        the current month.
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </Card>

            {/* CATEGORY BUDGETS */}
            {categoryBudgets.length > 0 ? (
              <View style={{ marginTop: 4 }}>
                {/* Section Header */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 12,
                    paddingHorizontal: 2,
                  }}
                >
                  <View>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: '800',
                        color: '#172033',
                      }}
                    >
                      Category Budgets
                    </Text>

                    <Text
                      style={{
                        fontSize: 12,
                        color: '#7B8794',
                        marginTop: 3,
                      }}
                    >
                      Track your spending limits
                    </Text>
                  </View>

                  <View
                    style={{
                      minWidth: 38,
                      height: 30,
                      paddingHorizontal: 10,
                      borderRadius: 15,
                      backgroundColor: '#F0F8F4',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '800',
                        color: '#238B5A',
                      }}
                    >
                      {categoryBudgets.length}
                    </Text>
                  </View>
                </View>

                {categoryBudgets.map((budget) => {
                  const percentage = Number(budget.percentage || 0);

                  const isExceeded = budget.exceeded;
                  const isWarning = !isExceeded && percentage >= 80;

                  let barColor = '#36B37E';
                  let statusColor = '#36B37E';

                  if (isExceeded) {
                    barColor = '#E46A6A';
                    statusColor = '#D64545';
                  } else if (isWarning) {
                    barColor = '#FFB020';
                    statusColor = '#C58A00';
                  }

                  const progressWidth = Math.min(
                    100,
                    Math.max(0, percentage)
                  );

                  return (
                    <TouchableOpacity
                      key={budget.id}
                      activeOpacity={0.88}
                      onPress={() =>
                        navigation.navigate('CategoriesDetails', {
                          categoryId: budget.categoryId,
                          categoryName: budget.categoryName,
                        })
                      }
                      style={{
                        marginBottom: 10,
                        backgroundColor: '#FFFFFF',
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: '#E8ECF0',
                        overflow: 'hidden',
                        elevation: 1,
                        shadowColor: '#000',
                        shadowOffset: {
                          width: 0,
                          height: 1,
                        },
                        shadowOpacity: 0.04,
                        shadowRadius: 3,
                      }}
                    >
                      {/* Category accent */}
                      <View
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 4,
                          backgroundColor:
                            budget.color || '#36B37E',
                        }}
                      />

                      <View
                        style={{
                          paddingVertical: 11,
                          paddingHorizontal: 12,
                          paddingLeft: 14,
                        }}
                      >
                        {/* Main row */}
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                          }}
                        >
                          {/* Icon */}
                          <View
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: 13,
                              backgroundColor:
                                budget.color
                                  ? `${budget.color}18`
                                  : '#E8F7EF',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: 10,
                            }}
                          >
                            <Avatar.Icon
                              size={38}
                              icon={budget.icon}
                              color={budget.color || '#36B37E'}
                              style={{
                                backgroundColor: 'transparent',
                              }}
                            />
                          </View>

                          {/* Category + amount */}
                          <View
                            style={{
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            <Text
                              numberOfLines={1}
                              style={{
                                fontSize: 15,
                                fontWeight: '800',
                                color: '#172033',
                              }}
                            >
                              {budget.categoryName}
                            </Text>

                            <Text
                              numberOfLines={1}
                              style={{
                                marginTop: 3,
                                fontSize: 11,
                                color: '#7B8794',
                              }}
                            >
                              ₹{Number(budget.spent || 0).toLocaleString('en-IN')}
                              {' / '}
                              ₹{Number(budget.budget || 0).toLocaleString('en-IN')}
                            </Text>
                          </View>

                          {/* Percentage */}
                          <View
                            style={{
                              alignItems: 'flex-end',
                              marginLeft: 6,
                              marginRight: 4,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 17,
                                fontWeight: '900',
                                color: statusColor,
                              }}
                            >
                              {Math.round(percentage)}%
                            </Text>

                            <Text
                              style={{
                                marginTop: 1,
                                fontSize: 9,
                                fontWeight: '700',
                                color: statusColor,
                              }}
                            >
                              {isExceeded
                                ? 'OVER'
                                : isWarning
                                  ? 'NEAR LIMIT'
                                  : 'ON TRACK'}
                            </Text>
                          </View>

                          {/* EDIT */}
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={(event) => {
                              event?.stopPropagation?.();

                              setEditBudget(budget);

                              setSelectedCategory({
                                id: budget.categoryId,
                                name: budget.categoryName,
                                icon: budget.icon,
                                color: budget.color,
                              });

                              setCategoryBudgetAmount(
                                String(budget.budget)
                              );

                              setSearchText('');
                              setShowCategoryDropdown(false);
                              setShowModal(true);
                            }}
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 10,
                              backgroundColor: '#F1F5F3',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginLeft: 5,
                            }}
                          >
                            <IconButton
                              icon="pencil"
                              size={17}
                              iconColor="#287A57"
                              style={{
                                margin: 0,
                              }}
                            />
                          </TouchableOpacity>

                          {/* DELETE */}
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={(event) => {
                              event?.stopPropagation?.();

                              handleDeleteCategoryBudget(
                                budget.id
                              );
                            }}
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 10,
                              backgroundColor: '#FFF2F2',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginLeft: 5,
                            }}
                          >
                            <IconButton
                              icon="trash-can-outline"
                              size={17}
                              iconColor="#D64545"
                              style={{
                                margin: 0,
                              }}
                            />
                          </TouchableOpacity>
                        </View>

                        {/* Compact progress */}
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginTop: 9,
                          }}
                        >
                          <View
                            style={{
                              flex: 1,
                              height: 6,
                              borderRadius: 3,
                              backgroundColor: '#EEF1F3',
                              overflow: 'hidden',
                            }}
                          >
                            <View
                              style={{
                                width: `${progressWidth}%`,
                                height: '100%',
                                backgroundColor: barColor,
                                borderRadius: 3,
                              }}
                            />
                          </View>

                          <Text
                            style={{
                              marginLeft: 8,
                              fontSize: 10,
                              fontWeight: '700',
                              color: isExceeded
                                ? '#D64545'
                                : '#7B8794',
                            }}
                          >
                            {isExceeded
                              ? `₹${Math.abs(
                                Number(budget.remaining || 0)
                              ).toLocaleString('en-IN')} over`
                              : `₹${Number(
                                budget.remaining || 0
                              ).toLocaleString('en-IN')} left`}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Card
                style={{
                  marginTop: 4,
                  borderRadius: 20,
                }}
              >
                <View
                  style={{
                    alignItems: 'center',
                    paddingVertical: 26,
                    paddingHorizontal: 18,
                  }}
                >
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 22,
                      backgroundColor: '#F0F8F4',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 14,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 30,
                      }}
                    >
                      🎯
                    </Text>
                  </View>

                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: '800',
                      color: '#172033',
                      textAlign: 'center',
                    }}
                  >
                    No category budgets yet
                  </Text>

                  <Text
                    style={{
                      marginTop: 7,
                      fontSize: 13,
                      lineHeight: 20,
                      color: '#7B8794',
                      textAlign: 'center',
                      maxWidth: 320,
                    }}
                  >
                    Create spending limits for individual
                    categories to understand exactly where
                    your money is going.
                  </Text>
                </View>
              </Card>
            )}
          </>
        )}
      </ScrollView>

      <BudgetCreateModal
        visible={showModal}
        editData={editBudget}
        onClose={() => {
          setShowModal(false);
          setEditBudget(null);
        }}
        onSave={() => {
          setShowModal(false);
          setEditBudget(null);
          load();
        }}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        categoryBudgetAmount={categoryBudgetAmount}
        setCategoryBudgetAmount={setCategoryBudgetAmount}
        showCategoryDropdown={showCategoryDropdown}
        setShowCategoryDropdown={setShowCategoryDropdown}
        searchText={searchText}
        setSearchText={setSearchText}
        filteredCategories={filteredCategories}
        handleSaveBudget={handleSaveBudget}
      />

      {tab === 'category' && (
        <FAB
          onPress={() => {
            setEditBudget(null);
            setSelectedCategory(null);
            setCategoryBudgetAmount('');
            setSearchText('');
            setShowCategoryDropdown(false);
            setShowModal(true);
          }}
        />
      )}

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
