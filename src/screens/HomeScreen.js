import React, { useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  useWindowDimensions,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getHomeExpenseTransactions } from "../services/transactions";
import { getHomeBudgets as getHomeBudgetsService } from "../services/budgets";
import {
  getHomeCategoryBudgets as getHomeCategoryBudgetsService,
} from "../services/categoryBudgets";
import { getBillsForCurrentMonth } from "../services/bills";
import { getBillDisplayStatus, formatCurrency } from "../services/billUtils";
import { getSources } from "../services/sources";
import { getCategories } from "../services/categories";
import events from "../services/events";
import { Button as PaperButton } from "react-native-paper";
import Card from "../components/Card";
import FAB from "../components/FAB";
import { Spacing } from "../components/Theme";
import BottomStatsBar from "../components/BottomStatsBar";
import { useBalanceVisibility } from "../context/BalanceVisibilityContext";
import { usePageLoader } from "../context/PageLoaderContext";
import {
  setTopCategories,
  setSources,
  setSourceBalances,
  setRecentTransactions,
  setSelectedBudgetId,
} from "../redux/slices/homeSlice";
import {
  setBudgets,
  setCategoryBudgets,
  setOtherCategorySpending,
  setOthersExpanded,
} from "../redux/slices/budgetSlice";
import {
  setBills,
  setBillsSummary,
} from "../redux/slices/billSlice";
import {
  setCategoriesMap,
} from "../redux/slices/categorySlice";
import {
  useTopCategories,
  useSources,
  useSourceBalances,
  useRecentTransactions,
  useSelectedBudgetId,
  useBudgets,
  useCategoryBudgets,
  useOtherCategorySpending,
  useOthersExpanded,
  useBills,
  useBillsSummary,
  useCategoriesMap,
  useAppDispatch,
} from "../redux/hooks";

/* ============================================================
   DATE HELPERS
============================================================ */

function getCurrentMonthBounds() {
  const now = new Date();

  const year = now.getFullYear();
  const month = now.getMonth();

  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 1, 0, 0, 0, 0);

  return {
    now,
    year,
    month,
    monthNumber: month + 1,
    start,
    end,
  };
}

function getCurrentMonthYear() {
  return new Date().toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function daysRemainingInMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const last = new Date(year, month + 1, 0).getDate();
  return last - now.getDate();
}

/* ============================================================
   OPTIMIZED SOURCE BALANCES
============================================================ */

async function getHomeSourceBalances(sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return [];
  }

  try {
    const transactionsModule =
      await import("../services/transactions");

    const balanceMap =
      await transactionsModule.getSourceTransactionBalances();

    const calculatedSources =
      sources.map((source) => {
        const sourceId = String(source.id);

        const initial =
          Number(source.initial_balance || 0);

        const transactionBalance =
          Number(balanceMap[sourceId] || 0);

        return {
          ...source,
          balance:
            initial + transactionBalance,
        };
      });

    // Skip credit cards from Home source balances
    return calculatedSources.filter(
      (source) =>
        String(source?.type || "").toLowerCase() !==
        "credit_card",
    );
  } catch (error) {
    console.error(
      "getHomeSourceBalances error:",
      error,
    );

    return sources
      .filter(
        (source) =>
          String(source?.type || "").toLowerCase() !==
          "credit_card",
      )
      .map((source) => ({
        ...source,
        balance:
          Number(source.initial_balance || 0),
      }));
  }
}

/* ============================================================
   OPTIMIZED CATEGORY SPENDING
============================================================ */

/* ============================================================
   OPTIMIZED CATEGORY SPENDING
============================================================ */

async function getHomeCategorySpending(categoriesMap) {
  try {
    const transactions =
      await getHomeExpenseTransactions(new Date());

    const spendingMap = {};

    transactions.forEach((tx) => {
      if (
        tx.category_id === null ||
        tx.category_id === undefined
      ) {
        return;
      }

      const categoryId = String(
        tx.category_id,
      );

      const amount = Number(
        tx.amount || 0,
      );

      if (amount <= 0) {
        return;
      }

      spendingMap[categoryId] =
        Number(
          spendingMap[categoryId] || 0,
        ) + amount;
    });

    /*
     * Keep the exact data structure expected
     * by the existing Spend Areas UI.
     */
    return Object.entries(spendingMap)
      .map(
        ([categoryId, amount]) => {
          const category =
            categoriesMap?.[categoryId] ||
            categoriesMap?.[Number(categoryId)] ||
            {};

          return {
            category_id:
              categoryId,

            category_name:
              category.name ||
              "Uncategorized",

            amount:
              Number(amount || 0),
          };
        },
      )
      .sort(
        (a, b) =>
          Number(b.amount || 0) -
          Number(a.amount || 0),
      );
  } catch (error) {
    console.error(
      "getHomeCategorySpending error:",
      error,
    );

    return [];
  }
}

/* ============================================================
   OPTIMIZED GENERAL BUDGETS
============================================================ */

async function getHomeBudgets() {
  try {
    return await getHomeBudgetsService();
  } catch (error) {
    console.error(
      "getHomeBudgets error:",
      error,
    );

    return [];
  }
}

/* ============================================================
   OPTIMIZED CATEGORY BUDGETS
============================================================ */

async function getHomeCategoryBudgets(categoriesMap) {
  try {
    const { year, monthNumber } =
      getCurrentMonthBounds();

    return await getHomeCategoryBudgetsService(
      monthNumber,
      year,
      categoriesMap,
    );
  } catch (error) {
    console.error(
      "getHomeCategoryBudgets error:",
      error,
    );

    return [];
  }
}

/* ============================================================
   OPTIMIZED OTHERS
============================================================ */

async function getHomeOtherCategorySpending(
  categoriesMap,
  categoryBudgets,
) {
  try {
    const transactions =
      await getHomeExpenseTransactions(new Date());

    const budgetedCategoryIds = new Set(
      (categoryBudgets || []).map((budget) =>
        String(
          budget.categoryId ??
          budget.category_id,
        ),
      ),
    );

    const spendingMap = {};

    transactions.forEach((tx) => {
      if (
        tx.category_id === null ||
        tx.category_id === undefined
      ) {
        return;
      }

      const categoryId =
        String(tx.category_id);

      if (budgetedCategoryIds.has(categoryId)) {
        return;
      }

      const amount = Number(tx.amount || 0);

      if (amount <= 0) {
        return;
      }

      spendingMap[categoryId] =
        Number(spendingMap[categoryId] || 0) +
        amount;
    });

    return Object.entries(spendingMap).map(
      ([categoryId, amount]) => {
        const category =
          categoriesMap?.[categoryId] ||
          categoriesMap?.[Number(categoryId)] ||
          {};

        return {
          categoryId,
          categoryName:
            category.name || "Uncategorized",
          icon: category.icon || "tag",
          color: category.color || "#ccc",
          amount,
        };
      },
    );
  } catch (error) {
    console.error(
      "getHomeOtherCategorySpending error:",
      error,
    );

    return [];
  }
}

/* ============================================================
   COLORS
============================================================ */

function getBudgetProgressColor(percentage) {
  const value = Number(percentage || 0);

  if (value > 100) {
    return "#D92D20";
  }

  if (value >= 70) {
    return "#F59E0B";
  }

  return "#3F8F6B";
}

/* ============================================================
   BUDGET DONUT
============================================================ */

const AnimatedCircle =
  Animated.createAnimatedComponent(Circle);

function BudgetDonut({
  limit = 0,
  spent = 0,
  remaining = 0,
  daysLeft = 0,
  balanceVisible = true,
  size = 220,
}) {
  const percentRaw =
    limit > 0 ? spent / limit : 0;

  const percent = Math.max(
    0,
    percentRaw,
  );

  const pct =
    limit > 0
      ? Math.min(
        100,
        Math.round(percent * 100),
      )
      : 0;

  const progressPercentage =
    limit > 0
      ? (spent / limit) * 100
      : 0;

  const color =
    getBudgetProgressColor(
      progressPercentage,
    );

  const innerColor =
    remaining < 0
      ? "#D92D20"
      : color;

  const strokeWidth = Math.max(
    16,
    Math.round(size * 0.09),
  );

  const radius =
    (size - strokeWidth) / 2;

  const circumference =
    2 * Math.PI * radius;

  const safePercent =
    Number.isNaN(percent)
      ? 0
      : percent;

  const anim = React.useRef(
    new Animated.Value(
      Math.min(1, safePercent),
    ),
  ).current;

  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.min(
        1,
        percent,
      ),
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [percent]);

  const dashAnim =
    anim.interpolate({
      inputRange: [0, 1],
      outputRange: [
        circumference,
        0,
      ],
    });

  function fmt(value) {
    return `₹${Number(
      value || 0,
    ).toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    })}`;
  }

  const webDashOffset =
    circumference -
    circumference *
    Math.min(
      1,
      safePercent,
    );

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg
        width={size}
        height={size}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E8F0EB"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {Platform.OS === "web" ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={
              webDashOffset
            }
            rotation="-90"
            originX={size / 2}
            originY={size / 2}
          />
        ) : (
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={
              dashAnim
            }
            rotation="-90"
            originX={size / 2}
            originY={size / 2}
          />
        )}
      </Svg>

      <View
        style={{
          position: "absolute",
          width: size * 0.66,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontSize: Math.max(
              11,
              size * 0.065,
            ),
            fontWeight: "800",
            color: "#667085",
            marginBottom: 4,
          }}
        >
          {remaining >= 0
            ? "SAFE TO SPEND"
            : "OVER BUDGET"}
        </Text>

        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={{
            fontSize: Math.max(
              17,
              size * 0.105,
            ),
            fontWeight: "900",
            color: innerColor,
            textAlign: "center",
          }}
        >
          {balanceVisible
            ? fmt(
              remaining >= 0
                ? remaining
                : Math.abs(
                  remaining,
                ),
            )
            : "••••••"}
        </Text>

        <Text
          style={{
            fontSize: Math.max(
              10,
              size * 0.055,
            ),
            fontWeight: "700",
            color: "#718078",
            marginTop: 5,
          }}
        >
          {remaining >= 0
            ? "remaining"
            : "overspent"}
        </Text>

        {limit > 0 && (
          <View
            style={{
              marginTop: 8,
              paddingHorizontal: 9,
              paddingVertical: 4,
              borderRadius: 8,
              backgroundColor:
                color + "15",
            }}
          >
            <Text
              style={{
                fontSize: Math.max(
                  9,
                  size * 0.05,
                ),
                fontWeight: "900",
                color,
              }}
            >
              {pct}% INR
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

/* ============================================================
   CATEGORY DONUT
============================================================ */

function CategoryDonut({
  data = [],
  categoriesMap = {},
}) {
  const size = 160;
  const strokeWidth = 18;
  const radius =
    (size - strokeWidth) / 2;

  const circumference =
    2 * Math.PI * radius;

  const total = data.reduce(
    (sum, d) =>
      sum + Number(d.amount || 0),
    0,
  );

  let cumulative = 0;

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg
        width={size}
        height={size}
      >
        {data.map((d, i) => {
          const value =
            Number(d.amount || 0);

          const percent =
            total > 0
              ? value / total
              : 0;

          const cat =
            categoriesMap[
            d.category_id
            ] || {};

          const color =
            cat.color || "#eee";

          const strokeDasharray =
            `${circumference * percent} ${circumference}`;

          const rotation =
            total > 0
              ? (cumulative / total) *
              360
              : 0;

          cumulative += value;

          return (
            <Circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
              strokeWidth={
                strokeWidth
              }
              fill="none"
              strokeDasharray={
                strokeDasharray
              }
              rotation={
                rotation - 90
              }
              originX={size / 2}
              originY={size / 2}
              strokeLinecap="butt"
            />
          );
        })}
      </Svg>

      <View
        style={{
          position: "absolute",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontWeight: "700",
            fontSize: 14,
          }}
        >
          Total Spend
        </Text>

        <Text
          style={{
            fontSize: 18,
            fontWeight: "800",
          }}
        >
          ₹
          {total.toLocaleString(
            "en-IN",
          )}
        </Text>
      </View>
    </View>
  );
}

/* ============================================================
   HOME SCREEN
============================================================ */

export default function HomeScreen({
  navigation,
}) {
  const {
    balanceVisible,
  } = useBalanceVisibility();

  const {
    width: screenWidth,
  } = useWindowDimensions();

  const budgetDonutSize =
    Math.min(
      240,
      Math.max(
        190,
        screenWidth - 80,
      ),
    );

  const {
    show: showPageLoader,
    hide: hidePageLoader,
  } = usePageLoader();

  const dispatch =
    useAppDispatch();

  const topCategories =
    useTopCategories();

  const sources =
    useSources();

  const sourceBalances =
    useSourceBalances();

  const budgets =
    useBudgets();

  const selectedBudgetId =
    useSelectedBudgetId();

  const recentTx =
    useRecentTransactions();

  const categoriesMap =
    useCategoriesMap();

  const bills =
    useBills();

  const billsSummary =
    useBillsSummary();

  const categoryBudgets =
    useCategoryBudgets();

  const otherCategorySpending =
    useOtherCategorySpending();

  const othersExpanded =
    useOthersExpanded();

  const loadingRef =
    React.useRef(false);

  const hasLoadedRef =
    React.useRef(false);

  const refreshPendingRef =
    React.useRef(false);

  const categoriesLoadedRef =
    React.useRef(
      Object.keys(
        categoriesMap || {},
      ).length > 0,
    );

  const sourcesLoadedRef =
    React.useRef(
      Array.isArray(sources) &&
      sources.length > 0,
    );

  /* ==========================================================
     CATEGORIES
  ========================================================== */

  async function ensureCategories() {
    if (
      categoriesLoadedRef.current &&
      Object.keys(
        categoriesMap || {},
      ).length > 0
    ) {
      return categoriesMap;
    }

    try {
      const cats =
        await getCategories(true);

      const map = {};

      (Array.isArray(cats)
        ? cats
        : []
      ).forEach((category) => {
        map[category.id] =
          category;
      });

      dispatch(
        setCategoriesMap(map),
      );

      categoriesLoadedRef.current =
        true;

      return map;
    } catch (error) {
      console.error(
        "Home categories error:",
        error,
      );

      return {};
    }
  }

  /* ==========================================================
     SOURCES
  ========================================================== */

  async function ensureSources() {
    if (
      sourcesLoadedRef.current &&
      Array.isArray(sources) &&
      sources.length > 0
    ) {
      return sources;
    }

    try {
      const loadedSources =
        await getSources(true);

      const safeSources =
        Array.isArray(
          loadedSources,
        )
          ? loadedSources
          : [];

      dispatch(
        setSources(
          safeSources,
        ),
      );

      sourcesLoadedRef.current =
        true;

      return safeSources;
    } catch (error) {
      console.error(
        "Home sources error:",
        error,
      );

      dispatch(
        setSources([]),
      );

      return [];
    }
  }

  /* ==========================================================
     BILLS
  ========================================================== */

  async function loadBills() {
    try {
      const now = new Date();

      const currentYear =
        now.getFullYear();

      const currentMonth =
        now.getMonth();

      const bl =
        await getBillsForCurrentMonth(
          {
            sortBy: "due_date",
          },
        );

      const allBills =
        Array.isArray(bl)
          ? bl
          : [];

      const currentMonthBills =
        allBills.filter(
          (bill) => {
            if (!bill?.due_date) {
              return false;
            }

            const dueDate =
              new Date(
                bill.due_date,
              );

            if (
              Number.isNaN(
                dueDate.getTime(),
              )
            ) {
              return false;
            }

            return (
              dueDate.getFullYear() ===
              currentYear &&
              dueDate.getMonth() ===
              currentMonth
            );
          },
        );

      currentMonthBills.sort(
        (a, b) =>
          new Date(
            a.due_date,
          ).getTime() -
          new Date(
            b.due_date,
          ).getTime(),
      );

      const todayStart =
        new Date(
          currentYear,
          currentMonth,
          now.getDate(),
          0,
          0,
          0,
          0,
        );

      const next7DaysEnd =
        new Date(
          todayStart,
        );

      next7DaysEnd.setDate(
        next7DaysEnd.getDate() +
        7,
      );

      next7DaysEnd.setHours(
        23,
        59,
        59,
        999,
      );

      const summary =
        currentMonthBills.reduce(
          (
            result,
            bill,
          ) => {
            const amount =
              Number(
                bill.amount || 0,
              );

            const dueDate =
              new Date(
                bill.due_date,
              );

            if (
              Number.isNaN(
                dueDate.getTime(),
              )
            ) {
              return result;
            }

            const status =
              String(
                bill.status ||
                bill.payment_status ||
                "",
              ).toLowerCase();

            const isPaid =
              status === "paid";

            const isSkipped =
              status ===
              "skipped";

            if (!isSkipped) {
              result.totalThisMonth +=
                amount;
            }

            if (isPaid) {
              result.totalPaid +=
                amount;

              return result;
            }

            if (isSkipped) {
              return result;
            }

            const dueDateOnly =
              new Date(
                dueDate.getFullYear(),
                dueDate.getMonth(),
                dueDate.getDate(),
                0,
                0,
                0,
              );

            if (
              dueDateOnly <
              todayStart
            ) {
              result.overdueAmount +=
                amount;
            }

            return result;
          },
          {
            totalThisMonth: 0,
            totalPaid: 0,
            overdueAmount: 0,
            upcoming7: 0,
          },
        );

      const upcoming7Amount =
        allBills.reduce(
          (total, bill) => {
            if (!bill?.due_date) {
              return total;
            }

            const dueDate =
              new Date(
                bill.due_date,
              );

            if (
              Number.isNaN(
                dueDate.getTime(),
              )
            ) {
              return total;
            }

            const status =
              String(
                bill.status ||
                bill.payment_status ||
                "",
              ).toLowerCase();

            if (
              status === "paid" ||
              status ===
              "skipped"
            ) {
              return total;
            }

            const dueDateOnly =
              new Date(
                dueDate.getFullYear(),
                dueDate.getMonth(),
                dueDate.getDate(),
                0,
                0,
                0,
                0,
              );

            if (
              dueDateOnly >=
              todayStart &&
              dueDateOnly <=
              next7DaysEnd
            ) {
              return (
                total +
                Number(
                  bill.amount || 0,
                )
              );
            }

            return total;
          },
          0,
        );

      summary.upcoming7 =
        upcoming7Amount;

      dispatch(
        setBills(
          currentMonthBills,
        ),
      );

      dispatch(
        setBillsSummary(
          summary,
        ),
      );

      return {
        bills:
          currentMonthBills,
        summary,
      };
    } catch (error) {
      console.error(
        "Home bills error:",
        error,
      );

      dispatch(
        setBills([]),
      );

      dispatch(
        setBillsSummary(null),
      );

      return {
        bills: [],
        summary: null,
      };
    }
  }

  /* ==========================================================
     RECENT TRANSACTIONS
  ========================================================== */

  async function loadRecentTransactions() {
    try {
      /*
       * This still uses the existing transaction service,
       * but only asks for THREE rows.
       *
       * This is cheap for Home.
       */
      const result =
        await import(
          "../services/transactions"
        );

      const tx =
        await result.getTransactions(
          3,
          "Yes",
        );

      dispatch(
        setRecentTransactions(
          Array.isArray(tx)
            ? tx
            : [],
        ),
      );

      return Array.isArray(tx)
        ? tx
        : [];
    } catch (error) {
      console.error(
        "Home recent transactions error:",
        error,
      );

      dispatch(
        setRecentTransactions(
          [],
        ),
      );

      return [];
    }
  }

  /* ==========================================================
     MAIN LOAD
  ========================================================== */

  async function load({
    showLoader = true,
    force = false,
  } = {}) {
    if (loadingRef.current) {
      return [];
    }

    if (
      hasLoadedRef.current &&
      !force
    ) {
      return [];
    }

    loadingRef.current = true;

    const startTime = Date.now();
    const minimumLoaderDelay = 700;

    if (showLoader) {
      showPageLoader();
    }

    try {
      /*
       * Load reference data first.
       *
       * These are small and needed to decorate
       * category/source results.
       */
      const [
        loadedCategoriesMap,
        loadedSources,
      ] = await Promise.all([
        ensureCategories(),
        ensureSources(),
      ]);

      /*
       * All major Home sections now load in parallel.
       *
       * None of these loads the entire transaction table.
       */
      const [
        loadedBudgets,
        loadedCategorySpending,
        loadedSourceBalances,
        loadedBills,
        loadedRecentTransactions,
      ] = await Promise.all([
        getHomeBudgets(),
        getHomeCategorySpending(
          loadedCategoriesMap,
        ),
        getHomeSourceBalances(
          loadedSources,
        ),
        loadBills(),
        loadRecentTransactions(),
      ]);

      /*
       * Category budgets should only be queried when
       * a monthly budget exists.
       *
       * This prevents the category_budgets DB query
       * from executing unnecessarily.
       */
      let loadedCategoryBudgets = [];

      if (
        Array.isArray(loadedBudgets) &&
        loadedBudgets.length > 0
      ) {
        loadedCategoryBudgets =
          await getHomeCategoryBudgets(
            loadedCategoriesMap,
          );
      }

      dispatch(
        setBudgets(
          loadedBudgets,
        ),
      );

      dispatch(
        setCategoryBudgets(
          loadedCategoryBudgets,
        ),
      );

      dispatch(
        setTopCategories(
          loadedCategorySpending,
        ),
      );

      dispatch(
        setSourceBalances(
          loadedSourceBalances,
        ),
      );

      /*
       * OTHERS depends on category budgets,
       * but not on transactions in JS.
       */
      let others = [];

      if (
        Array.isArray(loadedBudgets) &&
        loadedBudgets.length > 0 &&
        Array.isArray(loadedCategoryBudgets) &&
        loadedCategoryBudgets.length > 0
      ) {
        others =
          await getHomeOtherCategorySpending(
            loadedCategoriesMap,
            loadedCategoryBudgets,
          );
      }

      dispatch(
        setOtherCategorySpending(
          others,
        ),
      );

      /*
       * Preserve existing selected budget behavior.
       */
      if (
        loadedBudgets?.length &&
        !selectedBudgetId
      ) {
        const firstId =
          String(
            loadedBudgets[0]
              ?.budget?.id,
          );

        if (firstId) {
          dispatch(
            setSelectedBudgetId(
              firstId,
            ),
          );
        }
      }

      return loadedBudgets;
    } catch (error) {
      console.error(
        "Home.load failed:",
        error,
      );

      return [];
    } finally {
      if (showLoader) {
        const elapsed = Date.now() - startTime;
        const remainingDelay = minimumLoaderDelay - elapsed;

        if (remainingDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, remainingDelay));
        }
      }

      loadingRef.current =
        false;

      hasLoadedRef.current =
        true;

      if (showLoader) {
        hidePageLoader();
      }
    }
  }

  /* ==========================================================
     INITIAL LOAD
  ========================================================== */

  useEffect(() => {
    let mounted = true;

    const timer = setTimeout(() => {
      (async () => {
        const bs =
          await load({
            showLoader: true,
            force: true,
          });

        if (
          mounted &&
          bs?.length
        ) {
          const firstId =
            String(
              bs[0]?.budget?.id,
            );

          if (firstId) {
            dispatch(
              setSelectedBudgetId(
                firstId,
              ),
            );
          }
        }
      })();
    }, 300);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, []);

  /* ==========================================================
     HOME FOCUS
  ========================================================== */

  useEffect(() => {
    const unsubscribe =
      navigation.addListener(
        "focus",
        () => {
          if (
            !refreshPendingRef.current
          ) {
            return;
          }

          refreshPendingRef.current =
            false;

          load({
            showLoader: false,
            force: true,
          });
        },
      );

    return unsubscribe;
  }, [navigation]);

  /* ==========================================================
     TRANSACTION CHANGES
  ========================================================== */

  useEffect(() => {
    const off =
      events.on(
        "transactionsChanged",
        () => {
          refreshPendingRef.current =
            true;

          if (
            hasLoadedRef.current
          ) {
            refreshPendingRef.current =
              false;

            load({
              showLoader: false,
              force: true,
            });
          }
        },
      );

    return () => off();
  }, []);

  /* ==========================================================
     BILL CHANGES
  ========================================================== */

  useEffect(() => {
    const offBills =
      events.on(
        "billsChanged",
        () => {
          refreshPendingRef.current =
            true;

          if (
            hasLoadedRef.current
          ) {
            refreshPendingRef.current =
              false;

            load({
              showLoader: false,
              force: true,
            });
          }
        },
      );

    return () => offBills();
  }, []);

  /* ==========================================================
     BUDGET CHANGES
  ========================================================== */

  useEffect(() => {
    const off =
      events.on(
        "budgetsChanged",
        async (id) => {
          if (id) {
            dispatch(
              setSelectedBudgetId(
                String(id),
              ),
            );
          }

          refreshPendingRef.current =
            true;

          if (
            hasLoadedRef.current
          ) {
            refreshPendingRef.current =
              false;

            const bs =
              await load({
                showLoader: false,
                force: true,
              });

            if (
              !id &&
              bs?.length
            ) {
              dispatch(
                setSelectedBudgetId(
                  String(
                    bs[0]?.budget?.id,
                  ),
                ),
              );
            }
          }
        },
      );

    return () => off();
  }, [dispatch]);

  /* ==========================================================
     DISPLAY DATA
  ========================================================== */

  const totalSpend =
    topCategories.reduce(
      (sum, category) =>
        sum +
        Number(
          category.amount || 0,
        ),
      0,
    );

  const sortedBills =
    [...bills].sort(
      (a, b) =>
        new Date(
          a.due_date || 0,
        ).getTime() -
        new Date(
          b.due_date || 0,
        ).getTime(),
    );

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <View
      style={{
        flex: 1,
        backgroundColor:
          "#F5FAF7",
      }}
    >
      <ScrollView
        style={{
          flex: 1,
        }}
        contentContainerStyle={{
          paddingHorizontal:
            Spacing.xs,
          paddingTop:
            Spacing.xs,
          paddingBottom: 82,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* =====================================================
            MONTHLY BUDGET
        ===================================================== */}

        <Card>
          {budgets.length ? (
            <>
              {(() => {
                const sel =
                  budgets.find(
                    (item) =>
                      String(
                        item?.budget?.id,
                      ) ===
                      String(
                        selectedBudgetId,
                      ),
                  ) ||
                  budgets[0];

                if (
                  !sel ||
                  !sel.budget
                ) {
                  return null;
                }

                const limit =
                  Number(
                    sel.budget
                      ?.monthly_limit ??
                    0,
                  );

                const spent =
                  Number(
                    sel?.spent ?? 0,
                  );

                const remaining =
                  Number(
                    sel?.remaining ??
                    0,
                  );

                const daysLeft =
                  daysRemainingInMonth();

                const percentage =
                  limit > 0
                    ? Math.round(
                      (spent /
                        limit) *
                      100,
                    )
                    : 0;

                const statusColor =
                  getBudgetProgressColor(
                    percentage,
                  );

                const isOverBudget =
                  remaining < 0;

                const dailyAllowance =
                  daysLeft > 0 &&
                    remaining > 0
                    ? remaining /
                    daysLeft
                    : 0;

                const budgetName =
                  sel.budget?.name ||
                  sel.budget?.title ||
                  "Monthly Budget";

                const statusLabel =
                  isOverBudget
                    ? "Over budget"
                    : percentage >=
                      70
                      ? "Getting close"
                      : "On track";

                return (
                  <View
                    style={{
                      width: "100%",
                      paddingVertical: 8,
                    }}
                  >
                    <View
                      style={{
                        flexDirection:
                          "row",
                        alignItems:
                          "center",
                        justifyContent:
                          "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <View
                        style={{
                          flex: 1,
                          minWidth: 0,
                          paddingRight: 10,
                        }}
                      >
                        <Text
                          style={{
                            fontWeight:
                              "900",
                            fontSize: 18,
                            color:
                              "#2F7355",
                          }}
                        >
                          Budgets
                        </Text>

                        <Text
                          style={{
                            marginTop: 2,
                            fontSize: 11,
                            fontWeight:
                              "600",
                            color:
                              "#718078",
                          }}
                        >
                          {getCurrentMonthYear()}{" "}
                          • Monthly spending
                        </Text>
                      </View>

                      <View
                        style={{
                          paddingHorizontal:
                            10,
                          paddingVertical:
                            6,
                          borderRadius: 10,
                          backgroundColor:
                            statusColor +
                            "15",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight:
                              "900",
                            color:
                              statusColor,
                          }}
                        >
                          {statusLabel}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={{
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                        marginTop: 4,
                        marginBottom: 8,
                      }}
                    >
                      <TouchableOpacity
                        activeOpacity={
                          0.9
                        }
                        onPress={() =>
                          navigation.navigate(
                            "Budgets",
                            {
                              editId:
                                sel
                                  .budget
                                  .id,
                            },
                          )
                        }
                      >
                        <BudgetDonut
                          limit={limit}
                          spent={spent}
                          remaining={
                            remaining
                          }
                          daysLeft={
                            daysLeft
                          }
                          balanceVisible={
                            balanceVisible
                          }
                          size={
                            budgetDonutSize
                          }
                        />
                      </TouchableOpacity>
                    </View>

                    <View
                      style={{
                        flexDirection:
                          "row",
                        width: "100%",
                        gap: 8,
                      }}
                    >
                      {/* BUDGET */}
                      <View
                        style={{
                          flex: 1,
                          minWidth: 0,
                          paddingVertical: 11,
                          paddingHorizontal: 8,
                          borderRadius: 14,
                          backgroundColor:
                            "#F8FCFA",
                          borderWidth: 1,
                          borderColor:
                            "#E5F1EB",
                          alignItems:
                            "center",
                        }}
                      >
                        <MaterialCommunityIcons
                          name="wallet-outline"
                          size={17}
                          color="#3F8F6B"
                        />

                        <Text
                          style={{
                            fontSize: 9,
                            fontWeight:
                              "800",
                            color:
                              "#718078",
                            marginTop: 4,
                          }}
                        >
                          BUDGET
                        </Text>

                        <Text
                          numberOfLines={
                            1
                          }
                          adjustsFontSizeToFit
                          minimumFontScale={
                            0.7
                          }
                          style={{
                            fontSize: 13,
                            fontWeight:
                              "900",
                            color:
                              "#25352D",
                            marginTop: 2,
                          }}
                        >
                          {balanceVisible
                            ? `₹${limit.toLocaleString(
                              "en-IN",
                            )}`
                            : "••••••"}
                        </Text>
                      </View>

                      {/* SPENT */}
                      <View
                        style={{
                          flex: 1,
                          minWidth: 0,
                          paddingVertical: 11,
                          paddingHorizontal: 8,
                          borderRadius: 14,
                          backgroundColor:
                            "#F8FCFA",
                          borderWidth: 1,
                          borderColor:
                            "#E5F1EB",
                          alignItems:
                            "center",
                        }}
                      >
                        <MaterialCommunityIcons
                          name="arrow-up-circle-outline"
                          size={17}
                          color="#E35D6A"
                        />

                        <Text
                          style={{
                            fontSize: 9,
                            fontWeight:
                              "800",
                            color:
                              "#718078",
                            marginTop: 4,
                          }}
                        >
                          SPENT
                        </Text>

                        <Text
                          numberOfLines={
                            1
                          }
                          adjustsFontSizeToFit
                          minimumFontScale={
                            0.7
                          }
                          style={{
                            fontSize: 13,
                            fontWeight:
                              "900",
                            color:
                              "#E35D6A",
                            marginTop: 2,
                          }}
                        >
                          {balanceVisible
                            ? `₹${spent.toLocaleString(
                              "en-IN",
                            )}`
                            : "••••••"}
                        </Text>
                      </View>

                      {/* REMAINING */}
                      <View
                        style={{
                          flex: 1,
                          minWidth: 0,
                          paddingVertical: 11,
                          paddingHorizontal: 8,
                          borderRadius: 14,
                          backgroundColor:
                            isOverBudget
                              ? "#FFF5F5"
                              : "#F8FCFA",
                          borderWidth: 1,
                          borderColor:
                            isOverBudget
                              ? "#FECACA"
                              : "#E5F1EB",
                          alignItems:
                            "center",
                        }}
                      >
                        <MaterialCommunityIcons
                          name={
                            isOverBudget
                              ? "alert-circle-outline"
                              : "shield-check-outline"
                          }
                          size={17}
                          color={
                            isOverBudget
                              ? "#D92D20"
                              : "#3F8F6B"
                          }
                        />

                        <Text
                          style={{
                            fontSize: 9,
                            fontWeight:
                              "800",
                            color:
                              "#718078",
                            marginTop: 4,
                          }}
                        >
                          {isOverBudget
                            ? "OVER"
                            : "LEFT"}
                        </Text>

                        <Text
                          numberOfLines={
                            1
                          }
                          adjustsFontSizeToFit
                          minimumFontScale={
                            0.7
                          }
                          style={{
                            fontSize: 13,
                            fontWeight:
                              "900",
                            color:
                              isOverBudget
                                ? "#D92D20"
                                : "#3F8F6B",
                            marginTop: 2,
                          }}
                        >
                          {balanceVisible
                            ? `₹${Math.abs(
                              remaining,
                            ).toLocaleString(
                              "en-IN",
                            )}`
                            : "••••••"}
                        </Text>
                      </View>
                    </View>

                    {!isOverBudget &&
                      daysLeft > 0 && (
                        <View
                          style={{
                            flexDirection:
                              "row",
                            alignItems:
                              "center",
                            marginTop: 10,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            borderRadius: 13,
                            backgroundColor:
                              "#EEF8F2",
                          }}
                        >
                          <MaterialCommunityIcons
                            name="calendar-clock-outline"
                            size={18}
                            color="#3F8F6B"
                          />

                          <View
                            style={{
                              flex: 1,
                              marginLeft: 8,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight:
                                  "700",
                                color:
                                  "#718078",
                              }}
                            >
                              Suggested daily spending
                            </Text>

                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight:
                                  "900",
                                color:
                                  "#2F7355",
                                marginTop: 1,
                              }}
                            >
                              {balanceVisible
                                ? `₹${dailyAllowance.toLocaleString(
                                  "en-IN",
                                  {
                                    maximumFractionDigits: 0,
                                  },
                                )} / day`
                                : "•••••• / day"}
                            </Text>
                          </View>

                          <Text
                            style={{
                              fontSize: 10,
                              fontWeight:
                                "800",
                              color:
                                "#718078",
                            }}
                          >
                            {daysLeft}{" "}
                            {daysLeft ===
                              1
                              ? "day"
                              : "days"}{" "}
                            left
                          </Text>
                        </View>
                      )}

                    {isOverBudget && (
                      <View
                        style={{
                          flexDirection:
                            "row",
                          alignItems:
                            "center",
                          marginTop: 10,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          borderRadius: 13,
                          backgroundColor:
                            "#FFF1F1",
                        }}
                      >
                        <MaterialCommunityIcons
                          name="alert-outline"
                          size={18}
                          color="#D92D20"
                        />

                        <Text
                          style={{
                            flex: 1,
                            marginLeft: 8,
                            fontSize: 11,
                            fontWeight:
                              "700",
                            color:
                              "#B42318",
                          }}
                        >
                          You have exceeded this month's budget by{" "}
                          {balanceVisible
                            ? `₹${Math.abs(
                              remaining,
                            ).toLocaleString(
                              "en-IN",
                            )}`
                            : "••••••"}
                          .
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      activeOpacity={
                        0.7
                      }
                      onPress={() =>
                        navigation.navigate(
                          "Budgets",
                          {
                            editId:
                              sel
                                .budget
                                .id,
                          },
                        )
                      }
                      style={{
                        flexDirection:
                          "row",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                        marginTop: 12,
                        paddingVertical: 3,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight:
                            "800",
                          color:
                            "#3F8F6B",
                        }}
                      >
                        Tap to manage budget
                      </Text>

                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={15}
                        color="#3F8F6B"
                      />
                    </TouchableOpacity>
                  </View>
                );
              })()}
            </>
          ) : (
            <View
              style={{
                flex: 1,
                justifyContent:
                  "center",
                alignItems:
                  "center",
                paddingVertical: 16,
                width: "100%",
              }}
            >
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate(
                    "Budgets",
                  )
                }
              >
                <BudgetDonut
                  limit={0}
                  spent={0}
                  remaining={0}
                  daysLeft={daysRemainingInMonth()}
                  balanceVisible={
                    balanceVisible
                  }
                  size={
                    budgetDonutSize
                  }
                />
              </TouchableOpacity>

              <View
                style={{
                  marginTop: 12,
                  width: "100%",
                  maxWidth: 360,
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                }}
              >
                <Text
                  style={{
                    fontWeight:
                      "700",
                    fontSize: 16,
                    textAlign:
                      "center",
                  }}
                >
                  No budgets set
                </Text>

                <Text
                  style={{
                    color:
                      "#718078",
                    marginTop: 8,
                    textAlign:
                      "center",
                  }}
                >
                  Create a budget to track monthly spending and see safe/overspent amounts here.
                </Text>

                <PaperButton
                  mode="contained"
                  buttonColor="#3F8F6B"
                  textColor="#FFFFFF"
                  onPress={() =>
                    navigation.navigate(
                      "Budgets",
                    )
                  }
                  style={{
                    marginTop: 12,
                    borderRadius: 12,
                  }}
                >
                  Create Budget
                </PaperButton>
              </View>
            </View>
          )}
        </Card>

        {/* =====================================================
            CATEGORY BUDGETS
        ===================================================== */}

        {budgets.length > 0 &&
          categoryBudgets.length > 0 && (
            <Card>
              <Text
                style={{
                  fontWeight:
                    "800",
                  fontSize: 16,
                  color:
                    "#2F7355",
                  marginBottom: 14,
                }}
              >
                Category Budgets
              </Text>

              {[...categoryBudgets]
                .sort(
                  (a, b) =>
                    b.percentage -
                    a.percentage,
                )
                .map(
                  (
                    budget,
                  ) => {
                    const categoryColor =
                      budget.color ||
                      "#4B7CF3";

                    const spent =
                      Number(
                        budget.spent ||
                        0,
                      );

                    const budgetAmount =
                      Number(
                        budget.budget ||
                        0,
                      );

                    const remaining =
                      Number(
                        budget.remaining ||
                        0,
                      );

                    const percentage =
                      Math.round(
                        Number(
                          budget.percentage ||
                          0,
                        ),
                      );

                    const budgetStatusColor =
                      getBudgetProgressColor(
                        percentage,
                      );

                    const isOverBudget =
                      percentage >
                      100;

                    return (
                      <TouchableOpacity
                        key={
                          budget.id
                        }
                        activeOpacity={
                          0.88
                        }
                        onPress={() =>
                          navigation.navigate(
                            "CategoriesDetails",
                            {
                              categoryId:
                                budget.categoryId,
                              categoryName:
                                budget.categoryName,
                            },
                          )
                        }
                        style={{
                          marginBottom: 10,
                          paddingVertical: 12,
                          paddingHorizontal: 10,
                          borderRadius: 16,
                          backgroundColor:
                            isOverBudget
                              ? "#FFF5F5"
                              : "#F8FCFA",
                          borderWidth: 1,
                          borderColor:
                            isOverBudget
                              ? "#FECACA"
                              : "#E5F1EB",
                        }}
                      >
                        <View
                          style={{
                            flexDirection:
                              "row",
                            alignItems:
                              "center",
                            width: "100%",
                          }}
                        >
                          <View
                            style={{
                              width: "15%",
                              alignItems:
                                "flex-start",
                              justifyContent:
                                "center",
                            }}
                          >
                            <View
                              style={{
                                width: 42,
                                height: 42,
                                borderRadius: 14,
                                backgroundColor:
                                  categoryColor,
                                alignItems:
                                  "center",
                                justifyContent:
                                  "center",
                              }}
                            >
                              <MaterialCommunityIcons
                                name={
                                  budget.icon ||
                                  "tag-outline"
                                }
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
                              numberOfLines={
                                1
                              }
                              ellipsizeMode="tail"
                              style={{
                                fontSize: 14,
                                fontWeight:
                                  "800",
                                color:
                                  isOverBudget
                                    ? "#B42318"
                                    : "#2F7355",
                                marginBottom: 3,
                              }}
                            >
                              {
                                budget.categoryName
                              }
                            </Text>

                            <Text
                              numberOfLines={
                                1
                              }
                              style={{
                                fontSize: 11,
                                fontWeight:
                                  "600",
                                color:
                                  "#718078",
                                marginBottom: 7,
                              }}
                            >
                              {balanceVisible
                                ? `₹${spent.toLocaleString(
                                  "en-IN",
                                )} of ₹${budgetAmount.toLocaleString(
                                  "en-IN",
                                )}`
                                : "•••••• of ••••••"}
                            </Text>

                            <View
                              style={{
                                width:
                                  "100%",
                                height: 7,
                                backgroundColor:
                                  "#DCEDE4",
                                borderRadius: 10,
                                overflow:
                                  "hidden",
                              }}
                            >
                              <View
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.max(
                                      0,
                                      percentage,
                                    ),
                                  )}%`,
                                  height:
                                    "100%",
                                  backgroundColor:
                                    budgetStatusColor,
                                  borderRadius: 10,
                                }}
                              />
                            </View>
                          </View>

                          <View
                            style={{
                              width: "25%",
                              alignItems:
                                "flex-end",
                              justifyContent:
                                "center",
                              paddingLeft: 5,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 18,
                                fontWeight:
                                  "900",
                                color:
                                  budgetStatusColor,
                                letterSpacing:
                                  -0.4,
                              }}
                            >
                              {percentage}%
                            </Text>

                            <Text
                              numberOfLines={
                                1
                              }
                              adjustsFontSizeToFit
                              minimumFontScale={
                                0.75
                              }
                              style={{
                                fontSize: 10,
                                fontWeight:
                                  "700",
                                color:
                                  isOverBudget
                                    ? "#D92D20"
                                    : "#718078",
                                marginTop: 3,
                                textAlign:
                                  "right",
                              }}
                            >
                              {balanceVisible
                                ? remaining >=
                                  0
                                  ? `₹${remaining.toLocaleString(
                                    "en-IN",
                                  )} left`
                                  : `₹${Math.abs(
                                    remaining,
                                  ).toLocaleString(
                                    "en-IN",
                                  )} over`
                                : "••••••"}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  },
                )}

              {/* OTHERS */}

              {otherCategorySpending.length >
                0 &&
                (() => {
                  const othersTotal =
                    otherCategorySpending.reduce(
                      (
                        sum,
                        item,
                      ) =>
                        sum +
                        Number(
                          item.amount ||
                          0,
                        ),
                      0,
                    );

                  const totalCategorySpend =
                    categoryBudgets.reduce(
                      (
                        sum,
                        item,
                      ) =>
                        sum +
                        Number(
                          item.spent ||
                          0,
                        ),
                      0,
                    ) +
                    othersTotal;

                  const othersPercentage =
                    totalCategorySpend >
                      0
                      ? Math.round(
                        (othersTotal /
                          totalCategorySpend) *
                        100,
                      )
                      : 0;

                  return (
                    <View>
                      <TouchableOpacity
                        activeOpacity={
                          0.88
                        }
                        onPress={() =>
                          dispatch(
                            setOthersExpanded(
                              !othersExpanded,
                            ),
                          )
                        }
                        style={{
                          marginBottom:
                            othersExpanded
                              ? 6
                              : 0,
                          paddingVertical: 12,
                          paddingHorizontal: 10,
                          borderRadius: 16,
                          backgroundColor:
                            "#F8FCFA",
                          borderWidth: 1,
                          borderColor:
                            "#E5F1EB",
                        }}
                      >
                        <View
                          style={{
                            flexDirection:
                              "row",
                            alignItems:
                              "center",
                            width: "100%",
                          }}
                        >
                          <View
                            style={{
                              width: "15%",
                              alignItems:
                                "flex-start",
                              justifyContent:
                                "center",
                            }}
                          >
                            <View
                              style={{
                                width: 42,
                                height: 42,
                                borderRadius: 14,
                                backgroundColor:
                                  "#718078",
                                alignItems:
                                  "center",
                                justifyContent:
                                  "center",
                              }}
                            >
                              <MaterialCommunityIcons
                                name={
                                  othersExpanded
                                    ? "chevron-up"
                                    : "dots-horizontal"
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
                                flexDirection:
                                  "row",
                                alignItems:
                                  "center",
                                marginBottom: 3,
                              }}
                            >
                              <Text
                                numberOfLines={
                                  1
                                }
                                ellipsizeMode="tail"
                                style={{
                                  fontSize: 14,
                                  fontWeight:
                                    "800",
                                  color:
                                    "#2F7355",
                                  flexShrink:
                                    1,
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
                                  backgroundColor:
                                    "#EAF1ED",
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 8,
                                    fontWeight:
                                      "800",
                                    color:
                                      "#718078",
                                  }}
                                >
                                  {
                                    otherCategorySpending.length
                                  }{" "}
                                  {otherCategorySpending.length ===
                                    1
                                    ? "category"
                                    : "categories"}
                                </Text>
                              </View>
                            </View>

                            <Text
                              numberOfLines={
                                1
                              }
                              style={{
                                fontSize: 11,
                                fontWeight:
                                  "600",
                                color:
                                  "#718078",
                                marginBottom: 7,
                              }}
                            >
                              {balanceVisible
                                ? `₹${othersTotal.toLocaleString(
                                  "en-IN",
                                )} spent`
                                : "•••••• spent"}
                            </Text>

                            <View
                              style={{
                                width:
                                  "100%",
                                height: 7,
                                backgroundColor:
                                  "#DCEDE4",
                                borderRadius: 10,
                                overflow:
                                  "hidden",
                              }}
                            >
                              <View
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.max(
                                      0,
                                      othersPercentage,
                                    ),
                                  )}%`,
                                  height:
                                    "100%",
                                  backgroundColor:
                                    "#718078",
                                  borderRadius: 10,
                                }}
                              />
                            </View>
                          </View>

                          <View
                            style={{
                              width: "25%",
                              alignItems:
                                "flex-end",
                              justifyContent:
                                "center",
                              paddingLeft: 5,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 18,
                                fontWeight:
                                  "900",
                                color:
                                  "#718078",
                                letterSpacing:
                                  -0.4,
                              }}
                            >
                              {
                                othersPercentage
                              }
                              %
                            </Text>

                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight:
                                  "700",
                                color:
                                  "#718078",
                                marginTop: 3,
                                textAlign:
                                  "right",
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
                            borderLeftColor:
                              "#DCEDE4",
                          }}
                        >
                          {otherCategorySpending.map(
                            (
                              item,
                              index,
                            ) => {
                              const amount =
                                Number(
                                  item.amount ||
                                  0,
                                );

                              const itemPercentage =
                                othersTotal >
                                  0
                                  ? Math.round(
                                    (amount /
                                      othersTotal) *
                                    100,
                                  )
                                  : 0;

                              const itemColor =
                                item.color ||
                                "#4B7CF3";

                              return (
                                <TouchableOpacity
                                  key={
                                    item.categoryId ||
                                    `other-${index}`
                                  }
                                  activeOpacity={
                                    0.88
                                  }
                                  onPress={() =>
                                    navigation.navigate(
                                      "CategoriesDetails",
                                      {
                                        categoryId:
                                          item.categoryId,
                                        categoryName:
                                          item.categoryName,
                                      },
                                    )
                                  }
                                  style={{
                                    marginBottom:
                                      index ===
                                        otherCategorySpending.length -
                                        1
                                        ? 0
                                        : 7,
                                    paddingVertical: 10,
                                    paddingHorizontal: 10,
                                    borderRadius: 14,
                                    backgroundColor:
                                      "#FBFDFC",
                                    borderWidth: 1,
                                    borderColor:
                                      "#E8F1EC",
                                  }}
                                >
                                  <View
                                    style={{
                                      flexDirection:
                                        "row",
                                      alignItems:
                                        "center",
                                      width: "100%",
                                    }}
                                  >
                                    <View
                                      style={{
                                        width: "15%",
                                        alignItems:
                                          "flex-start",
                                        justifyContent:
                                          "center",
                                      }}
                                    >
                                      <View
                                        style={{
                                          width: 38,
                                          height: 38,
                                          borderRadius: 12,
                                          backgroundColor:
                                            itemColor,
                                          alignItems:
                                            "center",
                                          justifyContent:
                                            "center",
                                        }}
                                      >
                                        <MaterialCommunityIcons
                                          name={
                                            item.icon ||
                                            "tag-outline"
                                          }
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
                                        numberOfLines={
                                          1
                                        }
                                        ellipsizeMode="tail"
                                        style={{
                                          fontSize: 13,
                                          fontWeight:
                                            "800",
                                          color:
                                            "#2F7355",
                                          marginBottom: 3,
                                        }}
                                      >
                                        {
                                          item.categoryName
                                        }
                                      </Text>

                                      <Text
                                        numberOfLines={
                                          1
                                        }
                                        style={{
                                          fontSize: 10,
                                          fontWeight:
                                            "600",
                                          color:
                                            "#718078",
                                          marginBottom: 6,
                                        }}
                                      >
                                        {balanceVisible
                                          ? `₹${amount.toLocaleString(
                                            "en-IN",
                                          )} spent`
                                          : "•••••• spent"}
                                      </Text>

                                      <View
                                        style={{
                                          width:
                                            "100%",
                                          height: 6,
                                          backgroundColor:
                                            "#DCEDE4",
                                          borderRadius: 10,
                                          overflow:
                                            "hidden",
                                        }}
                                      >
                                        <View
                                          style={{
                                            width: `${Math.min(
                                              100,
                                              Math.max(
                                                0,
                                                itemPercentage,
                                              ),
                                            )}%`,
                                            height:
                                              "100%",
                                            backgroundColor:
                                              itemColor,
                                            borderRadius: 10,
                                          }}
                                        />
                                      </View>
                                    </View>

                                    <View
                                      style={{
                                        width: "25%",
                                        alignItems:
                                          "flex-end",
                                        justifyContent:
                                          "center",
                                        paddingLeft: 5,
                                      }}
                                    >
                                      <Text
                                        style={{
                                          fontSize: 16,
                                          fontWeight:
                                            "900",
                                          color:
                                            itemColor,
                                          letterSpacing:
                                            -0.3,
                                        }}
                                      >
                                        {
                                          itemPercentage
                                        }
                                        %
                                      </Text>

                                      <Text
                                        style={{
                                          fontSize: 9,
                                          fontWeight:
                                            "600",
                                          color:
                                            "#718078",
                                          marginTop: 2,
                                          textAlign:
                                            "right",
                                        }}
                                      >
                                        of Others
                                      </Text>
                                    </View>
                                  </View>
                                </TouchableOpacity>
                              );
                            },
                          )}
                        </View>
                      )}
                    </View>
                  );
                })()}
            </Card>
          )}

        {/* =====================================================
            LATEST TRANSACTIONS
        ===================================================== */}

        <Card>
          <View
            style={{
              flexDirection:
                "row",
              alignItems:
                "center",
              justifyContent:
                "space-between",
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                fontWeight:
                  "800",
                fontSize: 16,
                color:
                  "#2F7355",
              }}
            >
              Latest transactions
            </Text>

            {recentTx.length >
              2 && (
                <TouchableOpacity
                  activeOpacity={
                    0.7
                  }
                  onPress={() =>
                    navigation.navigate(
                      "Transactions",
                    )
                  }
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 10,
                    backgroundColor:
                      "#EAF5EF",
                  }}
                >
                  <Text
                    style={{
                      color:
                        "#3F8F6B",
                      fontSize: 11,
                      fontWeight:
                        "800",
                    }}
                  >
                    See all ›
                  </Text>
                </TouchableOpacity>
              )}
          </View>

          {recentTx.length ? (
            recentTx
              .slice(0, 3)
              .map(
                (
                  r,
                  index,
                ) => {
                  const cat =
                    categoriesMap[
                    r.category_id
                    ] || {};

                  const source =
                    sources.find(
                      (s) =>
                        s.id ===
                        r.source_id,
                    );

                  const type =
                    String(
                      r.type || "",
                    ).toLowerCase();

                  const isTransfer =
                    type ===
                    "transfer" ||
                    r.transfer_group_id ||
                    r.is_transfer;

                  const transactionType =
                    isTransfer
                      ? "transfer"
                      : type ===
                        "income"
                        ? "income"
                        : "expense";

                  const amountColor =
                    transactionType ===
                      "income"
                      ? "#20A56A"
                      : transactionType ===
                        "transfer"
                        ? "#718096"
                        : "#E35D6A";

                  const accentColor =
                    amountColor;

                  const iconColor =
                    cat.color ||
                    accentColor;

                  const transactionDate =
                    new Date(
                      r.date,
                    );

                  const dateText =
                    transactionDate.toLocaleDateString(
                      undefined,
                      {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      },
                    );

                  const timeText =
                    transactionDate.toLocaleTimeString(
                      "en-IN",
                      {
                        hour: "2-digit",
                        minute:
                          "2-digit",
                        hour12:
                          true,
                      },
                    );

                  return (
                    <TouchableOpacity
                      key={r.id}
                      activeOpacity={
                        0.88
                      }
                      onPress={() =>
                        navigation.navigate(
                          "TransactionAdd",
                          {
                            isEdit:
                              true,
                            transaction:
                              r,
                          },
                        )
                      }
                      style={{
                        marginBottom:
                          index ===
                            recentTx.slice(
                              0,
                              3,
                            ).length -
                            1
                            ? 4
                            : 8,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor:
                            "#FFFFFF",
                          borderRadius: 17,
                          overflow:
                            "hidden",
                          shadowColor:
                            "#000",
                          shadowOffset:
                          {
                            width: 0,
                            height: 3,
                          },
                          shadowOpacity:
                            0.06,
                          shadowRadius:
                            8,
                          elevation: 2,
                        }}
                      >
                        <View
                          style={{
                            position:
                              "absolute",
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: 4,
                            backgroundColor:
                              accentColor,
                          }}
                        />

                        <View
                          style={{
                            flexDirection:
                              "row",
                            alignItems:
                              "center",
                            minHeight: 82,
                            paddingLeft: 15,
                            paddingRight: 12,
                            paddingVertical: 12,
                          }}
                        >
                          <View
                            style={{
                              width: 50,
                              height: 50,
                              borderRadius: 16,
                              backgroundColor:
                                iconColor,
                              justifyContent:
                                "center",
                              alignItems:
                                "center",
                              marginRight: 12,
                              shadowColor:
                                iconColor,
                              shadowOffset:
                              {
                                width: 0,
                                height: 3,
                              },
                              shadowOpacity:
                                0.22,
                              shadowRadius:
                                6,
                              elevation: 3,
                            }}
                          >
                            <MaterialCommunityIcons
                              name={
                                cat.icon ||
                                (transactionType ===
                                  "income"
                                  ? "arrow-down-circle-outline"
                                  : transactionType ===
                                    "transfer"
                                    ? "swap-horizontal"
                                    : "arrow-up-circle-outline")
                              }
                              size={23}
                              color="#FFFFFF"
                            />
                          </View>

                          <View
                            style={{
                              flex: 1,
                              minWidth: 0,
                              justifyContent:
                                "center",
                              paddingRight: 8,
                            }}
                          >
                            <Text
                              numberOfLines={
                                2
                              }
                              ellipsizeMode="tail"
                              style={{
                                fontSize: 15,
                                lineHeight: 19,
                                fontWeight:
                                  "800",
                                color:
                                  "#25352D",
                                letterSpacing:
                                  -0.15,
                              }}
                            >
                              {r.notes ||
                                "No notes"}
                            </Text>

                            <View
                              style={{
                                flexDirection:
                                  "row",
                                alignItems:
                                  "center",
                                marginTop: 6,
                                minWidth:
                                  0,
                              }}
                            >
                              <View
                                style={{
                                  flexShrink:
                                    1,
                                  maxWidth:
                                    "58%",
                                  backgroundColor:
                                    iconColor +
                                    "12",
                                  borderRadius: 6,
                                  paddingHorizontal: 7,
                                  paddingVertical: 4,
                                  borderWidth: 1,
                                  borderColor:
                                    iconColor +
                                    "18",
                                }}
                              >
                                <Text
                                  numberOfLines={
                                    1
                                  }
                                  ellipsizeMode="tail"
                                  style={{
                                    color:
                                      iconColor,
                                    fontSize: 11,
                                    lineHeight:
                                      13,
                                    fontWeight:
                                      "800",
                                  }}
                                >
                                  {cat.name ||
                                    "Uncategorized"}
                                </Text>
                              </View>

                              <View
                                style={{
                                  width: 3,
                                  height: 3,
                                  borderRadius: 2,
                                  backgroundColor:
                                    "#C7CBD1",
                                  marginHorizontal: 6,
                                  flexShrink:
                                    0,
                                }}
                              />

                              <Text
                                numberOfLines={
                                  1
                                }
                                ellipsizeMode="tail"
                                style={{
                                  flex: 1,
                                  minWidth:
                                    0,
                                  color:
                                    "#9299A3",
                                  fontSize: 11,
                                  lineHeight:
                                    14,
                                  fontWeight:
                                    "600",
                                }}
                              >
                                {source?.name ||
                                  "No source"}
                              </Text>
                            </View>
                          </View>

                          <View
                            style={{
                              width: 96,
                              flexShrink:
                                0,
                              alignItems:
                                "flex-end",
                              justifyContent:
                                "center",
                            }}
                          >
                            <Text
                              numberOfLines={
                                1
                              }
                              adjustsFontSizeToFit
                              minimumFontScale={
                                0.72
                              }
                              style={{
                                width:
                                  "100%",
                                textAlign:
                                  "right",
                                fontSize: 15,
                                fontWeight:
                                  "900",
                                color:
                                  amountColor,
                                letterSpacing:
                                  -0.35,
                              }}
                            >
                              {balanceVisible
                                ? `₹${Number(
                                  r.amount ||
                                  0,
                                ).toFixed(
                                  2,
                                )}`
                                : "••••••"}
                            </Text>

                            <View
                              style={{
                                flexDirection:
                                  "row",
                                alignItems:
                                  "center",
                                justifyContent:
                                  "flex-end",
                                marginTop: 5,
                              }}
                            >
                              <MaterialCommunityIcons
                                name="calendar-month-outline"
                                size={11}
                                color="#A3A9B2"
                              />

                              <Text
                                style={{
                                  color:
                                    "#9299A3",
                                  fontSize: 10,
                                  fontWeight:
                                    "700",
                                  marginLeft: 3,
                                }}
                              >
                                {
                                  dateText
                                }
                              </Text>
                            </View>

                            <View
                              style={{
                                flexDirection:
                                  "row",
                                alignItems:
                                  "center",
                                justifyContent:
                                  "flex-end",
                                marginTop: 3,
                                minHeight: 14,
                              }}
                            >
                              {transactionType ===
                                "transfer" ? (
                                <View
                                  style={{
                                    flexDirection:
                                      "row",
                                    alignItems:
                                      "center",
                                    backgroundColor:
                                      "#F1F3F5",
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderRadius: 5,
                                  }}
                                >
                                  <MaterialCommunityIcons
                                    name="swap-horizontal"
                                    size={10}
                                    color="#718096"
                                  />

                                  <Text
                                    style={{
                                      fontSize: 7.5,
                                      fontWeight:
                                        "900",
                                      color:
                                        "#718096",
                                      marginLeft: 3,
                                      letterSpacing:
                                        0.2,
                                    }}
                                  >
                                    TRANSFER
                                  </Text>
                                </View>
                              ) : (
                                <View
                                  style={{
                                    flexDirection:
                                      "row",
                                    alignItems:
                                      "center",
                                  }}
                                >
                                  <MaterialCommunityIcons
                                    name="clock-outline"
                                    size={10}
                                    color="#A3A9B2"
                                  />

                                  <Text
                                    style={{
                                      color:
                                        "#A3A9B2",
                                      fontSize: 9,
                                      fontWeight:
                                        "600",
                                      marginLeft: 3,
                                    }}
                                  >
                                    {
                                      timeText
                                    }
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                },
              )
          ) : (
            <Text
              style={{
                color:
                  "#718078",
                paddingVertical: 8,
              }}
            >
              No recent transactions
            </Text>
          )}
        </Card>

        {/* =====================================================
            SPEND AREAS
        ===================================================== */}

        <Card>
          <View
            style={{
              flexDirection:
                "row",
              alignItems:
                "center",
              justifyContent:
                "space-between",
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                fontWeight:
                  "800",
                fontSize: 16,
                color:
                  "#2F7355",
              }}
            >
              Spend Areas
            </Text>

            {topCategories.length >
              2 && (
                <TouchableOpacity
                  activeOpacity={
                    0.7
                  }
                  onPress={() =>
                    navigation.navigate(
                      "SpendAreasDashboard",
                    )
                  }
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 10,
                    backgroundColor:
                      "#EAF5EF",
                  }}
                >
                  <Text
                    style={{
                      color:
                        "#3F8F6B",
                      fontSize: 11,
                      fontWeight:
                        "800",
                    }}
                  >
                    See all ›
                  </Text>
                </TouchableOpacity>
              )}
          </View>

          {topCategories.length ? (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate(
                  "SpendAreasDashboard",
                )
              }
            >
              <View
                style={{
                  alignItems:
                    "center",
                  marginBottom: 12,
                }}
              >
                <CategoryDonut
                  data={
                    topCategories
                  }
                  categoriesMap={
                    categoriesMap
                  }
                />
              </View>
            </TouchableOpacity>
          ) : (
            <Text
              style={{
                color:
                  "#718078",
              }}
            >
              No data
            </Text>
          )}

          {topCategories
            .slice(0, 3)
            .map((c) => {
              const cat =
                categoriesMap[
                c.category_id
                ] || {};

              const color =
                cat.color ||
                "#4B7CF3";

              const icon =
                cat.icon ||
                "tag";

              const amount =
                Number(
                  c.amount || 0,
                );

              const percent =
                totalSpend >
                  0
                  ? (amount /
                    totalSpend) *
                  100
                  : 0;

              return (
                <TouchableOpacity
                  key={
                    c.category_id
                  }
                  activeOpacity={
                    0.88
                  }
                  onPress={() =>
                    navigation.navigate(
                      "CategoriesDetails",
                      {
                        categoryId:
                          c.category_id,
                        categoryName:
                          c.category_name,
                      },
                    )
                  }
                  style={{
                    marginBottom: 10,
                    paddingVertical: 12,
                    paddingHorizontal: 10,
                    borderRadius: 16,
                    backgroundColor:
                      "#F8FCFA",
                    borderWidth: 1,
                    borderColor:
                      "#E5F1EB",
                  }}
                >
                  <View
                    style={{
                      flexDirection:
                        "row",
                      alignItems:
                        "center",
                      width: "100%",
                    }}
                  >
                    <View
                      style={{
                        width: "15%",
                        alignItems:
                          "flex-start",
                        justifyContent:
                          "center",
                      }}
                    >
                      <View
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 14,
                          backgroundColor:
                            color,
                          alignItems:
                            "center",
                          justifyContent:
                            "center",
                        }}
                      >
                        <MaterialCommunityIcons
                          name={
                            icon
                          }
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
                        numberOfLines={
                          1
                        }
                        ellipsizeMode="tail"
                        style={{
                          fontSize: 14,
                          fontWeight:
                            "800",
                          color:
                            "#2F7355",
                          marginBottom: 3,
                        }}
                      >
                        {
                          c.category_name
                        }
                      </Text>

                      <Text
                        numberOfLines={
                          1
                        }
                        style={{
                          fontSize: 11,
                          fontWeight:
                            "600",
                          color:
                            "#718078",
                          marginBottom: 7,
                        }}
                      >
                        {balanceVisible
                          ? `₹${amount.toLocaleString(
                            "en-IN",
                          )}`
                          : "••••••"}
                      </Text>

                      <View
                        style={{
                          width:
                            "100%",
                          height: 7,
                          backgroundColor:
                            "#DCEDE4",
                          borderRadius: 10,
                          overflow:
                            "hidden",
                        }}
                      >
                        <View
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(
                                0,
                                percent,
                              ),
                            )}%`,
                            height:
                              "100%",
                            backgroundColor:
                              "#3F8F6B",
                            borderRadius: 10,
                          }}
                        />
                      </View>
                    </View>

                    <View
                      style={{
                        width: "25%",
                        alignItems:
                          "flex-end",
                        justifyContent:
                          "center",
                        paddingLeft: 5,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight:
                            "900",
                          color:
                            "#3F8F6B",
                          letterSpacing:
                            -0.4,
                        }}
                      >
                        {Math.round(
                          percent,
                        )}
                        %
                      </Text>

                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight:
                            "600",
                          color:
                            "#718078",
                          marginTop: 3,
                          textAlign:
                            "right",
                        }}
                      >
                        of total spend
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
        </Card>

        {/* =====================================================
            BILLS
        ===================================================== */}

        <Card>
          <View
            style={{
              flexDirection:
                "row",
              alignItems:
                "center",
              justifyContent:
                "space-between",
              marginBottom: 14,
            }}
          >
            <View
              style={{
                flex: 1,
                minWidth: 0,
              }}
            >
              <Text
                style={{
                  fontWeight:
                    "800",
                  fontSize: 16,
                  color:
                    "#2F7355",
                }}
              >
                Bills
              </Text>

              <Text
                style={{
                  fontSize: 11,
                  color:
                    "#718078",
                  marginTop: 2,
                }}
              >
                Your monthly bill overview
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={
                0.7
              }
              onPress={() =>
                navigation.navigate(
                  "Bills",
                )
              }
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 10,
                backgroundColor:
                  "#EAF5EF",
              }}
            >
              <Text
                style={{
                  color:
                    "#3F8F6B",
                  fontSize: 11,
                  fontWeight:
                    "800",
                }}
              >
                View all ›
              </Text>
            </TouchableOpacity>
          </View>

          {billsSummary ? (
            <>
              <View
                style={{
                  backgroundColor:
                    "#F5FAF7",
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor:
                    "#E5F1EB",
                  padding: 14,
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    flexDirection:
                      "row",
                    alignItems:
                      "center",
                    justifyContent:
                      "space-between",
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        color:
                          "#718078",
                        fontWeight:
                          "600",
                        marginBottom: 3,
                      }}
                    >
                      Total this month
                    </Text>

                    <Text
                      numberOfLines={
                        1
                      }
                      adjustsFontSizeToFit
                      minimumFontScale={
                        0.7
                      }
                      style={{
                        fontSize: 22,
                        fontWeight:
                          "900",
                        color:
                          "#2F7355",
                        letterSpacing:
                          -0.5,
                      }}
                    >
                      {balanceVisible
                        ? formatCurrency(
                          billsSummary.totalThisMonth,
                        )
                        : "••••••"}
                    </Text>
                  </View>

                  <View
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 17,
                      backgroundColor:
                        "#EAF5EF",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                      marginLeft: 12,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight:
                          "900",
                        color:
                          "#3F8F6B",
                      }}
                    >
                      {
                        sortedBills.length
                      }
                    </Text>

                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight:
                          "700",
                        color:
                          "#718078",
                        marginTop: -1,
                      }}
                    >
                      bills
                    </Text>
                  </View>
                </View>
              </View>

              <View
                style={{
                  flexDirection:
                    "row",
                  marginBottom: 14,
                  gap: 7,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    backgroundColor:
                      "#F8FCFA",
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor:
                      "#E5F1EB",
                    padding: 10,
                  }}
                >
                  <View
                    style={{
                      flexDirection:
                        "row",
                      alignItems:
                        "center",
                      marginBottom: 5,
                    }}
                  >
                    <View
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 4,
                        backgroundColor:
                          "#3F8F6B",
                        marginRight: 5,
                      }}
                    />

                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight:
                          "800",
                        color:
                          "#718078",
                      }}
                    >
                      Paid
                    </Text>
                  </View>

                  <Text
                    numberOfLines={
                      1
                    }
                    adjustsFontSizeToFit
                    minimumFontScale={
                      0.7
                    }
                    style={{
                      fontSize: 12,
                      fontWeight:
                        "900",
                      color:
                        "#2F7355",
                    }}
                  >
                    {balanceVisible
                      ? formatCurrency(
                        billsSummary.totalPaid,
                      )
                      : "••••••"}
                  </Text>
                </View>

                <View
                  style={{
                    flex: 1,
                    backgroundColor:
                      "#FFF8F8",
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor:
                      "#F3DEDE",
                    padding: 10,
                  }}
                >
                  <View
                    style={{
                      flexDirection:
                        "row",
                      alignItems:
                        "center",
                      marginBottom: 5,
                    }}
                  >
                    <View
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 4,
                        backgroundColor:
                          "#E46A6A",
                        marginRight: 5,
                      }}
                    />

                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight:
                          "800",
                        color:
                          "#8B6666",
                      }}
                    >
                      Overdue
                    </Text>
                  </View>

                  <Text
                    numberOfLines={
                      1
                    }
                    adjustsFontSizeToFit
                    minimumFontScale={
                      0.7
                    }
                    style={{
                      fontSize: 12,
                      fontWeight:
                        "900",
                      color:
                        "#D85C5C",
                    }}
                  >
                    {balanceVisible
                      ? formatCurrency(
                        billsSummary.overdueAmount,
                      )
                      : "••••••"}
                  </Text>
                </View>

                <View
                  style={{
                    flex: 1,
                    backgroundColor:
                      "#FFFBF3",
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor:
                      "#F2E5C8",
                    padding: 10,
                  }}
                >
                  <View
                    style={{
                      flexDirection:
                        "row",
                      alignItems:
                        "center",
                      marginBottom: 5,
                    }}
                  >
                    <View
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 4,
                        backgroundColor:
                          "#FFB020",
                        marginRight: 5,
                      }}
                    />

                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight:
                          "800",
                        color:
                          "#887453",
                      }}
                    >
                      Next 7 days
                    </Text>
                  </View>

                  <Text
                    numberOfLines={
                      1
                    }
                    adjustsFontSizeToFit
                    minimumFontScale={
                      0.7
                    }
                    style={{
                      fontSize: 12,
                      fontWeight:
                        "900",
                      color:
                        "#D89510",
                    }}
                  >
                    {balanceVisible
                      ? formatCurrency(
                        billsSummary.upcoming7,
                      )
                      : "••••••"}
                  </Text>
                </View>
              </View>
            </>
          ) : null}

          {sortedBills.length ? (
            sortedBills
              .slice(0, 4)
              .map(
                (
                  bill,
                  index,
                ) => {
                  const display =
                    getBillDisplayStatus(
                      bill,
                    );

                  const catColor =
                    categoriesMap[
                      bill.category_id
                    ]?.color ||
                    "#3F8F6B";

                  const statusColor =
                    display?.color ||
                    (String(
                      display?.label ||
                      "",
                    )
                      .toLowerCase()
                      .includes(
                        "overdue",
                      )
                      ? "#E46A6A"
                      : String(
                        display?.label ||
                        "",
                      )
                        .toLowerCase()
                        .includes(
                          "paid",
                        )
                        ? "#3F8F6B"
                        : "#FFB020");

                  return (
                    <TouchableOpacity
                      key={
                        bill.id
                      }
                      activeOpacity={
                        0.88
                      }
                      onPress={() =>
                        navigation.navigate(
                          "Bills",
                        )
                      }
                      style={{
                        marginBottom:
                          index ===
                            Math.min(
                              sortedBills.length,
                              4,
                            ) -
                            1
                            ? 0
                            : 7,
                      }}
                    >
                      <View
                        style={{
                          flexDirection:
                            "row",
                          alignItems:
                            "center",
                          minHeight: 62,
                          paddingVertical: 9,
                          paddingHorizontal: 10,
                          borderRadius: 15,
                          backgroundColor:
                            "#FFFFFF",
                          borderWidth: 1,
                          borderColor:
                            "#E8F1EC",
                        }}
                      >
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 13,
                            backgroundColor:
                              catColor,
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            marginRight: 10,
                          }}
                        >
                          <MaterialCommunityIcons
                            name={
                              categoriesMap[
                                bill.category_id
                              ]?.icon ||
                              "credit-card-outline"
                            }
                            size={19}
                            color="#FFFFFF"
                          />
                        </View>

                        <View
                          style={{
                            flex: 1,
                            minWidth: 0,
                            justifyContent:
                              "center",
                          }}
                        >
                          <Text
                            numberOfLines={
                              1
                            }
                            ellipsizeMode="tail"
                            style={{
                              fontSize: 13,
                              fontWeight:
                                "800",
                              color:
                                "#25352D",
                            }}
                          >
                            {
                              bill.name
                            }
                          </Text>

                          <View
                            style={{
                              flexDirection:
                                "row",
                              alignItems:
                                "center",
                              marginTop: 4,
                            }}
                          >
                            <MaterialCommunityIcons
                              name="calendar-outline"
                              size={11}
                              color="#8A958F"
                            />

                            <Text
                              numberOfLines={
                                1
                              }
                              style={{
                                fontSize: 10,
                                color:
                                  "#718078",
                                fontWeight:
                                  "600",
                                marginLeft: 4,
                              }}
                            >
                              Due{" "}
                              {bill.due_date
                                ? new Date(
                                  bill.due_date,
                                ).toLocaleDateString(
                                  undefined,
                                  {
                                    day: "2-digit",
                                    month: "short",
                                  },
                                )
                                : "—"}
                            </Text>
                          </View>
                        </View>

                        <View
                          style={{
                            alignItems:
                              "flex-end",
                            justifyContent:
                              "center",
                            marginLeft: 8,
                            maxWidth: 105,
                          }}
                        >
                          <Text
                            numberOfLines={
                              1
                            }
                            adjustsFontSizeToFit
                            minimumFontScale={
                              0.7
                            }
                            style={{
                              fontSize: 13,
                              fontWeight:
                                "900",
                              color:
                                "#2F7355",
                            }}
                          >
                            {balanceVisible
                              ? formatCurrency(
                                bill.amount,
                              )
                              : "••••••"}
                          </Text>

                          <View
                            style={{
                              flexDirection:
                                "row",
                              alignItems:
                                "center",
                              marginTop: 4,
                              maxWidth:
                                "100%",
                            }}
                          >
                            <View
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: 3,
                                backgroundColor:
                                  statusColor,
                                marginRight: 4,
                              }}
                            />

                            <Text
                              numberOfLines={
                                1
                              }
                              ellipsizeMode="tail"
                              style={{
                                fontSize: 9,
                                fontWeight:
                                  "800",
                                color:
                                  statusColor,
                              }}
                            >
                              {
                                display.label
                              }
                            </Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                },
              )
          ) : (
            <View
              style={{
                alignItems: "center",
                paddingVertical: 18,
              }}
            >
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 15,
                  backgroundColor: "#EAF5EF",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 8,
                }}
              >
                <MaterialCommunityIcons
                  name="note-text-outline"
                  size={22}
                  color="#3F8F6B"
                />
              </View>

              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "800",
                  color: "#2F7355",
                }}
              >
                No bills added
              </Text>

              <Text
                style={{
                  fontSize: 10,
                  color: "#718078",
                  marginTop: 3,
                  textAlign: "center",
                }}
              >
                Your upcoming bills will appear here
              </Text>
            </View>
          )}
        </Card>
      </ScrollView>
      <BottomStatsBar
        navigation={navigation}
      />
      <FAB
        onPress={() => navigation.navigate("TransactionAdd")}
        style={{
          position: "absolute",
          bottom: 70,
          right: 20,
          zIndex: 20,
          elevation: 20,
        }}
      />
    </View>
  );
}
