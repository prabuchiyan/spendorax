import React, { useLayoutEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { Appbar } from "react-native-paper";
import {
  useCategoryBudgets,
  useOtherCategorySpending,
  useOthersExpanded,
  useAppDispatch,
} from "../redux/hooks";
import { setOthersExpanded } from "../redux/slices/budgetSlice";
import { useBalanceVisibility } from "../context/BalanceVisibilityContext";

function getBudgetProgressColor(percentage) {
  if (percentage < 70) return "#3F8F6B";
  if (percentage < 90) return "#EAB308";
  return "#D92D20";
}

export default function CategoryBudgetsDashboard({ navigation }) {
  const categoryBudgets = useCategoryBudgets();
  const otherCategorySpending = useOtherCategorySpending();
  const othersExpanded = useOthersExpanded();
  const dispatch = useAppDispatch();
  const { balanceVisible } = useBalanceVisibility();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate("Budgets")}
          style={{ marginRight: 8 }}
        >
          <MaterialCommunityIcons name="cog-outline" size={24} color="#2F7355" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: "#F5FAF7" }}>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 80,
        }}
      >
        <View
          style={{
            backgroundColor: "#EEF8F2",
            borderRadius: 16,
            padding: 16,
            marginBottom: 20,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: "#3F8F6B",
              justifyContent: "center",
              alignItems: "center",
              marginRight: 16,
            }}
          >
            <MaterialCommunityIcons name="chart-donut" size={26} color="#FFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: "#718078", marginTop: 4, lineHeight: 18 }}>
              Monitor your spending across different categories. Tap on any category to view detailed transactions.
            </Text>
          </View>
        </View>

        {[...categoryBudgets]
          .sort((a, b) => b.percentage - a.percentage)
          .map((budget) => {
            const categoryColor = budget.color || "#4B7CF3";
            const spent = Number(budget.spent || 0);
            const budgetAmount = Number(budget.budget || 0);
            const remaining = Number(budget.remaining || 0);
            const percentage = Math.round(Number(budget.percentage || 0));
            const budgetStatusColor = getBudgetProgressColor(percentage);
            const isOverBudget = percentage > 100;

            return (
              <TouchableOpacity
                key={budget.id}
                activeOpacity={0.88}
                onPress={() =>
                  navigation.navigate("CategoriesDetails", {
                    categoryId: budget.categoryId,
                    categoryName: budget.categoryName,
                  })
                }
                style={{
                  marginBottom: 10,
                  paddingVertical: 12,
                  paddingHorizontal: 10,
                  borderRadius: 16,
                  backgroundColor: isOverBudget ? "#FFF5F5" : "#F8FCFA",
                  borderWidth: 1,
                  borderColor: isOverBudget ? "#FECACA" : "#E5F1EB",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    width: "100%",
                  }}
                >
                  <View
                    style={{
                      width: "15%",
                      alignItems: "flex-start",
                      justifyContent: "center",
                    }}
                  >
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 14,
                        backgroundColor: categoryColor,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MaterialCommunityIcons
                        name={budget.icon || "tag-outline"}
                        size={21}
                        color="#FFFFFF"
                      />
                    </View>
                  </View>

                  <View
                    style={{
                      width: "60%",
                      paddingHorizontal: 5,
                      minWidth: 0,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={{
                        fontSize: 14,
                        fontWeight: "800",
                        color: isOverBudget ? "#B42318" : "#2F7355",
                        marginBottom: 3,
                      }}
                    >
                      {budget.categoryName}
                    </Text>

                    <Text
                      numberOfLines={1}
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color: "#718078",
                        marginBottom: 7,
                      }}
                    >
                      {balanceVisible
                        ? `₹${spent.toLocaleString(
                          "en-IN"
                        )} of ₹${budgetAmount.toLocaleString("en-IN")}`
                        : "•••••• of ••••••"}
                    </Text>

                    <View
                      style={{
                        width: "100%",
                        height: 7,
                        backgroundColor: "#DCEDE4",
                        borderRadius: 10,
                        overflow: "hidden",
                      }}
                    >
                      <View
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, percentage)
                          )}%`,
                          height: "100%",
                          backgroundColor: budgetStatusColor,
                          borderRadius: 10,
                        }}
                      />
                    </View>
                  </View>

                  <View
                    style={{
                      width: "25%",
                      alignItems: "flex-end",
                      justifyContent: "center",
                      paddingLeft: 5,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: "900",
                        color: budgetStatusColor,
                        letterSpacing: -0.4,
                      }}
                    >
                      {percentage}%
                    </Text>

                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        color: isOverBudget ? "#D92D20" : "#718078",
                        marginTop: 3,
                        textAlign: "right",
                      }}
                    >
                      {balanceVisible
                        ? remaining >= 0
                          ? `₹${remaining.toLocaleString("en-IN")} left`
                          : `₹${Math.abs(remaining).toLocaleString(
                            "en-IN"
                          )} over`
                        : "••••••"}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

        {otherCategorySpending.length > 0 &&
          (() => {
            const othersTotal = otherCategorySpending.reduce(
              (sum, item) => sum + Number(item.amount || 0),
              0
            );

            const totalCategorySpend =
              categoryBudgets.reduce(
                (sum, item) => sum + Number(item.spent || 0),
                0
              ) + othersTotal;

            const othersPercentage =
              totalCategorySpend > 0
                ? Math.round((othersTotal / totalCategorySpend) * 100)
                : 0;

            return (
              <View style={{ marginTop: 10 }}>
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => dispatch(setOthersExpanded(!othersExpanded))}
                  style={{
                    marginBottom: othersExpanded ? 6 : 0,
                    paddingVertical: 12,
                    paddingHorizontal: 10,
                    borderRadius: 16,
                    backgroundColor: "#F8FCFA",
                    borderWidth: 1,
                    borderColor: "#E5F1EB",
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      width: "100%",
                    }}
                  >
                    <View
                      style={{
                        width: "15%",
                        alignItems: "flex-start",
                        justifyContent: "center",
                      }}
                    >
                      <View
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 14,
                          backgroundColor: "#718078",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <MaterialCommunityIcons
                          name={
                            othersExpanded ? "chevron-up" : "dots-horizontal"
                          }
                          size={23}
                          color="#FFFFFF"
                        />
                      </View>
                    </View>

                    <View
                      style={{
                        width: "60%",
                        paddingHorizontal: 5,
                        minWidth: 0,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginBottom: 3,
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          style={{
                            fontSize: 14,
                            fontWeight: "800",
                            color: "#2F7355",
                            flexShrink: 1,
                          }}
                        >
                          Others
                        </Text>

                        <View
                          style={{
                            marginLeft: 7,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 6,
                            backgroundColor: "#EAF1ED",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 8,
                              fontWeight: "800",
                              color: "#718078",
                            }}
                          >
                            {otherCategorySpending.length}{" "}
                            {otherCategorySpending.length === 1
                              ? "category"
                              : "categories"}
                          </Text>
                        </View>
                      </View>

                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 11,
                          fontWeight: "600",
                          color: "#718078",
                          marginBottom: 7,
                        }}
                      >
                        {balanceVisible
                          ? `₹${othersTotal.toLocaleString("en-IN")} spent`
                          : "•••••• spent"}
                      </Text>

                      <View
                        style={{
                          width: "100%",
                          height: 7,
                          backgroundColor: "#DCEDE4",
                          borderRadius: 10,
                          overflow: "hidden",
                        }}
                      >
                        <View
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, othersPercentage)
                            )}%`,
                            height: "100%",
                            backgroundColor: "#718078",
                            borderRadius: 10,
                          }}
                        />
                      </View>
                    </View>

                    <View
                      style={{
                        width: "25%",
                        alignItems: "flex-end",
                        justifyContent: "center",
                        paddingLeft: 5,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight: "900",
                          color: "#718078",
                          letterSpacing: -0.4,
                        }}
                      >
                        {othersPercentage}%
                      </Text>

                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "700",
                          color: "#718078",
                          marginTop: 3,
                          textAlign: "right",
                        }}
                      >
                        of total spend
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {othersExpanded && (
                  <View
                    style={{
                      marginBottom: 10,
                      marginLeft: 14,
                      paddingLeft: 12,
                      borderLeftWidth: 2,
                      borderLeftColor: "#DCEDE4",
                    }}
                  >
                    {otherCategorySpending.map((item, index) => {
                      const amount = Number(item.amount || 0);
                      const itemPercentage =
                        othersTotal > 0
                          ? Math.round((amount / othersTotal) * 100)
                          : 0;
                      const itemColor = item.color || "#4B7CF3";

                      return (
                        <TouchableOpacity
                          key={item.categoryId || `other-${index}`}
                          activeOpacity={0.88}
                          onPress={() =>
                            navigation.navigate("CategoriesDetails", {
                              categoryId: item.categoryId,
                              categoryName: item.categoryName,
                            })
                          }
                          style={{
                            marginBottom:
                              index === otherCategorySpending.length - 1
                                ? 0
                                : 7,
                            paddingVertical: 10,
                            paddingHorizontal: 10,
                            borderRadius: 14,
                            backgroundColor: "#FBFDFC",
                            borderWidth: 1,
                            borderColor: "#E8F1EC",
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              width: "100%",
                            }}
                          >
                            <View
                              style={{
                                width: "15%",
                                alignItems: "flex-start",
                                justifyContent: "center",
                              }}
                            >
                              <View
                                style={{
                                  width: 38,
                                  height: 38,
                                  borderRadius: 12,
                                  backgroundColor: itemColor,
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <MaterialCommunityIcons
                                  name={item.icon || "tag-outline"}
                                  size={19}
                                  color="#FFFFFF"
                                />
                              </View>
                            </View>

                            <View
                              style={{
                                width: "60%",
                                paddingHorizontal: 5,
                                minWidth: 0,
                              }}
                            >
                              <Text
                                numberOfLines={1}
                                ellipsizeMode="tail"
                                style={{
                                  fontSize: 13,
                                  fontWeight: "800",
                                  color: "#2F7355",
                                  marginBottom: 3,
                                }}
                              >
                                {item.categoryName}
                              </Text>

                              <Text
                                numberOfLines={1}
                                style={{
                                  fontSize: 10,
                                  fontWeight: "600",
                                  color: "#718078",
                                  marginBottom: 6,
                                }}
                              >
                                {balanceVisible
                                  ? `₹${amount.toLocaleString(
                                    "en-IN"
                                  )} spent`
                                  : "•••••• spent"}
                              </Text>

                              <View
                                style={{
                                  width: "100%",
                                  height: 6,
                                  backgroundColor: "#DCEDE4",
                                  borderRadius: 10,
                                  overflow: "hidden",
                                }}
                              >
                                <View
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      Math.max(0, itemPercentage)
                                    )}%`,
                                    height: "100%",
                                    backgroundColor: itemColor,
                                    borderRadius: 10,
                                  }}
                                />
                              </View>
                            </View>

                            <View
                              style={{
                                width: "25%",
                                alignItems: "flex-end",
                                justifyContent: "center",
                                paddingLeft: 5,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 16,
                                  fontWeight: "900",
                                  color: itemColor,
                                  letterSpacing: -0.3,
                                }}
                              >
                                {itemPercentage}%
                              </Text>

                              <Text
                                style={{
                                  fontSize: 9,
                                  fontWeight: "600",
                                  color: "#718078",
                                  marginTop: 2,
                                  textAlign: "right",
                                }}
                              >
                                of Others
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })()}
      </ScrollView>
    </View>
  );
}
