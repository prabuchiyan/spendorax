import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import CategoryDonut from "../components/CategoryDonut";
import { getHomeExpenseTransactions } from "../services/transactions";
import { getHomeBudgets as getHomeBudgetsService } from "../services/budgets";
import { getHomeCategoryBudgets as getHomeCategoryBudgetsService } from "../services/categoryBudgets";
import { getBillsForCurrentMonth, getBillsSummary, getBillSeriesMultiple } from "../services/bills";
import { getBillDisplayStatus, getPreferredBillOccurrence } from "../services/billUtils";
import { getSources } from "../services/sources";
import { getCategories } from "../services/categories";
import events from "../services/events";
import ContextualFAB from "../components/ContextualFAB";
import BottomStatsBar from "../components/BottomStatsBar";
import CurrencyText from "../components/CurrencyText";
import { useBalanceVisibility } from "../context/BalanceVisibilityContext";
import { usePageLoader } from "../context/PageLoaderContext";
import { useTheme } from "../context/ThemeContext";
import PageLoader from "../components/PageLoader";
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
import { setBills, setBillsSummary } from "../redux/slices/billSlice";
import { setCategoriesMap } from "../redux/slices/categorySlice";
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
    const transactionsModule = await import("../services/transactions");

    const balanceMap = await transactionsModule.getSourceTransactionBalances();

    const calculatedSources = sources.map((source) => {
      const sourceId = String(source.id);

      const initial = Number(source.initial_balance || 0);

      const transactionBalance = Number(balanceMap[sourceId] || 0);

      return {
        ...source,
        balance: initial + transactionBalance,
      };
    });

    // Skip credit cards from Home source balances
    return calculatedSources.filter(
      (source) => String(source?.type || "").toLowerCase() !== "credit_card",
    );
  } catch (error) {
    console.error("getHomeSourceBalances error:", error);

    return sources
      .filter(
        (source) => String(source?.type || "").toLowerCase() !== "credit_card",
      )
      .map((source) => ({
        ...source,
        balance: Number(source.initial_balance || 0),
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
    const transactions = await getHomeExpenseTransactions(new Date());

    const spendingMap = {};

    transactions.forEach((tx) => {
      if (tx.category_id === null || tx.category_id === undefined) {
        return;
      }

      const categoryId = String(tx.category_id);

      const amount = Number(tx.amount || 0);

      if (amount <= 0) {
        return;
      }

      spendingMap[categoryId] = Number(spendingMap[categoryId] || 0) + amount;
    });

    /*
     * Keep the exact data structure expected
     * by the existing Spend Areas UI.
     */
    return Object.entries(spendingMap)
      .map(([categoryId, amount]) => {
        const category =
          categoriesMap?.[categoryId] ||
          categoriesMap?.[Number(categoryId)] ||
          {};

        return {
          category_id: categoryId,

          category_name: category.name || "Uncategorized",

          amount: Number(amount || 0),
        };
      })
      .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
  } catch (error) {
    console.error("getHomeCategorySpending error:", error);

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
    console.error("getHomeBudgets error:", error);

    return [];
  }
}

/* ============================================================
   OPTIMIZED CATEGORY BUDGETS
============================================================ */

async function getHomeCategoryBudgets(categoriesMap) {
  try {
    const { year, monthNumber } = getCurrentMonthBounds();

    return await getHomeCategoryBudgetsService(
      monthNumber,
      year,
      categoriesMap,
    );
  } catch (error) {
    console.error("getHomeCategoryBudgets error:", error);

    return [];
  }
}

/* ============================================================
   OPTIMIZED OTHERS
============================================================ */

async function getHomeOtherCategorySpending(categoriesMap, categoryBudgets) {
  try {
    const transactions = await getHomeExpenseTransactions(new Date());

    const budgetedCategoryIds = new Set(
      (categoryBudgets || []).map((budget) =>
        String(budget.categoryId ?? budget.category_id),
      ),
    );

    const spendingMap = {};

    transactions.forEach((tx) => {
      if (tx.category_id === null || tx.category_id === undefined) {
        return;
      }

      const categoryId = String(tx.category_id);

      if (budgetedCategoryIds.has(categoryId)) {
        return;
      }

      const amount = Number(tx.amount || 0);

      if (amount <= 0) {
        return;
      }

      spendingMap[categoryId] = Number(spendingMap[categoryId] || 0) + amount;
    });

    return Object.entries(spendingMap).map(([categoryId, amount]) => {
      const category =
        categoriesMap?.[categoryId] ||
        categoriesMap?.[Number(categoryId)] ||
        {};

      return {
        categoryId,
        categoryName: category.name || "Uncategorized",
        icon: category.icon || "tag",
        color: category.color || "#ccc",
        amount,
      };
    });
  } catch (error) {
    console.error("getHomeOtherCategorySpending error:", error);

    return [];
  }
}

/* ============================================================
   COLORS
============================================================ */

function getBudgetProgressColor(percentage, isDarkMode = false) {
  const value = Number(percentage || 0);

  if (value > 100) {
    return isDarkMode ? "#F87171" : "#DC2626";
  }

  if (value >= 70) {
    return isDarkMode ? "#FBBF24" : "#D97706";
  }

  return isDarkMode ? "#34D399" : "#059669";
}

/* ============================================================
   BUDGET DONUT
============================================================ */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function BudgetDonut({
  limit = 0,
  spent = 0,
  remaining = 0,
  daysLeft = 0,
  balanceVisible = true,
  size = 220,
}) {
  const { visible: loaderVisible } = usePageLoader();
  const { isDarkMode, theme } = useTheme();
  const percentRaw = limit > 0 ? spent / limit : 0;

  const percent = Math.max(0, percentRaw);

  const pct = limit > 0 ? Math.min(100, Math.round(percent * 100)) : 0;

  const progressPercentage = limit > 0 ? (spent / limit) * 100 : 0;

  const color = getBudgetProgressColor(progressPercentage, isDarkMode);

  const innerColor = remaining < 0
    ? (isDarkMode ? "#F87171" : "#DC2626")
    : color;

  const strokeWidth = Math.max(16, Math.round(size * 0.09));

  const radius = (size - strokeWidth) / 2;

  const circumference = 2 * Math.PI * radius;

  const safePercent = Number.isNaN(percent) ? 0 : percent;

  const anim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!loaderVisible) {
      Animated.timing(anim, {
        toValue: Math.min(1, percent),
        duration: 1500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [percent, anim, loaderVisible]);

  const dashAnim = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  function fmt(value) {
    return `₹${Number(value || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  const [webPercent, setWebPercent] = useState(0);

  useEffect(() => {
    if (Platform.OS === "web" && !loaderVisible) {
      const timer = setTimeout(() => {
        setWebPercent(safePercent);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [safePercent, loaderVisible]);

  const webDashOffset = circumference - circumference * Math.min(1, webPercent);

  const trackColor = isDarkMode ? "#1E293B" : "#E2E8F0";

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
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
            strokeDashoffset={webDashOffset}
            rotation="-90"
            originX={size / 2}
            originY={size / 2}
            style={{
              transition:
                "stroke-dashoffset 1.5s cubic-bezier(0.215, 0.61, 0.355, 1)",
            }}
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
            strokeDashoffset={dashAnim}
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
            fontSize: Math.max(10, size * 0.058),
            fontWeight: "800",
            letterSpacing: 0.5,
            color: theme.textSecondary,
            marginBottom: 4,
          }}
        >
          {remaining >= 0 ? "SAFE TO SPEND" : "OVER BUDGET"}
        </Text>

        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={{
            fontSize: Math.max(17, size * 0.105),
            fontWeight: "900",
            color: innerColor,
            textAlign: "center",
          }}
        >
          {balanceVisible
            ? fmt(remaining >= 0 ? remaining : Math.abs(remaining))
            : "••••••"}
        </Text>

        <Text
          style={{
            fontSize: Math.max(10, size * 0.055),
            fontWeight: "700",
            color: theme.textSecondary,
            marginTop: 4,
          }}
        >
          {remaining >= 0 ? "remaining" : "overspent"}
        </Text>

        {limit > 0 && (
          <View
            style={{
              marginTop: 8,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              backgroundColor: color + "1F",
            }}
          >
            <Text
              style={{
                fontSize: Math.max(9.5, size * 0.052),
                fontWeight: "800",
                color,
              }}
            >
              {pct}% used
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

/* ============================================================
   HOME SCREEN
============================================================ */

export default function HomeScreen({ navigation }) {
  const { isDarkMode, theme } = useTheme();
  const { balanceVisible } = useBalanceVisibility();
  const insets = useSafeAreaInsets();

  const { width: screenWidth } = useWindowDimensions();

  const budgetDonutSize = Math.min(232, Math.max(186, screenWidth - 88));

  const palette = useMemo(() => {
    const primary = theme?.primary || "#4B7CF3";
    if (isDarkMode) {
      return {
        bg: theme?.bg || "#0B0F17",
        cardBg: theme?.cardBg || "#182234",
        cardBorder: theme?.cardBorder || "#334155",
        surfaceSubtle: "#1E293B",
        surfaceDeep: "#131C2E",
        textPrimary: theme?.textPrimary || "#F3F4F6",
        textSecondary: theme?.textSecondary || "#9CA3AF",
        textMuted: "#64748B",
        divider: "#253248",
        primary,
        primarySoft: "rgba(75, 124, 243, 0.16)",
        primaryBorder: "rgba(96, 165, 250, 0.35)",
        primaryText: "#93C5FD",
        positive: "#34D399",
        positiveBg: "rgba(16, 185, 129, 0.14)",
        positiveBorder: "rgba(52, 211, 153, 0.28)",
        warning: "#FBBF24",
        warningBg: "rgba(245, 158, 11, 0.14)",
        warningBorder: "rgba(251, 191, 36, 0.28)",
        negative: "#F87171",
        negativeBg: "rgba(239, 68, 68, 0.14)",
        negativeBorder: "rgba(248, 113, 113, 0.30)",
        badgeBg: "#1E293B",
        badgeText: "#CBD5E1",
        progressTrack: "#253248",
      };
    }

    return {
      bg: theme?.bg || "#F8F9FF",
      cardBg: theme?.cardBg || "#FFFFFF",
      cardBorder: theme?.cardBorder || "#E2E8F0",
      surfaceSubtle: "#F8FAFC",
      surfaceDeep: "#F1F5F9",
      textPrimary: theme?.textPrimary || "#0B1C30",
      textSecondary: theme?.textSecondary || "#64748B",
      textMuted: "#94A3B8",
      divider: "#F1F5F9",
      primary,
      primarySoft: "#EFF4FF",
      primaryBorder: "#BFDBFE",
      primaryText: "#2563EB",
      positive: "#059669",
      positiveBg: "#ECFDF5",
      positiveBorder: "#A7F3D0",
      warning: "#D97706",
      warningBg: "#FFFBEB",
      warningBorder: "#FDE68A",
      negative: "#DC2626",
      negativeBg: "#FEF2F2",
      negativeBorder: "#FECACA",
      badgeBg: "#F1F5F9",
      badgeText: "#475569",
      progressTrack: "#E2E8F0",
    };
  }, [isDarkMode, theme]);

  const { year: currentYear, monthNumber: currentMonthNumber } = getCurrentMonthBounds();
  const currentMonthPeriodLabel = `${currentYear}-${String(currentMonthNumber).padStart(2, "0")}`;

  const { visible: pageLoaderVisible, show: showPageLoader, hide: hidePageLoader } = usePageLoader();

  const dispatch = useAppDispatch();

  const topCategories = useTopCategories();

  const sources = useSources();

  const sourceBalances = useSourceBalances();

  const budgets = useBudgets();

  const selectedBudgetId = useSelectedBudgetId();

  const recentTx = useRecentTransactions();

  const categoriesMap = useCategoriesMap();

  const bills = useBills();

  const billsSummary = useBillsSummary();

  const categoryBudgets = useCategoryBudgets();

  const otherCategorySpending = useOtherCategorySpending();

  const othersExpanded = useOthersExpanded();

  const loadingRef = React.useRef(false);

  const hasLoadedRef = React.useRef(false);

  const refreshPendingRef = React.useRef(false);

  const categoriesLoadedRef = React.useRef(
    Object.keys(categoriesMap || {}).length > 0,
  );

  const sourcesLoadedRef = React.useRef(
    Array.isArray(sources) && sources.length > 0,
  );

  /* ==========================================================
     CATEGORIES
  ========================================================== */

  async function ensureCategories() {
    if (
      categoriesLoadedRef.current &&
      Object.keys(categoriesMap || {}).length > 0
    ) {
      return categoriesMap;
    }

    try {
      const cats = await getCategories(true);

      const map = {};

      (Array.isArray(cats) ? cats : []).forEach((category) => {
        map[category.id] = category;
      });

      dispatch(setCategoriesMap(map));

      categoriesLoadedRef.current = true;

      return map;
    } catch (error) {
      console.error("Home categories error:", error);

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
      const loadedSources = await getSources(true);

      const safeSources = Array.isArray(loadedSources) ? loadedSources : [];

      dispatch(setSources(safeSources));

      sourcesLoadedRef.current = true;

      return safeSources;
    } catch (error) {
      console.error("Home sources error:", error);

      dispatch(setSources([]));

      return [];
    }
  }

  /* ==========================================================
     BILLS
  ========================================================== */

  async function loadBills() {
    try {
      const now = new Date();

      const currentYear = now.getFullYear();

      const currentMonth = now.getMonth();

      const bl = await getBillsForCurrentMonth({
        sortBy: "due_date",
      });

      const allBills = Array.isArray(bl) ? bl : [];

      const templateIdsToFetch = Array.from(
        new Set(
          allBills
            .filter(
              (bill) =>
                (bill.is_recurring || bill._isRecurringSeries) &&
                !bill._isCreditCardStatement,
            )
            .map((bill) => bill._templateId || bill.parent_bill_id || bill.id),
        ),
      );

      const preferredMap = {};
      if (templateIdsToFetch.length > 0) {
        try {
          const seriesMap = await getBillSeriesMultiple(templateIdsToFetch);
          allBills.forEach((bill) => {
            if (!bill.is_recurring && !bill._isRecurringSeries) return;
            if (bill._isCreditCardStatement) return;

            const templateId = bill._templateId || bill.parent_bill_id || bill.id;
            if (seriesMap[templateId]) {
              preferredMap[String(templateId)] = getPreferredBillOccurrence(
                bill,
                seriesMap[templateId],
              );
            }
          });
        } catch (e) {
          console.warn("Home preferred bill occurrence error:", e);
        }
      }

      const displayItems = allBills.map((bill) => {
        const templateId = bill._templateId || bill.parent_bill_id || bill.id;
        const preferred = preferredMap[String(templateId)];
        if (
          preferred &&
          !bill._isCreditCardParent &&
          !bill._isCreditCardStatement
        ) {
          return {
            ...bill,
            ...preferred,
            _noDueDate: preferred._noDueDate === true || !preferred.due_date,
            _templateId: bill._templateId || templateId,
            _displayOccurrenceId: preferred.id,
            _displayOccurrence: preferred,
            _isRecurringSeries: true,
          };
        }
        return bill;
      });

      const todayStart = new Date(
        currentYear,
        currentMonth,
        now.getDate(),
        0,
        0,
        0,
        0,
      );

      const currentMonthBills = displayItems.filter((bill) => {
        if (!bill?.due_date) {
          return false;
        }

        const dueDateStr = String(bill.due_date || "").replace(" ", "T");
        const dueDate = new Date(dueDateStr);

        if (Number.isNaN(dueDate.getTime())) {
          return false;
        }

        const isThisMonth =
          dueDate.getFullYear() === currentYear &&
          dueDate.getMonth() === currentMonth;

        const dueDateOnly = new Date(
          dueDate.getFullYear(),
          dueDate.getMonth(),
          dueDate.getDate(),
          0,
          0,
          0,
          0,
        );

        const next7Days = new Date(todayStart.getTime());
        next7Days.setDate(todayStart.getDate() + 7);

        const isUpcoming7Days =
          dueDateOnly >= todayStart && dueDateOnly <= next7Days;

        const status = String(
          bill.status || bill.payment_status || "",
        ).toLowerCase();

        const isPaid =
          status === "paid" ||
          Number(bill.is_paid) === 1 ||
          Boolean(bill.is_completely_paid);
        const isSkipped = status === "skipped";

        const isOverdue = dueDateOnly < todayStart && !isPaid && !isSkipped;

        let isPaidThisMonth = false;
        if (isPaid && bill.paid_at) {
          const paidDateStr = String(bill.paid_at || "").replace(" ", "T");
          const paidDate = new Date(paidDateStr);
          if (!Number.isNaN(paidDate.getTime())) {
            isPaidThisMonth =
              paidDate.getFullYear() === currentYear &&
              paidDate.getMonth() === currentMonth;
          }
        }

        return isThisMonth || isUpcoming7Days || isOverdue || isPaidThisMonth;
      });

      // Sort pending bills first, then paid/skipped, and by due date
      currentMonthBills.sort((a, b) => {
        const statusA = String(
          a.status || a.payment_status || "",
        ).toLowerCase();
        const statusB = String(
          b.status || b.payment_status || "",
        ).toLowerCase();
        const isPaidA =
          statusA === "paid" ||
          statusA === "skipped" ||
          Number(a.is_paid) === 1 ||
          Boolean(a.is_completely_paid);
        const isPaidB =
          statusB === "paid" ||
          statusB === "skipped" ||
          Number(b.is_paid) === 1 ||
          Boolean(b.is_completely_paid);

        if (isPaidA && !isPaidB) return 1;
        if (!isPaidA && isPaidB) return -1;

        const aDueStr = String(a.due_date || "").replace(" ", "T");
        const bDueStr = String(b.due_date || "").replace(" ", "T");
        return new Date(aDueStr).getTime() - new Date(bDueStr).getTime();
      });

      const summary = await getBillsSummary();

      dispatch(setBills(currentMonthBills));

      dispatch(setBillsSummary(summary));

      return {
        bills: currentMonthBills,
        summary,
      };
    } catch (error) {
      console.error("Home bills error:", error);

      dispatch(setBills([]));

      dispatch(setBillsSummary(null));

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
      const result = await import("../services/transactions");

      const tx = await result.getTransactionsPaginated({ limit: 10, filterType: "all" });

      dispatch(setRecentTransactions(Array.isArray(tx) ? tx : []));

      return Array.isArray(tx) ? tx : [];
    } catch (error) {
      console.error("Home recent transactions error:", error);

      dispatch(setRecentTransactions([]));

      return [];
    }
  }

  /* ==========================================================
     MAIN LOAD
  ========================================================== */

  async function load({ showLoader = true, force = false } = {}) {
    if (loadingRef.current) {
      return [];
    }

    if (hasLoadedRef.current && !force) {
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
      const [loadedCategoriesMap, loadedSources] = await Promise.all([
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
        getHomeCategorySpending(loadedCategoriesMap),
        getHomeSourceBalances(loadedSources),
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

      if (Array.isArray(loadedBudgets) && loadedBudgets.length > 0) {
        loadedCategoryBudgets =
          await getHomeCategoryBudgets(loadedCategoriesMap);
      }

      dispatch(setBudgets(loadedBudgets));

      dispatch(setCategoryBudgets(loadedCategoryBudgets));

      dispatch(setTopCategories(loadedCategorySpending));

      dispatch(setSourceBalances(loadedSourceBalances));

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
        others = await getHomeOtherCategorySpending(
          loadedCategoriesMap,
          loadedCategoryBudgets,
        );
      }

      dispatch(setOtherCategorySpending(others));

      /*
       * Preserve existing selected budget behavior.
       */
      if (loadedBudgets?.length && !selectedBudgetId) {
        const firstId = String(loadedBudgets[0]?.budget?.id);

        if (firstId) {
          dispatch(setSelectedBudgetId(firstId));
        }
      }

      return loadedBudgets;
    } catch (error) {
      console.error("Home.load failed:", error);

      return [];
    } finally {
      if (showLoader) {
        const elapsed = Date.now() - startTime;
        const remainingDelay = minimumLoaderDelay - elapsed;

        if (remainingDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, remainingDelay));
        }
      }

      loadingRef.current = false;

      hasLoadedRef.current = true;

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
    showPageLoader();

    const timer = setTimeout(() => {
      (async () => {
        try {
          const bs = await load({
            showLoader: true,
            force: true,
          });

          if (mounted && bs?.length) {
            const firstId = String(bs[0]?.budget?.id);

            if (firstId) {
              dispatch(setSelectedBudgetId(firstId));
            }
          }
        } finally {
          if (mounted) hidePageLoader();
        }
      })();
    }, 300);

    return () => {
      mounted = false;
      clearTimeout(timer);
      hidePageLoader();
    };
  }, []);

  /* ==========================================================
     HOME FOCUS
  ========================================================== */

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      if (!refreshPendingRef.current) {
        return;
      }

      refreshPendingRef.current = false;

      load({
        showLoader: false,
        force: true,
      });
    });

    return unsubscribe;
  }, [navigation]);

  /* ==========================================================
     TRANSACTION CHANGES
  ========================================================== */

  useEffect(() => {
    const off = events.on("transactionsChanged", () => {
      refreshPendingRef.current = true;

      if (hasLoadedRef.current) {
        refreshPendingRef.current = false;

        load({
          showLoader: false,
          force: true,
        });
      }
    });

    return () => off();
  }, []);

  /* ==========================================================
     BILL CHANGES
  ========================================================== */

  useEffect(() => {
    const offBills = events.on("billsChanged", () => {
      refreshPendingRef.current = true;

      if (hasLoadedRef.current) {
        refreshPendingRef.current = false;

        load({
          showLoader: false,
          force: true,
        });
      }
    });

    return () => offBills();
  }, []);

  /* ==========================================================
     BUDGET CHANGES
  ========================================================== */

  useEffect(() => {
    const off = events.on("budgetsChanged", async (id) => {
      if (id) {
        dispatch(setSelectedBudgetId(String(id)));
      }

      refreshPendingRef.current = true;

      if (hasLoadedRef.current) {
        refreshPendingRef.current = false;

        const bs = await load({
          showLoader: false,
          force: true,
        });

        if (!id && bs?.length) {
          dispatch(setSelectedBudgetId(String(bs[0]?.budget?.id)));
        }
      }
    });

    return () => off();
  }, [dispatch]);

  /* ==========================================================
     DISPLAY DATA
  ========================================================== */

  const totalSpend = topCategories.reduce(
    (sum, category) => sum + Number(category.amount || 0),
    0,
  );

  const sortedBills = [...bills].sort((a, b) => {
    const statusA = String(a.status || a.payment_status || "").toLowerCase();
    const statusB = String(b.status || b.payment_status || "").toLowerCase();
    const isPaidA =
      statusA === "paid" ||
      statusA === "skipped" ||
      Number(a.is_paid) === 1 ||
      Boolean(a.is_completely_paid);
    const isPaidB =
      statusB === "paid" ||
      statusB === "skipped" ||
      Number(b.is_paid) === 1 ||
      Boolean(b.is_completely_paid);

    if (isPaidA && !isPaidB) return 1;
    if (!isPaidA && isPaidB) return -1;

    const aDueStr = String(a.due_date || 0).replace(" ", "T");
    const bDueStr = String(b.due_date || 0).replace(" ", "T");
    return new Date(aDueStr).getTime() - new Date(bDueStr).getTime();
  });

  function openBillDetail(bill) {
    if (!bill) {
      navigation.navigate("Bills");
      return;
    }

    const isStatement =
      bill._isCreditCardStatement === true ||
      (typeof bill.notes === "string" && bill.notes.startsWith("Statement "));
    const parentId = bill.parent_bill_id || bill._templateId;

    if (isStatement && parentId) {
      navigation.navigate("BillDetail", {
        billId: parentId,
        occurrenceId: bill.id,
      });
      return;
    }

    navigation.navigate("BillDetail", {
      billId: bill._templateId || bill.parent_bill_id || bill.id,
      occurrenceId:
        bill._displayOccurrenceId || (bill._isRecurringSeries ? bill.id : undefined),
    });
  }

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingHorizontal: 6,
          paddingTop: 8,
          paddingBottom: 144 + Math.max(insets?.bottom || 0, 8),
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
      >

        {/* =====================================================
            MONTHLY BUDGET
        ===================================================== */}

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: palette.cardBg,
              borderColor: palette.cardBorder,
            },
            !isDarkMode && styles.cardShadowLight,
          ]}
        >
          {budgets.length ? (
            (() => {
              const sel =
                budgets.find(
                  (item) =>
                    String(item?.budget?.id) === String(selectedBudgetId),
                ) || budgets[0];

              if (!sel || !sel.budget) {
                return null;
              }

              const limit = Number(sel.budget?.monthly_limit ?? 0);
              const spent = Number(sel?.spent ?? 0);
              const remaining = Number(sel?.remaining ?? 0);
              const daysLeft = daysRemainingInMonth();
              const percentage =
                limit > 0 ? Math.round((spent / limit) * 100) : 0;
              const statusColor = getBudgetProgressColor(percentage, isDarkMode);
              const isOverBudget = remaining < 0;
              const dailyAllowance =
                daysLeft > 0 && remaining > 0 ? remaining / daysLeft : 0;
              const statusLabel = isOverBudget
                ? "Over budget"
                : percentage >= 70
                  ? "Getting close"
                  : "On track";

              return (
                <View style={styles.fullWidthBlock}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionHeaderLeft}>
                      <View
                        style={[
                          styles.sectionIconBox,
                          { backgroundColor: statusColor + "1C" },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="chart-donut"
                          size={19}
                          color={statusColor}
                        />
                      </View>
                      <View style={styles.sectionHeaderTextCol}>
                        <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
                          Monthly Budget
                        </Text>
                        <Text style={[styles.sectionSubtitle, { color: palette.textSecondary }]}>
                          {getCurrentMonthYear()} • {daysLeft} {daysLeft === 1 ? "day" : "days"} left
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.statusBadgePill,
                        { backgroundColor: statusColor + "1C" },
                      ]}
                    >
                      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                      <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                        {statusLabel}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.donutCenterWrap}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={() =>
                        navigation.navigate("Budgets", {
                          editId: sel.budget.id,
                        })
                      }
                    >
                      <BudgetDonut
                        limit={limit}
                        spent={spent}
                        remaining={remaining}
                        daysLeft={daysLeft}
                        balanceVisible={balanceVisible}
                        size={budgetDonutSize}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.kpiRow}>
                    <View
                      style={[
                        styles.kpiTile,
                        {
                          backgroundColor: palette.surfaceSubtle,
                          borderColor: palette.cardBorder,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="wallet-outline"
                        size={17}
                        color={palette.primary}
                      />
                      <Text style={[styles.kpiLabel, { color: palette.textSecondary }]}>
                        BUDGET
                      </Text>
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                        style={[styles.kpiValue, { color: palette.textPrimary }]}
                      >
                        {balanceVisible
                          ? `₹${limit.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : "••••••"}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.kpiTile,
                        {
                          backgroundColor: palette.surfaceSubtle,
                          borderColor: palette.cardBorder,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="arrow-up-circle-outline"
                        size={17}
                        color={palette.negative}
                      />
                      <Text style={[styles.kpiLabel, { color: palette.textSecondary }]}>
                        SPENT
                      </Text>
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                        style={[styles.kpiValue, { color: palette.negative }]}
                      >
                        {balanceVisible
                          ? `₹${spent.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : "••••••"}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.kpiTile,
                        {
                          backgroundColor: isOverBudget ? palette.negativeBg : palette.positiveBg,
                          borderColor: isOverBudget ? palette.negativeBorder : palette.positiveBorder,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={
                          isOverBudget
                            ? "alert-circle-outline"
                            : "shield-check-outline"
                        }
                        size={17}
                        color={isOverBudget ? palette.negative : palette.positive}
                      />
                      <Text style={[styles.kpiLabel, { color: palette.textSecondary }]}>
                        {isOverBudget ? "OVER" : "LEFT"}
                      </Text>
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                        style={[
                          styles.kpiValue,
                          { color: isOverBudget ? palette.negative : palette.positive },
                        ]}
                      >
                        {balanceVisible
                          ? `₹${Math.abs(remaining).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : "••••••"}
                      </Text>
                    </View>
                  </View>

                  {!isOverBudget && daysLeft > 0 && (
                    <View
                      style={[
                        styles.bannerBox,
                        {
                          backgroundColor: palette.primarySoft,
                          borderColor: palette.primaryBorder,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="calendar-clock-outline"
                        size={18}
                        color={palette.primaryText}
                      />
                      <View style={styles.bannerTextCol}>
                        <Text style={[styles.bannerLabel, { color: palette.textSecondary }]}>
                          Suggested daily spending
                        </Text>
                        <Text style={[styles.bannerValue, { color: palette.primaryText }]}>
                          {balanceVisible
                            ? `₹${dailyAllowance.toLocaleString("en-IN", {
                              maximumFractionDigits: 0,
                            })} / day`
                            : "•••••• / day"}
                        </Text>
                      </View>
                      <Text style={[styles.bannerMeta, { color: palette.textSecondary }]}>
                        {daysLeft} {daysLeft === 1 ? "day" : "days"} left
                      </Text>
                    </View>
                  )}

                  {isOverBudget && (
                    <View
                      style={[
                        styles.bannerBox,
                        {
                          backgroundColor: palette.negativeBg,
                          borderColor: palette.negativeBorder,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="alert-outline"
                        size={18}
                        color={palette.negative}
                      />
                      <Text
                        style={[
                          styles.bannerWarningText,
                          { color: palette.negative },
                        ]}
                      >
                        Exceeded this month's budget by{" "}
                        {balanceVisible
                          ? `₹${Math.abs(remaining).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : "••••••"}
                        .
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() =>
                      navigation.navigate("Budgets", {
                        editId: sel.budget.id,
                      })
                    }
                    style={[
                      styles.cardFooterLink,
                      {
                        borderTopColor: palette.divider,
                      },
                    ]}
                  >
                    <Text style={[styles.cardFooterLinkText, { color: palette.primaryText }]}>
                      Manage budget
                    </Text>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={16}
                      color={palette.primaryText}
                    />
                  </TouchableOpacity>
                </View>
              );
            })()
          ) : (
            <View style={styles.emptySectionBox}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate("Budgets")}>
                <BudgetDonut
                  limit={0}
                  spent={0}
                  remaining={0}
                  daysLeft={daysRemainingInMonth()}
                  balanceVisible={balanceVisible}
                  size={budgetDonutSize}
                />
              </TouchableOpacity>

              <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
                No monthly budget set
              </Text>
              <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>
                Create a budget to track monthly spending and monitor safe daily limits here.
              </Text>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => navigation.navigate("Budgets")}
                style={[styles.emptyCtaBtn, { backgroundColor: palette.primary }]}
              >
                <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
                <Text style={styles.emptyCtaBtnText}>Create Budget</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* =====================================================
            CATEGORY BUDGETS
        ===================================================== */}

        {budgets.length > 0 && categoryBudgets.length > 0 && (
          <View
            style={[
              styles.sectionCard,
              {
                backgroundColor: palette.cardBg,
                borderColor: palette.cardBorder,
              },
              !isDarkMode && styles.cardShadowLight,
            ]}
          >
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderLeft}>
                <View style={[styles.sectionIconBox, { backgroundColor: palette.primarySoft }]}>
                  <MaterialCommunityIcons name="tag-multiple-outline" size={18} color={palette.primary} />
                </View>
                <View style={styles.sectionHeaderTextCol}>
                  <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
                    Category Budgets
                  </Text>
                  <Text style={[styles.sectionSubtitle, { color: palette.textSecondary }]}>
                    Top spending categories vs limits
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => navigation.navigate("CategoryBudgetsDashboard")}
                style={[styles.sectionPillBtn, { backgroundColor: palette.primarySoft }]}
              >
                <Text style={[styles.sectionPillBtnText, { color: palette.primaryText }]}>
                  See all ›
                </Text>
              </TouchableOpacity>
            </View>

            {[...categoryBudgets]
              .sort((a, b) => Number(b.spent || 0) - Number(a.spent || 0))
              .slice(0, 3)
              .map((budget, idx, arr) => {
                const categoryColor = budget.color || palette.primary;
                const spent = Number(budget.spent || 0);
                const budgetAmount = Number(budget.budget || 0);
                const remaining = Number(budget.remaining || 0);
                const percentage = Math.round(Number(budget.percentage || 0));
                const budgetStatusColor = getBudgetProgressColor(percentage, isDarkMode);
                const isOverBudget = percentage > 100;

                return (
                  <TouchableOpacity
                    key={budget.id}
                    activeOpacity={0.85}
                    onPress={() =>
                      navigation.navigate("CategoriesDetails", {
                        categoryId: budget.categoryId,
                        categoryName: budget.categoryName,
                      })
                    }
                    style={[
                      styles.listSubCard,
                      {
                        backgroundColor: isOverBudget ? palette.negativeBg : palette.surfaceSubtle,
                        borderColor: isOverBudget ? palette.negativeBorder : palette.cardBorder,
                        marginBottom: idx === arr.length - 1 ? 0 : 9,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.softSquircle,
                        { backgroundColor: categoryColor + "1F" },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={budget.icon || "tag-outline"}
                        size={20}
                        color={categoryColor}
                      />
                    </View>

                    <View style={styles.listSubCenterCol}>
                      <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={[
                          styles.itemTitle,
                          {
                            color: isOverBudget ? palette.negative : palette.textPrimary,
                          },
                        ]}
                      >
                        {budget.categoryName}
                      </Text>

                      <Text
                        numberOfLines={1}
                        style={[styles.itemMetaText, { color: palette.textSecondary }]}
                      >
                        {balanceVisible
                          ? `₹${spent.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} of ₹${budgetAmount.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                          : "•••••• of ••••••"}
                      </Text>

                      <View
                        style={[
                          styles.progressTrack,
                          { backgroundColor: palette.progressTrack },
                        ]}
                      >
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min(100, Math.max(0, percentage))}%`,
                              backgroundColor: budgetStatusColor,
                            },
                          ]}
                        />
                      </View>
                    </View>

                    <View style={styles.listSubRightCol}>
                      <Text style={[styles.pctText, { color: budgetStatusColor }]}>
                        {percentage}%
                      </Text>
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.75}
                        style={[
                          styles.pctSubText,
                          { color: isOverBudget ? palette.negative : palette.textSecondary },
                        ]}
                      >
                        {balanceVisible
                          ? remaining >= 0
                            ? `₹${remaining.toLocaleString("en-IN", { maximumFractionDigits: 0 })} left`
                            : `₹${Math.abs(remaining).toLocaleString("en-IN", { maximumFractionDigits: 0 })} over`
                          : "••••••"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
          </View>
        )}

        {/* =====================================================
            LATEST TRANSACTIONS
        ===================================================== */}

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: palette.cardBg,
              borderColor: palette.cardBorder,
            },
            !isDarkMode && styles.cardShadowLight,
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.sectionIconBox, { backgroundColor: palette.primarySoft }]}>
                <MaterialCommunityIcons name="swap-vertical" size={19} color={palette.primary} />
              </View>
              <View style={styles.sectionHeaderTextCol}>
                <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
                  Latest Transactions
                </Text>
                <Text style={[styles.sectionSubtitle, { color: palette.textSecondary }]}>
                  Recent activity across accounts
                </Text>
              </View>
            </View>

            {recentTx.length > 2 && (
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => navigation.navigate("Transactions")}
                style={[styles.sectionPillBtn, { backgroundColor: palette.primarySoft }]}
              >
                <Text style={[styles.sectionPillBtnText, { color: palette.primaryText }]}>
                  See all ›
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {recentTx.length ? (
            recentTx.slice(0, 3).map((r, index, arr) => {
              const cat = categoriesMap[r.category_id] || {};
              const source = sources.find((s) => s.id === r.source_id);
              const type = String(r.type || "").toLowerCase();
              const isTransfer =
                type === "transfer" || r.transfer_group_id || r.is_transfer;

              const transactionType = isTransfer
                ? "transfer"
                : type === "income"
                  ? "income"
                  : "expense";

              const toSource =
                transactionType === "transfer"
                  ? sources.find((s) => String(s.id) === String(r.toAccount))
                  : null;

              const amountColor =
                transactionType === "income"
                  ? palette.positive
                  : transactionType === "transfer"
                    ? palette.textSecondary
                    : palette.negative;

              const iconColor = cat.color || (transactionType === "transfer" ? palette.primary : amountColor);

              const transactionDate = new Date(
                String(r.date || "").replace(" ", "T"),
              );

              const dateText = transactionDate.toLocaleDateString(undefined, {
                day: "2-digit",
                month: "short",
                year: "numeric",
              });

              const timeText = transactionDate.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              });

              return (
                <TouchableOpacity
                  key={r.id}
                  activeOpacity={0.86}
                  onPress={() =>
                    navigation.navigate("TransactionAdd", {
                      isEdit: true,
                      transaction: r,
                    })
                  }
                  style={[
                    styles.txCardRow,
                    {
                      backgroundColor: palette.surfaceSubtle,
                      borderColor: palette.cardBorder,
                      marginBottom: index === arr.length - 1 ? 0 : 9,
                    },
                  ]}
                >
                  <View style={[styles.leftAccentBar, { backgroundColor: amountColor }]} />

                  <View style={styles.txInnerRow}>
                    <View
                      style={[
                        styles.softSquircleLg,
                        { backgroundColor: iconColor + "1E" },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={
                          cat.icon ||
                          (transactionType === "income"
                            ? "arrow-down-circle-outline"
                            : transactionType === "transfer"
                              ? "swap-horizontal"
                              : "arrow-up-circle-outline")
                        }
                        size={21}
                        color={iconColor}
                      />
                    </View>

                    <View style={styles.txMiddleCol}>
                      <Text
                        numberOfLines={2}
                        ellipsizeMode="tail"
                        style={[styles.txTitle, { color: palette.textPrimary }]}
                      >
                        {r.notes || cat.name || "Untitled entry"}
                      </Text>

                      <View style={styles.txMetaWrap}>
                        {transactionType === "transfer" ? (
                          <>
                            <View
                              style={[
                                styles.txCategoryBadge,
                                {
                                  backgroundColor: palette.badgeBg,
                                  borderColor: palette.cardBorder,
                                },
                              ]}
                            >
                              <Text
                                numberOfLines={1}
                                style={[
                                  styles.txCategoryBadgeText,
                                  { color: palette.badgeText },
                                ]}
                              >
                                TRANSFER
                              </Text>
                            </View>
                            <View style={styles.transferRouteWrap}>
                              <Text
                                numberOfLines={1}
                                ellipsizeMode="tail"
                                style={[styles.txSourceText, { color: palette.textSecondary }]}
                              >
                                {source?.name || "No source"}
                              </Text>
                              <MaterialCommunityIcons
                                name="arrow-right"
                                size={10}
                                color={palette.textMuted}
                                style={{ marginHorizontal: 3 }}
                              />
                              <Text
                                numberOfLines={1}
                                ellipsizeMode="tail"
                                style={[styles.txSourceText, { color: palette.textSecondary }]}
                              >
                                {toSource?.name || "No source"}
                              </Text>
                            </View>
                          </>
                        ) : (
                          <>
                            <View
                              style={[
                                styles.txCategoryBadge,
                                {
                                  backgroundColor: iconColor + "18",
                                  borderColor: iconColor + "30",
                                },
                              ]}
                            >
                              <Text
                                numberOfLines={1}
                                ellipsizeMode="tail"
                                style={[
                                  styles.txCategoryBadgeText,
                                  { color: iconColor },
                                ]}
                              >
                                {cat.name || "Uncategorized"}
                              </Text>
                            </View>
                            <Text
                              numberOfLines={1}
                              ellipsizeMode="tail"
                              style={[styles.txSourceInline, { color: palette.textSecondary }]}
                            >
                              {source?.name || "No source"}
                            </Text>
                          </>
                        )}
                      </View>
                    </View>

                    <View style={styles.txRightCol}>
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.72}
                        style={[
                          styles.txAmountText,
                          {
                            color: r.is_counted === 0 ? palette.textMuted : amountColor,
                            textDecorationLine:
                              r.is_counted === 0 ? "line-through" : "none",
                          },
                        ]}
                      >
                        {balanceVisible
                          ? `${transactionType === "income" ? "+" : transactionType === "expense" ? "-" : ""}₹${Number(r.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : "••••••"}
                      </Text>

                      {r.is_counted === 0 && (
                        <View
                          style={[
                            styles.notCountedBadge,
                            { backgroundColor: palette.badgeBg },
                          ]}
                        >
                          <Text
                            style={[
                              styles.notCountedText,
                              { color: palette.textSecondary },
                            ]}
                          >
                            {r.type === "expense" ? "NOT SPEND" : "NOT INCOME"}
                          </Text>
                        </View>
                      )}

                      <View style={styles.txDateTimeRow}>
                        <MaterialCommunityIcons
                          name="calendar-month-outline"
                          size={10.5}
                          color={palette.textMuted}
                        />
                        <Text style={[styles.txDateText, { color: palette.textSecondary }]}>
                          {dateText}
                        </Text>
                      </View>

                      <View style={styles.txDateTimeRow}>
                        <MaterialCommunityIcons
                          name={transactionType === "transfer" ? "swap-horizontal" : "clock-outline"}
                          size={10}
                          color={palette.textMuted}
                        />
                        <Text style={[styles.txTimeText, { color: palette.textMuted }]}>
                          {transactionType === "transfer" ? "Transfer" : timeText}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyInlineBox}>
              <MaterialCommunityIcons name="swap-vertical" size={24} color={palette.textMuted} />
              <Text style={[styles.emptyInlineText, { color: palette.textSecondary }]}>
                No recent transactions yet
              </Text>
            </View>
          )}
        </View>

        {/* =====================================================
            SPEND AREAS
        ===================================================== */}

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: palette.cardBg,
              borderColor: palette.cardBorder,
            },
            !isDarkMode && styles.cardShadowLight,
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.sectionIconBox, { backgroundColor: palette.primarySoft }]}>
                <MaterialCommunityIcons name="chart-pie" size={18} color={palette.primary} />
              </View>
              <View style={styles.sectionHeaderTextCol}>
                <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
                  Spend Areas
                </Text>
                <Text style={[styles.sectionSubtitle, { color: palette.textSecondary }]}>
                  Monthly expense breakdown
                </Text>
              </View>
            </View>

            {topCategories.length > 2 && (
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() =>
                  navigation.navigate("SpendAreasDashboard", {
                    mode: "monthly",
                    periodLabel: currentMonthPeriodLabel,
                  })
                }
                style={[styles.sectionPillBtn, { backgroundColor: palette.primarySoft }]}
              >
                <Text style={[styles.sectionPillBtnText, { color: palette.primaryText }]}>
                  See all ›
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {topCategories.length ? (
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() =>
                navigation.navigate("SpendAreasDashboard", {
                  mode: "monthly",
                  periodLabel: currentMonthPeriodLabel,
                })
              }
              style={styles.donutCenterWrap}
            >
              <CategoryDonut
                data={topCategories}
                categoriesMap={categoriesMap}
                balanceVisible={balanceVisible}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.emptyInlineBox}>
              <MaterialCommunityIcons name="chart-pie" size={24} color={palette.textMuted} />
              <Text style={[styles.emptyInlineText, { color: palette.textSecondary }]}>
                No expenses recorded this month
              </Text>
            </View>
          )}

          {topCategories.slice(0, 3).map((c, idx, arr) => {
            const cat = categoriesMap[c.category_id] || {};
            const color = cat.color || palette.primary;
            const icon = cat.icon || "tag";
            const amount = Number(c.amount || 0);
            const percent = totalSpend > 0 ? (amount / totalSpend) * 100 : 0;

            return (
              <TouchableOpacity
                key={c.category_id}
                activeOpacity={0.85}
                onPress={() =>
                  navigation.navigate("CategoriesDetails", {
                    categoryId: c.category_id,
                    categoryName: c.category_name,
                  })
                }
                style={[
                  styles.listSubCard,
                  {
                    backgroundColor: palette.surfaceSubtle,
                    borderColor: palette.cardBorder,
                    marginBottom: idx === arr.length - 1 ? 0 : 9,
                  },
                ]}
              >
                <View
                  style={[
                    styles.softSquircle,
                    { backgroundColor: color + "1F" },
                  ]}
                >
                  <MaterialCommunityIcons name={icon} size={20} color={color} />
                </View>

                <View style={styles.listSubCenterCol}>
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[styles.itemTitle, { color: palette.textPrimary }]}
                  >
                    {c.category_name}
                  </Text>

                  <Text
                    numberOfLines={1}
                    style={[styles.itemMetaText, { color: palette.textSecondary }]}
                  >
                    {balanceVisible
                      ? `₹${amount.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                      : "••••••"}
                  </Text>

                  <View
                    style={[
                      styles.progressTrack,
                      { backgroundColor: palette.progressTrack },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(100, Math.max(0, percent))}%`,
                          backgroundColor: color,
                        },
                      ]}
                    />
                  </View>
                </View>

                <View style={styles.listSubRightCol}>
                  <Text style={[styles.pctText, { color: color }]}>
                    {Math.round(percent)}%
                  </Text>
                  <Text style={[styles.pctSubText, { color: palette.textSecondary }]}>
                    of spend
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* =====================================================
            BILLS
        ===================================================== */}

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: palette.cardBg,
              borderColor: palette.cardBorder,
            },
            !isDarkMode && styles.cardShadowLight,
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <View style={[styles.sectionIconBox, { backgroundColor: palette.primarySoft }]}>
                <MaterialCommunityIcons name="receipt" size={18} color={palette.primary} />
              </View>
              <View style={styles.sectionHeaderTextCol}>
                <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
                  Bills
                </Text>
                <Text style={[styles.sectionSubtitle, { color: palette.textSecondary }]}>
                  Your monthly bill overview
                </Text>
              </View>
            </View>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => navigation.navigate("Bills")}
              style={[styles.sectionPillBtn, { backgroundColor: palette.primarySoft }]}
            >
              <Text style={[styles.sectionPillBtnText, { color: palette.primaryText }]}>
                View all ›
              </Text>
            </TouchableOpacity>
          </View>

          {billsSummary ? (
            (() => {
              const totalMonth = Number(billsSummary.totalThisMonth || 0);
              const totalPaid = Number(billsSummary.totalPaid || 0);
              const overdueAmt = Number(billsSummary.overdueAmount || 0);
              const overdueCnt = Number(billsSummary.overdueCount || 0);
              const dueMonthCnt = Number(billsSummary.dueThisMonthCount || 0);
              const paidPct = totalMonth > 0 ? Math.min(100, Math.round((totalPaid / totalMonth) * 100)) : 0;

              let heroBadge = {
                text: `${sortedBills.length} ${sortedBills.length === 1 ? "bill" : "bills"}`,
                color: palette.primaryText,
                bg: palette.primarySoft,
              };
              if (overdueCnt > 0 || overdueAmt > 0) {
                heroBadge = {
                  text: `${overdueCnt || 1} Overdue`,
                  color: palette.negative,
                  bg: palette.negativeBg,
                };
              } else if (dueMonthCnt > 0) {
                heroBadge = {
                  text: `${paidPct}% Settled`,
                  color: paidPct >= 70 ? palette.positive : palette.warning,
                  bg: paidPct >= 70 ? palette.positiveBg : palette.warningBg,
                };
              }

              return (
                <>
                  <View
                    style={[
                      styles.billsHeroSubCard,
                      {
                        backgroundColor: palette.surfaceSubtle,
                        borderColor: palette.cardBorder,
                      },
                    ]}
                  >
                    <View style={styles.billsHeroTopRow}>
                      <View style={styles.billsHeroLeft}>
                        <Text style={[styles.billsHeroEyebrow, { color: palette.textSecondary }]}>
                          TOTAL THIS MONTH
                        </Text>
                        <Text
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.7}
                          style={[styles.billsHeroAmount, { color: palette.textPrimary }]}
                        >
                          {balanceVisible
                            ? <CurrencyText amount={billsSummary.totalThisMonth} />
                            : "••••••"}
                        </Text>
                      </View>

                      <View style={styles.billsHeroRightBadges}>
                        <View style={[styles.statusBadgePill, { backgroundColor: heroBadge.bg }]}>
                          <View style={[styles.statusDot, { backgroundColor: heroBadge.color }]} />
                          <Text style={[styles.statusBadgeText, { color: heroBadge.color }]}>
                            {heroBadge.text}
                          </Text>
                        </View>
                        <Text style={[styles.billsCountMeta, { color: palette.textSecondary }]}>
                          {sortedBills.length} {sortedBills.length === 1 ? "bill" : "bills"} listed
                        </Text>
                      </View>
                    </View>

                    {totalMonth > 0 && (
                      <View style={styles.billsProgressWrap}>
                        <View
                          style={[
                            styles.progressTrack,
                            { backgroundColor: palette.progressTrack },
                          ]}
                        >
                          <View
                            style={[
                              styles.progressFill,
                              {
                                width: `${paidPct}%`,
                                backgroundColor: palette.positive,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    )}
                  </View>

                  <View style={styles.billsKpiGrid}>
                    <View
                      style={[
                        styles.billMetricBox,
                        {
                          backgroundColor: palette.positiveBg,
                          borderColor: palette.positiveBorder,
                        },
                      ]}
                    >
                      <View style={styles.billMetricLabelRow}>
                        <View style={[styles.billMetricDot, { backgroundColor: palette.positive }]} />
                        <Text style={[styles.billMetricLabel, { color: palette.textSecondary }]}>
                          PAID
                        </Text>
                      </View>
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.72}
                        style={[styles.billMetricValue, { color: palette.positive }]}
                      >
                        {balanceVisible
                          ? <CurrencyText amount={billsSummary.totalPaid} />
                          : "••••••"}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.billMetricBox,
                        {
                          backgroundColor: palette.negativeBg,
                          borderColor: palette.negativeBorder,
                        },
                      ]}
                    >
                      <View style={styles.billMetricLabelRow}>
                        <View style={[styles.billMetricDot, { backgroundColor: palette.negative }]} />
                        <Text style={[styles.billMetricLabel, { color: palette.textSecondary }]}>
                          OVERDUE
                        </Text>
                      </View>
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.72}
                        style={[styles.billMetricValue, { color: palette.negative }]}
                      >
                        {balanceVisible
                          ? <CurrencyText amount={billsSummary.overdueAmount} />
                          : "••••••"}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.billMetricBox,
                        {
                          backgroundColor: palette.warningBg,
                          borderColor: palette.warningBorder,
                        },
                      ]}
                    >
                      <View style={styles.billMetricLabelRow}>
                        <View style={[styles.billMetricDot, { backgroundColor: palette.warning }]} />
                        <Text style={[styles.billMetricLabel, { color: palette.textSecondary }]}>
                          NEXT 7D
                        </Text>
                      </View>
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.72}
                        style={[styles.billMetricValue, { color: palette.warning }]}
                      >
                        {balanceVisible
                          ? <CurrencyText amount={billsSummary.upcoming7} />
                          : "••••••"}
                      </Text>
                    </View>
                  </View>
                </>
              );
            })()
          ) : null}

          {sortedBills.length ? (
            sortedBills.slice(0, 4).map((bill, index, arr) => {
              const display = getBillDisplayStatus(bill);
              const labelLower = String(display?.label || "").toLowerCase();
              const isOverdue = labelLower.includes("overdue");
              const isPaid = labelLower.includes("paid");

              const statusColor = isOverdue
                ? palette.negative
                : isPaid
                  ? palette.positive
                  : palette.warning;
              const statusBg = isOverdue
                ? palette.negativeBg
                : isPaid
                  ? palette.positiveBg
                  : palette.warningBg;

              const catColor =
                categoriesMap[bill.category_id]?.color || palette.primary;

              return (
                <TouchableOpacity
                  key={bill.id}
                  activeOpacity={0.86}
                  onPress={() => openBillDetail(bill)}
                  style={[
                    styles.billRowCard,
                    {
                      backgroundColor: palette.surfaceSubtle,
                      borderColor: palette.cardBorder,
                      marginBottom: index === arr.length - 1 ? 0 : 9,
                    },
                  ]}
                >
                  <View style={[styles.leftAccentBar, { backgroundColor: statusColor }]} />

                  <View style={styles.billRowInner}>
                    <View
                      style={[
                        styles.softSquircle,
                        { backgroundColor: catColor + "1F" },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={
                          categoriesMap[bill.category_id]?.icon ||
                          "credit-card-outline"
                        }
                        size={19}
                        color={catColor}
                      />
                    </View>

                    <View style={styles.billMiddleCol}>
                      <Text
                        numberOfLines={2}
                        ellipsizeMode="tail"
                        style={[styles.billTitleText, { color: palette.textPrimary }]}
                      >
                        {bill.name}
                      </Text>

                      <View style={styles.billDueRow}>
                        <MaterialCommunityIcons
                          name="calendar-outline"
                          size={11.5}
                          color={palette.textMuted}
                        />
                        <Text
                          numberOfLines={1}
                          style={[styles.billDueText, { color: palette.textSecondary }]}
                        >
                          {bill._noDueDate
                            ? "No due date"
                            : `Due ${bill.due_date
                              ? new Date(
                                String(bill.due_date || "").replace(
                                  " ",
                                  "T",
                                ),
                              ).toLocaleDateString(undefined, {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                              : "—"
                            }`}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.billRightCol}>
                      <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.72}
                        style={[styles.billAmountText, { color: palette.textPrimary }]}
                      >
                        {balanceVisible
                          ? <CurrencyText amount={bill.amount} />
                          : "••••••"}
                      </Text>

                      <View
                        style={[
                          styles.billStatusPill,
                          { backgroundColor: statusBg },
                        ]}
                      >
                        <View style={[styles.statusDotSm, { backgroundColor: statusColor }]} />
                        <Text
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          style={[styles.billStatusText, { color: statusColor }]}
                        >
                          {display.label}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptySectionBox}>
              <View
                style={[
                  styles.emptyIconCircle,
                  { backgroundColor: palette.primarySoft },
                ]}
              >
                <MaterialCommunityIcons
                  name="note-text-outline"
                  size={22}
                  color={palette.primary}
                />
              </View>
              <Text style={[styles.emptyInlineTitle, { color: palette.textPrimary }]}>
                No bills added
              </Text>
              <Text style={[styles.emptyInlineSub, { color: palette.textSecondary }]}>
                Your upcoming and monthly recurring bills will appear here.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <BottomStatsBar navigation={navigation} />

      <ContextualFAB
        icon="plus"
        fabStyle={{
          backgroundColor: palette.primary,
          shadowColor: palette.primary,
        }}
        actions={[
          {
            icon: "arrow-down",
            label: "Expense",
            color: "#EF4444",
            onPress: () => navigation.navigate("TransactionAdd", { initialType: "expense" }),
          },
          {
            icon: "arrow-up",
            label: "Income",
            color: "#10B981",
            onPress: () => navigation.navigate("TransactionAdd", { initialType: "income" }),
          },
          {
            icon: "swap-horizontal",
            label: "Transfer",
            color: "#4B7CF3",
            onPress: () => navigation.navigate("TransactionAdd", { initialType: "transfer" }),
          },
        ]}
        style={{
          position: "absolute",
          bottom: 68 + Math.max(insets?.bottom || 0, 8),
          right: 16,
          zIndex: 20,
          elevation: 20,
        }}
      />

      <PageLoader visible={pageLoaderVisible} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  cardShadowLight: {
    ...(Platform.OS !== "web"
      ? {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 2,
      }
      : {}),
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 13,
    marginBottom: 10,
  },
  fullWidthBlock: {
    width: "100%",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 8,
  },
  sectionHeaderLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeaderTextCol: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 11.5,
    fontWeight: "500",
    marginTop: 1,
  },
  sectionPillBtn: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  sectionPillBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  statusBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusDotSm: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  donutCenterWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  kpiTile: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  kpiLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.4,
    marginTop: 5,
  },
  kpiValue: {
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },
  bannerBox: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 13,
    borderWidth: 1,
    gap: 8,
  },
  bannerTextCol: {
    flex: 1,
  },
  bannerLabel: {
    fontSize: 10.5,
    fontWeight: "600",
  },
  bannerValue: {
    fontSize: 13.5,
    fontWeight: "800",
    marginTop: 1,
  },
  bannerMeta: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  bannerWarningText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: "700",
  },
  cardFooterLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 2,
  },
  cardFooterLinkText: {
    fontSize: 12,
    fontWeight: "800",
  },
  emptySectionBox: {
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 12,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
    lineHeight: 17,
    maxWidth: 300,
  },
  emptyCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 14,
    gap: 6,
  },
  emptyCtaBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  listSubCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 11,
    borderRadius: 15,
    borderWidth: 1,
    gap: 11,
  },
  softSquircle: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  softSquircleLg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  listSubCenterCol: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 2,
  },
  itemMetaText: {
    fontSize: 11.5,
    fontWeight: "600",
    marginBottom: 7,
  },
  progressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  listSubRightCol: {
    alignItems: "flex-end",
    justifyContent: "center",
    flexShrink: 0,
    paddingLeft: 4,
  },
  pctText: {
    fontSize: 17,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.3,
  },
  pctSubText: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  txCardRow: {
    borderRadius: 15,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  leftAccentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3.5,
  },
  txInnerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 13,
    paddingRight: 12,
    paddingVertical: 11,
    gap: 11,
  },
  txMiddleCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  txTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    marginBottom: 5,
  },
  txMetaWrap: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
    gap: 6,
  },
  txCategoryBadge: {
    flexShrink: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderWidth: 1,
  },
  txCategoryBadgeText: {
    fontSize: 10.5,
    fontWeight: "800",
  },
  transferRouteWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  txSourceText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "600",
  },
  txSourceInline: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontWeight: "600",
  },
  txRightCol: {
    alignItems: "flex-end",
    justifyContent: "center",
    flexShrink: 0,
    maxWidth: 116,
  },
  txAmountText: {
    fontSize: 14.5,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.3,
  },
  notCountedBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    marginTop: 2,
  },
  notCountedText: {
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  txDateTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 3,
  },
  txDateText: {
    fontSize: 10,
    fontWeight: "600",
  },
  txTimeText: {
    fontSize: 9.5,
    fontWeight: "600",
  },
  emptyInlineBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 8,
  },
  emptyInlineText: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  billsHeroSubCard: {
    borderRadius: 15,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  billsHeroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  billsHeroLeft: {
    flex: 1,
    minWidth: 0,
  },
  billsHeroEyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  billsHeroAmount: {
    fontSize: 22,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.5,
  },
  billsHeroRightBadges: {
    alignItems: "flex-end",
    gap: 5,
  },
  billsCountMeta: {
    fontSize: 10.5,
    fontWeight: "600",
  },
  billsProgressWrap: {
    marginTop: 12,
  },
  billsKpiGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  billMetricBox: {
    flex: 1,
    borderRadius: 13,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 9,
  },
  billMetricLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  billMetricDot: {
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
  },
  billMetricLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.35,
  },
  billMetricValue: {
    fontSize: 12.5,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  billRowCard: {
    borderRadius: 15,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  billRowInner: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 66,
    paddingLeft: 13,
    paddingRight: 11,
    paddingVertical: 10,
    gap: 10,
  },
  billMiddleCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  billTitleText: {
    fontSize: 13.5,
    fontWeight: "800",
    lineHeight: 18,
  },
  billDueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  billDueText: {
    fontSize: 11,
    fontWeight: "600",
  },
  billRightCol: {
    alignItems: "flex-end",
    justifyContent: "center",
    flexShrink: 0,
    maxWidth: 122,
    gap: 4,
  },
  billAmountText: {
    fontSize: 14,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  billStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 4,
    maxWidth: "100%",
  },
  billStatusText: {
    fontSize: 9.5,
    fontWeight: "800",
  },
  emptyIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyInlineTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  emptyInlineSub: {
    fontSize: 11.5,
    textAlign: "center",
    marginTop: 3,
  },
});