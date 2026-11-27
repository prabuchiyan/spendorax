import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import {
  getCreditCards,
  deleteCreditCard,
  getCreditCardById,
} from "../services/creditCards";
import CommonBottomSheetModal from "../components/CommonBottomSheetModal";
import ResponsiveBottomSheet from "../components/ResponsiveBottomSheet";
import ContextualFAB from "../components/ContextualFAB";
import CurrencyText from "../components/CurrencyText";
import { formatAmount, formatCompactAmount } from "../utils/numberUtils";
import { useAppDispatch, useCreditCards } from "../redux/hooks";
import { setCreditCards } from "../redux/slices/creditCardSlice";
import { useBalanceVisibility } from "../context/BalanceVisibilityContext";
import { useTheme } from "../context/ThemeContext";

const SORT_MODES = [
  { key: "default", label: "Default", icon: "sort" },
  { key: "used_desc", label: "Highest Used", icon: "sort-descending" },
  { key: "limit_desc", label: "Highest Limit", icon: "cash-multiple" },
  { key: "name_asc", label: "Name A–Z", icon: "sort-alphabetical-ascending" },
];

export default function CreditCardsScreen({ navigation }) {
  const { isDarkMode, theme } = useTheme();
  const dispatch = useAppDispatch();
  const cards = useCreditCards() || [];

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState(null);
  const [actionSheetCard, setActionSheetCard] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState("default");
  const [isDeletingCard, setIsDeletingCard] = useState(false);

  const { balanceVisible, toggleBalance } = useBalanceVisibility();

  const palette = useMemo(() => {
    const primary = theme?.primary || "#4B7CF3";
    if (isDarkMode) {
      return {
        bg: theme?.bg || "#0B0F17",
        cardBg: theme?.cardBg || "#182234",
        cardBorder: theme?.cardBorder || "#334155",
        surfaceSubtle: "#1E293B",
        inputBg: "#131C2E",
        utilTrack: "#293548",
        divider: "#253248",
        textPrimary: theme?.textPrimary || "#F3F4F6",
        textSecondary: theme?.textSecondary || "#9CA3AF",
        textMuted: "#64748B",
        primary,
        primarySoft: "rgba(75, 124, 243, 0.16)",
        primaryBorder: "rgba(96, 165, 250, 0.32)",
        primaryText: "#93C5FD",
        positive: "#34D399",
        positiveBg: "rgba(16, 185, 129, 0.14)",
        warning: "#FBBF24",
        warningBg: "rgba(245, 158, 11, 0.15)",
        negative: "#F87171",
        negativeBg: "rgba(239, 68, 68, 0.14)",
        purple: "#A78BFA",
        editBg: "rgba(59, 130, 246, 0.15)",
        editBorder: "rgba(96, 165, 250, 0.28)",
        editIcon: "#60A5FA",
        deleteBg: "rgba(239, 68, 68, 0.14)",
        deleteBorder: "rgba(248, 113, 113, 0.28)",
        deleteIcon: "#F87171",
        badgeBg: "#1E293B",
        badgeText: "#CBD5E1",
      };
    }

    return {
      bg: theme?.bg || "#F8F9FF",
      cardBg: theme?.cardBg || "#FFFFFF",
      cardBorder: theme?.cardBorder || "#E2E8F0",
      surfaceSubtle: "#F8FAFC",
      inputBg: "#FFFFFF",
      utilTrack: "#E2E8F0",
      divider: "#F1F5F9",
      textPrimary: theme?.textPrimary || "#0B1C30",
      textSecondary: theme?.textSecondary || "#64748B",
      textMuted: "#94A3B8",
      primary,
      primarySoft: "#EFF4FF",
      primaryBorder: "#BFDBFE",
      primaryText: "#2563EB",
      positive: "#059669",
      positiveBg: "#ECFDF5",
      warning: "#D97706",
      warningBg: "#FEF3C7",
      negative: "#DC2626",
      negativeBg: "#FEF2F2",
      purple: "#7C3AED",
      editBg: "#EFF6FF",
      editBorder: "#DBEAFE",
      editIcon: "#2563EB",
      deleteBg: "#FEF2F2",
      deleteBorder: "#FEE2E2",
      deleteIcon: "#EF4444",
      badgeBg: "#E2E8F0",
      badgeText: "#475569",
    };
  }, [isDarkMode, theme]);

  const load = useCallback(async () => {
    try {
      const items = await getCreditCards(true);
      dispatch(setCreditCards(items || []));
    } catch (e) {
      console.warn("CreditCardsScreen load error:", e);
    }
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleDelete = async () => {
    if (confirmTargetId && !isDeletingCard) {
      try {
        setIsDeletingCard(true);
        await deleteCreditCard(confirmTargetId);
        setConfirmVisible(false);
        setConfirmTargetId(null);
        await load();
      } finally {
        setIsDeletingCard(false);
      }
    }
  };

  const totals = useMemo(() => {
    return cards.reduce(
      (acc, card) => {
        const limit = Number(card.credit_limit || 0);
        const outstanding = Number(card.outstanding || 0);
        const available = Number(
          card.available_limit ?? Math.max(0, limit - outstanding)
        );
        acc.limit += limit;
        acc.outstanding += outstanding;
        acc.available += available;
        return acc;
      },
      { limit: 0, outstanding: 0, available: 0 }
    );
  }, [cards]);

  const utilizationPercentage =
    totals.limit > 0 ? (totals.outstanding / totals.limit) * 100 : 0;

  const utilState = useMemo(() => {
    if (utilizationPercentage > 75) {
      return { label: "High Usage", color: palette.negative, bg: palette.negativeBg };
    }
    if (utilizationPercentage > 35) {
      return { label: "Moderate", color: palette.warning, bg: palette.warningBg };
    }
    return { label: "Healthy", color: palette.positive, bg: palette.positiveBg };
  }, [utilizationPercentage, palette]);

  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matched = q
      ? cards.filter((c) => {
        const haystack = [c.name, c.bank, c.network, c.last4]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      : cards;

    if (sortMode === "used_desc") {
      return [...matched].sort(
        (a, b) => Number(b.outstanding || 0) - Number(a.outstanding || 0)
      );
    }
    if (sortMode === "limit_desc") {
      return [...matched].sort(
        (a, b) => Number(b.credit_limit || 0) - Number(a.credit_limit || 0)
      );
    }
    if (sortMode === "name_asc") {
      return [...matched].sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""))
      );
    }
    return matched;
  }, [cards, searchQuery, sortMode]);

  const activeSort = SORT_MODES.find((m) => m.key === sortMode) || SORT_MODES[0];
  const cycleSortMode = () => {
    const idx = SORT_MODES.findIndex((m) => m.key === sortMode);
    setSortMode(SORT_MODES[(idx + 1) % SORT_MODES.length].key);
  };

  const openEditCard = async (cardItem) => {
    try {
      const fullCard = await getCreditCardById(cardItem.id);
      navigation.navigate("CreditCardCreate", {
        editData: { ...(fullCard || cardItem) },
      });
    } catch (e) {
      navigation.navigate("CreditCardCreate", { editData: { ...cardItem } });
    }
  };

  const listHeader = (
    <View style={styles.headerBlock}>
      {/* Adaptive Light / Dark Credit Overview Hero Card */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: palette.cardBg,
            borderColor: palette.cardBorder,
          },
          !isDarkMode && styles.cardShadowLight,
        ]}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.heroTitleGroup}>
            <View style={[styles.heroIconWrap, { backgroundColor: palette.primarySoft }]}>
              <MaterialCommunityIcons
                name="chart-donut"
                size={18}
                color={palette.primary}
              />
            </View>
            <View style={styles.heroTitleTextCol}>
              <Text style={[styles.heroEyebrow, { color: palette.textSecondary }]}>
                CREDIT OVERVIEW
              </Text>
              <Text style={[styles.heroSubMeta, { color: palette.textMuted }]}>
                {cards.length} {cards.length === 1 ? "active card" : "active cards"}
              </Text>
            </View>
          </View>

          <View style={styles.heroRightControls}>
            <View style={[styles.healthPill, { backgroundColor: utilState.bg }]}>
              <View style={[styles.healthDot, { backgroundColor: utilState.color }]} />
              <Text style={[styles.healthPillText, { color: utilState.color }]}>
                {utilState.label}
              </Text>
            </View>

            <TouchableOpacity
              onPress={toggleBalance}
              activeOpacity={0.75}
              accessibilityLabel={balanceVisible ? "Hide card balances" : "Show card balances"}
              style={[
                styles.eyeToggleBtn,
                {
                  backgroundColor: palette.surfaceSubtle,
                  borderColor: palette.cardBorder,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={balanceVisible ? "eye-outline" : "eye-off-outline"}
                size={18}
                color={palette.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Total Outstanding */}
        <Text style={[styles.outstandingLabel, { color: palette.textSecondary }]}>
          Total Outstanding
        </Text>
        <CurrencyText
          amount={totals.outstanding}
          numberOfLines={1}
          style={[styles.heroAmount, { color: palette.textPrimary }]}
        />

        {/* Utilization Bar */}
        <View style={styles.utilSection}>
          <View style={styles.utilLabelsRow}>
            <Text style={[styles.utilCaption, { color: palette.textSecondary }]}>
              Overall Utilization
            </Text>
            <Text style={[styles.utilPercent, { color: utilState.color }]}>
              {utilizationPercentage.toFixed(1)}%
            </Text>
          </View>
          <View style={[styles.utilTrack, { backgroundColor: palette.utilTrack }]}>
            <View
              style={[
                styles.utilFill,
                {
                  width: `${Math.min(utilizationPercentage, 100)}%`,
                  backgroundColor: utilState.color,
                },
              ]}
            />
          </View>
        </View>

        {/* Three Metric Sub-Tiles */}
        <View
          style={[
            styles.statsStrip,
            {
              backgroundColor: palette.surfaceSubtle,
              borderColor: palette.cardBorder,
            },
          ]}
        >
          <View style={styles.statBox}>
            <View style={styles.statHeaderRow}>
              <MaterialCommunityIcons
                name="shield-check-outline"
                size={14}
                color={palette.positive}
              />
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>
                AVAILABLE
              </Text>
            </View>
            <Text numberOfLines={1} style={[styles.statValue, { color: palette.textPrimary }]}>
              {balanceVisible ? formatCompactAmount(totals.available) : "••••"}
            </Text>
          </View>

          <View style={[styles.statDivider, { backgroundColor: palette.cardBorder }]} />

          <View style={styles.statBox}>
            <View style={styles.statHeaderRow}>
              <MaterialCommunityIcons
                name="credit-card-outline"
                size={14}
                color={palette.primary}
              />
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>
                TOTAL LIMIT
              </Text>
            </View>
            <Text numberOfLines={1} style={[styles.statValue, { color: palette.textPrimary }]}>
              {balanceVisible ? formatCompactAmount(totals.limit) : "••••"}
            </Text>
          </View>

          <View style={[styles.statDivider, { backgroundColor: palette.cardBorder }]} />

          <View style={styles.statBox}>
            <View style={styles.statHeaderRow}>
              <MaterialCommunityIcons
                name="cards-outline"
                size={14}
                color={palette.purple}
              />
              <Text style={[styles.statLabel, { color: palette.textSecondary }]}>
                CARDS
              </Text>
            </View>
            <Text numberOfLines={1} style={[styles.statValue, { color: palette.textPrimary }]}>
              {cards.length}
            </Text>
          </View>
        </View>
      </View>

      {/* Search bar when multiple cards exist */}
      {cards.length > 2 && (
        <View
          style={[
            styles.searchBarBox,
            {
              backgroundColor: palette.inputBg,
              borderColor: palette.cardBorder,
            },
            !isDarkMode && styles.cardShadowLight,
          ]}
        >
          <MaterialCommunityIcons name="magnify" size={20} color={palette.textSecondary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by card name, bank, network or last 4..."
            placeholderTextColor={palette.textMuted}
            style={[styles.searchInput, { color: palette.textPrimary }]}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="close-circle" size={18} color={palette.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Section Title & Quick Controls */}
      {cards.length > 0 && (
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleGroup}>
            <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
              Your Cards
            </Text>
            <View style={[styles.sectionCountBadge, { backgroundColor: palette.badgeBg }]}>
              <Text style={[styles.sectionCountText, { color: palette.badgeText }]}>
                {filteredCards.length}
              </Text>
            </View>
          </View>

          <View style={styles.sectionActionPills}>
            {cards.length > 1 && (
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={cycleSortMode}
                style={[
                  styles.smallPillBtn,
                  {
                    backgroundColor: sortMode !== "default" ? palette.primarySoft : palette.cardBg,
                    borderColor: sortMode !== "default" ? palette.primaryBorder : palette.cardBorder,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={activeSort.icon}
                  size={14}
                  color={sortMode !== "default" ? palette.primaryText : palette.textSecondary}
                />
                <Text
                  style={[
                    styles.smallPillText,
                    { color: sortMode !== "default" ? palette.primaryText : palette.textSecondary },
                  ]}
                >
                  {sortMode === "default" ? "Sort" : activeSort.label}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => navigation.navigate("CreditCardStatements")}
              style={[
                styles.smallPillBtn,
                {
                  backgroundColor: palette.primarySoft,
                  borderColor: palette.primaryBorder,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="file-document-outline"
                size={14}
                color={palette.primaryText}
              />
              <Text style={[styles.smallPillText, { color: palette.primaryText }]}>
                Statements
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  const renderCardItem = ({ item }) => {
    const creditLimit = Number(item.credit_limit || 0);
    const outstanding = Number(item.outstanding || 0);
    const availableCredit = Number(
      item.available_limit ?? Math.max(0, creditLimit - outstanding)
    );
    const cardUtilPct = creditLimit > 0 ? (outstanding / creditLimit) * 100 : 0;
    const cardUtilColor =
      cardUtilPct > 75
        ? palette.negative
        : cardUtilPct > 35
          ? palette.warning
          : palette.positive;
    const cardColor = item.color || palette.primary;
    const topTag = item.bank ? String(item.bank).toUpperCase() : "CREDIT CARD";

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          if (item.source_id) {
            navigation.navigate("SourcesDetails", {
              sourceId: item.source_id,
              sourceName: item.name,
            });
          }
        }}
        onLongPress={() => setActionSheetCard(item)}
        delayLongPress={260}
        style={[
          styles.cardShell,
          {
            backgroundColor: palette.cardBg,
            borderColor: palette.cardBorder,
          },
          !isDarkMode && styles.cardShadowLight,
        ]}
      >
        {/* Branded Visual Credit Card Face */}
        <View style={[styles.cardFace, { backgroundColor: cardColor }]}>
          <View style={styles.decorCircleOne} />
          <View style={styles.decorCircleTwo} />

          {/* Top Bar: Chip, Bank/Network, Hidden Actions Trigger */}
          <View style={styles.cardTopRow}>
            <View style={styles.cardBrandRow}>
              <View style={styles.emvChip}>
                <View style={styles.chipLineH} />
                <View style={styles.chipLineVLeft} />
                <View style={styles.chipLineVRight} />
              </View>
              <View style={styles.cardTopMeta}>
                <Text numberOfLines={1} style={styles.cardBankLabel}>
                  {topTag}
                </Text>
                {!!item.network && (
                  <Text numberOfLines={1} style={styles.cardNetworkText}>
                    {String(item.network).toUpperCase()}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.cardTopRight}>
              <MaterialCommunityIcons
                name="contactless-payment"
                size={21}
                color="rgba(255,255,255,0.85)"
                style={{ marginRight: 8 }}
              />
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  setActionSheetCard(item);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel={`Actions for ${item.name}`}
                style={styles.cardMoreBtn}
              >
                <MaterialCommunityIcons
                  name="dots-horizontal"
                  size={18}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Card Name & Masked Number */}
          <View style={styles.cardIdentityBlock}>
            <Text numberOfLines={2} style={styles.cardNameText}>
              {item.name}
            </Text>
            <Text style={styles.cardNumberText}>
              •••• •••• •••• {item.last4 || "••••"}
            </Text>
          </View>

          {/* Bottom Balances on Card Face */}
          <View style={styles.cardFaceFooter}>
            <View style={styles.cardBalanceColLeft}>
              <Text style={styles.cardMicroLabel}>AVAILABLE CREDIT</Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={styles.cardAvailAmount}
              >
                {balanceVisible ? `₹${formatAmount(availableCredit)}` : "••••••"}
              </Text>
            </View>

            <View style={styles.cardBalanceColRight}>
              <Text style={styles.cardMicroLabel}>USED</Text>
              <Text numberOfLines={1} style={styles.cardUsedAmount}>
                {balanceVisible ? `₹${formatAmount(outstanding)}` : "••••"}
              </Text>
            </View>
          </View>
        </View>

        {/* Integrated Theme-Adaptive Card Footer */}
        <View style={[styles.cardDetailsBar, { backgroundColor: palette.cardBg }]}>
          <View style={styles.cardUtilRow}>
            <Text style={[styles.cardUtilText, { color: palette.textSecondary }]}>
              {balanceVisible
                ? `Limit: ₹${formatAmount(creditLimit)}`
                : "Limit: ••••••"}
            </Text>
            <Text style={[styles.cardUtilPct, { color: cardUtilColor }]}>
              {cardUtilPct.toFixed(1)}% used
            </Text>
          </View>

          <View style={[styles.cardUtilTrack, { backgroundColor: palette.utilTrack }]}>
            <View
              style={[
                styles.cardUtilFill,
                {
                  width: `${Math.min(cardUtilPct, 100)}%`,
                  backgroundColor: cardUtilColor,
                },
              ]}
            />
          </View>

          <View style={[styles.cardMetaFooterRow, { borderTopColor: palette.divider }]}>
            <View style={styles.billingCycleRow}>
              <MaterialCommunityIcons
                name="calendar-check-outline"
                size={14}
                color={palette.textMuted}
              />
              <Text numberOfLines={1} style={[styles.billingCycleText, { color: palette.textSecondary }]}>
                {item.statement_day
                  ? `Bill Day ${item.statement_day}${item.due_after_days ? ` · Due +${item.due_after_days}d` : ""}`
                  : "Tap card for transactions"}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={(e) => {
                e?.stopPropagation?.();
                navigation.navigate("CreditCardStatements", {
                  sourceId: item.source_id,
                  cardId: item.id,
                });
              }}
              style={[
                styles.cardStatementBtn,
                {
                  backgroundColor: palette.surfaceSubtle,
                  borderColor: palette.cardBorder,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="file-document-outline"
                size={13}
                color={palette.primary}
              />
              <Text style={[styles.cardStatementBtnText, { color: palette.primaryText }]}>
                Statements
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <FlatList
        data={filteredCards}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={listHeader}
        contentContainerStyle={[
          styles.listContent,
          filteredCards.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={
          <View
            style={[
              styles.emptyStateCard,
              {
                backgroundColor: palette.cardBg,
                borderColor: palette.cardBorder,
              },
            ]}
          >
            <View style={[styles.emptyIconCircle, { backgroundColor: palette.surfaceSubtle }]}>
              <MaterialCommunityIcons
                name="credit-card-outline"
                size={34}
                color={palette.textMuted}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
              {searchQuery ? "No matching cards" : "No credit cards added yet"}
            </Text>
            <Text style={[styles.emptySubtitle, { color: palette.textSecondary }]}>
              {searchQuery
                ? `No card matches "${searchQuery}"`
                : "Track limits, utilization, and monthly statements cleanly in one place"}
            </Text>
            {searchQuery ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setSearchQuery("")}
                style={[
                  styles.emptyActionBtn,
                  {
                    backgroundColor: palette.primarySoft,
                    borderColor: palette.primaryBorder,
                  },
                ]}
              >
                <Text style={[styles.emptyActionText, { color: palette.primaryText }]}>
                  Clear Search
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => navigation.navigate("CreditCardCreate")}
                style={[
                  styles.emptyActionBtn,
                  {
                    backgroundColor: palette.primary,
                    borderColor: palette.primary,
                  },
                ]}
              >
                <Text style={[styles.emptyActionText, { color: "#FFFFFF" }]}>
                  + Add Credit Card
                </Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={renderCardItem}
      />

      {/* HIDDEN CARD ACTIONS SHEET */}
      <ResponsiveBottomSheet
        visible={!!actionSheetCard}
        animationType="slide"
        maxHeightRatio={0.78}
        backdropColor={isDarkMode ? "rgba(0, 0, 0, 0.72)" : "rgba(15, 23, 42, 0.55)"}
        onRequestClose={() => setActionSheetCard(null)}
        sheetStyle={[
          styles.actionSheetContainer,
          {
            backgroundColor: palette.cardBg,
            borderColor: palette.cardBorder,
          },
        ]}
      >
        {({ maxHeight }) =>
          actionSheetCard ? (() => {
            const card = actionSheetCard;
            const cardColor = card.color || palette.primary;
            const limit = Number(card.credit_limit || 0);
            const used = Number(card.outstanding || 0);
            const avail = Number(card.available_limit ?? Math.max(0, limit - used));
            const pct = limit > 0 ? (used / limit) * 100 : 0;
            const avatarBg = isDarkMode ? `${cardColor}2E` : `${cardColor}18`;

            return (
              <View style={{ maxHeight }}>
                <View
                  style={[
                    styles.sheetHandle,
                    { backgroundColor: isDarkMode ? "#475569" : "#CBD5E1" },
                  ]}
                />

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  style={{ flexGrow: 0, flexShrink: 1, maxHeight: Math.max(200, maxHeight - 36) }}
                >
                  <View style={styles.sheetHeaderRow}>
                    <View style={styles.sheetHeaderTextWrap}>
                      <Text style={[styles.sheetTitle, { color: palette.textPrimary }]}>
                        Card Actions
                      </Text>
                      <Text style={[styles.sheetSubtitle, { color: palette.textSecondary }]}>
                        Edit card details, inspect statements or archive
                      </Text>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => setActionSheetCard(null)}
                      accessibilityLabel="Close card actions"
                      style={[styles.sheetCloseBtn, { backgroundColor: palette.surfaceSubtle }]}
                    >
                      <MaterialCommunityIcons
                        name="close"
                        size={18}
                        color={palette.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Mini Card Preview Banner */}
                  <View
                    style={[
                      styles.sheetPreviewCard,
                      {
                        backgroundColor: palette.surfaceSubtle,
                        borderColor: palette.cardBorder,
                        borderLeftColor: cardColor,
                      },
                    ]}
                  >
                    <View style={[styles.sheetPreviewAvatar, { backgroundColor: avatarBg }]}>
                      <MaterialCommunityIcons
                        name="credit-card-outline"
                        size={22}
                        color={cardColor}
                      />
                    </View>
                    <View style={styles.sheetPreviewInfo}>
                      <Text numberOfLines={2} style={[styles.sheetPreviewName, { color: palette.textPrimary }]}>
                        {card.name}
                      </Text>
                      <Text numberOfLines={1} style={[styles.sheetPreviewMeta, { color: palette.textSecondary }]}>
                        •••• {card.last4 || "••••"}
                        {card.bank ? ` · ${card.bank}` : ""}
                      </Text>
                    </View>
                    <View style={styles.sheetPreviewRight}>
                      <Text numberOfLines={1} style={[styles.sheetPreviewAmount, { color: palette.positive }]}>
                        {balanceVisible ? `₹${formatAmount(avail)}` : "••••••"}
                      </Text>
                      <Text style={[styles.sheetPreviewTag, { color: palette.textSecondary }]}>
                        {pct.toFixed(0)}% USED
                      </Text>
                    </View>
                  </View>

                  {/* Two-Column Edit & Archive Action Tiles */}
                  <View style={styles.actionTilesRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        const target = card;
                        setActionSheetCard(null);
                        openEditCard(target);
                      }}
                      style={[
                        styles.actionTile,
                        {
                          backgroundColor: palette.editBg,
                          borderColor: palette.editBorder,
                        },
                      ]}
                    >
                      <View style={[styles.actionTileIcon, { backgroundColor: palette.cardBg }]}>
                        <Feather name="edit-2" size={18} color={palette.editIcon} />
                      </View>
                      <Text style={[styles.actionTileTitle, { color: palette.textPrimary }]}>
                        Edit Card
                      </Text>
                      <Text style={[styles.actionTileSub, { color: palette.textSecondary }]}>
                        Limit, cycle & color
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        const targetId = card.id;
                        setActionSheetCard(null);
                        setConfirmTargetId(targetId);
                        setConfirmVisible(true);
                      }}
                      style={[
                        styles.actionTile,
                        {
                          backgroundColor: palette.deleteBg,
                          borderColor: palette.deleteBorder,
                        },
                      ]}
                    >
                      <View style={[styles.actionTileIcon, { backgroundColor: palette.cardBg }]}>
                        <Feather name="trash-2" size={18} color={palette.deleteIcon} />
                      </View>
                      <Text style={[styles.actionTileTitle, { color: palette.deleteIcon }]}>
                        Archive Card
                      </Text>
                      <Text style={[styles.actionTileSub, { color: palette.textSecondary }]}>
                        Move to inactive
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Quick Navigation Links */}
                  <View style={styles.sheetQuickLinks}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        const target = card;
                        setActionSheetCard(null);
                        navigation.navigate("CreditCardStatements", {
                          sourceId: target.source_id,
                          cardId: target.id,
                        });
                      }}
                      style={[
                        styles.sheetLinkRow,
                        {
                          backgroundColor: palette.surfaceSubtle,
                          borderColor: palette.cardBorder,
                        },
                      ]}
                    >
                      <View style={[styles.sheetLinkIcon, { backgroundColor: palette.primarySoft }]}>
                        <MaterialCommunityIcons
                          name="file-document-multiple-outline"
                          size={18}
                          color={palette.primary}
                        />
                      </View>
                      <View style={styles.sheetLinkTextCol}>
                        <Text style={[styles.sheetLinkTitle, { color: palette.textPrimary }]}>
                          View Statements & Due Bills
                        </Text>
                        <Text style={[styles.sheetLinkSub, { color: palette.textSecondary }]}>
                          Inspect monthly billing cycles
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={18} color={palette.textMuted} />
                    </TouchableOpacity>

                    {!!card.source_id && (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          const target = card;
                          setActionSheetCard(null);
                          navigation.navigate("SourcesDetails", {
                            sourceId: target.source_id,
                            sourceName: target.name,
                          });
                        }}
                        style={[
                          styles.sheetLinkRow,
                          {
                            backgroundColor: palette.surfaceSubtle,
                            borderColor: palette.cardBorder,
                          },
                        ]}
                      >
                        <View style={[styles.sheetLinkIcon, { backgroundColor: palette.positiveBg }]}>
                          <MaterialCommunityIcons
                            name="swap-horizontal"
                            size={18}
                            color={palette.positive}
                          />
                        </View>
                        <View style={styles.sheetLinkTextCol}>
                          <Text style={[styles.sheetLinkTitle, { color: palette.textPrimary }]}>
                            View Card Transactions
                          </Text>
                          <Text style={[styles.sheetLinkSub, { color: palette.textSecondary }]}>
                            Full spend & repayment history
                          </Text>
                        </View>
                        <Feather name="chevron-right" size={18} color={palette.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                </ScrollView>
              </View>
            );
          })() : null
        }
      </ResponsiveBottomSheet>

      <CommonBottomSheetModal
        visible={confirmVisible}
        type="danger"
        title="Archive Credit Card?"
        subtitle="Are you sure you want to archive this credit card?"
        confirmLabel="Archive Card"
        cancelLabel="Keep Card"
        loading={isDeletingCard}
        warnings={[
          { title: "Card Inactive", text: "Card will be removed from your active credit card list." },
          { title: "History Preserved", text: "All past statements, bills, and transactions remain intact." },
          { title: "Cannot Be Undone", text: "Active tracking for this credit card will cease." },
        ]}
        onCancel={() => {
          if (!isDeletingCard) {
            setConfirmVisible(false);
            setConfirmTargetId(null);
          }
        }}
        onConfirm={handleDelete}
      />

      <ContextualFAB
        onPress={() => {
          navigation.navigate("CreditCardCreate");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 112,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  headerBlock: {
    marginBottom: 4,
  },
  cardShadowLight: Platform.select({
    ios: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
    },
    android: {
      elevation: 2,
    },
    default: {
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
    },
  }),

  /* Overview Hero Card */
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  heroTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  heroIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  heroTitleTextCol: {
    flex: 1,
    minWidth: 0,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  heroSubMeta: {
    fontSize: 11.5,
    fontWeight: "600",
    marginTop: 1,
  },
  heroRightControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 8,
  },
  healthPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 5,
  },
  healthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  healthPillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  eyeToggleBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  outstandingLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 3,
  },
  heroAmount: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.6,
    marginBottom: 14,
  },
  utilSection: {
    marginBottom: 14,
  },
  utilLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 7,
  },
  utilCaption: {
    fontSize: 12,
    fontWeight: "600",
  },
  utilPercent: {
    fontSize: 12.5,
    fontWeight: "800",
  },
  utilTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  utilFill: {
    height: "100%",
    borderRadius: 4,
  },
  statsStrip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 15,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 8,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },
  statHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  statDivider: {
    width: 1,
    height: 28,
  },
  statLabel: {
    fontSize: 9.5,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "900",
  },

  /* Search & Section Header */
  searchBarBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 13,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 13.5,
    fontWeight: "500",
    marginLeft: 9,
    paddingVertical: 0,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 8,
  },
  sectionTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  sectionCountBadge: {
    marginLeft: 8,
    minWidth: 24,
    height: 20,
    paddingHorizontal: 7,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionCountText: {
    fontSize: 11,
    fontWeight: "800",
  },
  sectionActionPills: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  smallPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 11,
    borderWidth: 1,
    gap: 5,
  },
  smallPillText: {
    fontSize: 11.5,
    fontWeight: "700",
  },

  /* Hybrid Credit Card */
  cardShell: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 14,
  },
  cardFace: {
    padding: 18,
    position: "relative",
    overflow: "hidden",
  },
  decorCircleOne: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    right: -60,
    top: -75,
    backgroundColor: "rgba(255,255,255,0.11)",
  },
  decorCircleTwo: {
    position: "absolute",
    width: 125,
    height: 125,
    borderRadius: 63,
    right: -25,
    bottom: -65,
    backgroundColor: "rgba(0,0,0,0.09)",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  emvChip: {
    width: 36,
    height: 26,
    borderRadius: 6,
    backgroundColor: "#E2CF8E",
    marginRight: 10,
    overflow: "hidden",
    justifyContent: "center",
    flexShrink: 0,
  },
  chipLineH: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 8,
    height: 1,
    backgroundColor: "rgba(90,70,20,0.35)",
  },
  chipLineVLeft: {
    position: "absolute",
    left: 11,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(90,70,20,0.35)",
  },
  chipLineVRight: {
    position: "absolute",
    right: 11,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(90,70,20,0.35)",
  },
  cardTopMeta: {
    flex: 1,
    minWidth: 0,
  },
  cardBankLabel: {
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.92)",
  },
  cardNetworkText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "rgba(255,255,255,0.72)",
    marginTop: 1,
  },
  cardTopRight: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
  },
  cardMoreBtn: {
    width: 32,
    height: 28,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardIdentityBlock: {
    marginTop: 16,
  },
  cardNameText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  cardNumberText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "800",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 2,
  },
  cardFaceFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 16,
    gap: 10,
  },
  cardBalanceColLeft: {
    flex: 1,
    minWidth: 0,
  },
  cardBalanceColRight: {
    alignItems: "flex-end",
    flexShrink: 0,
  },
  cardMicroLabel: {
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "rgba(255,255,255,0.72)",
    marginBottom: 2,
  },
  cardAvailAmount: {
    fontSize: 18.5,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  cardUsedAmount: {
    fontSize: 14,
    fontWeight: "800",
    color: "rgba(255,255,255,0.95)",
  },

  /* Theme-Adaptive Card Footer Strip */
  cardDetailsBar: {
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
  },
  cardUtilRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  cardUtilText: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  cardUtilPct: {
    fontSize: 11.5,
    fontWeight: "800",
  },
  cardUtilTrack: {
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
  },
  cardUtilFill: {
    height: "100%",
    borderRadius: 3,
  },
  cardMetaFooterRow: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  billingCycleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  billingCycleText: {
    fontSize: 11.5,
    fontWeight: "600",
    flexShrink: 1,
  },
  cardStatementBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
    gap: 5,
    flexShrink: 0,
  },
  cardStatementBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
  },

  /* Empty State */
  emptyStateCard: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 36,
    marginTop: 8,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  emptySubtitle: {
    fontSize: 12.5,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  emptyActionBtn: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  emptyActionText: {
    fontSize: 13,
    fontWeight: "800",
  },

  /* Card Actions Sheet */
  actionSheetContainer: {
    width: "100%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 20,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sheetHeaderTextWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  sheetSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sheetPreviewCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 14,
  },
  sheetPreviewAvatar: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sheetPreviewInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
    marginRight: 8,
  },
  sheetPreviewName: {
    fontSize: 15,
    fontWeight: "800",
  },
  sheetPreviewMeta: {
    fontSize: 11.5,
    fontWeight: "600",
    marginTop: 2,
  },
  sheetPreviewRight: {
    alignItems: "flex-end",
    flexShrink: 0,
    maxWidth: "42%",
  },
  sheetPreviewAmount: {
    fontSize: 15,
    fontWeight: "900",
  },
  sheetPreviewTag: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
    marginTop: 2,
  },
  actionTilesRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  actionTile: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: "flex-start",
  },
  actionTileIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  actionTileTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  actionTileSub: {
    fontSize: 11.5,
    fontWeight: "500",
    marginTop: 2,
  },
  sheetQuickLinks: {
    gap: 8,
  },
  sheetLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  sheetLinkIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  sheetLinkTextCol: {
    flex: 1,
    minWidth: 0,
  },
  sheetLinkTitle: {
    fontSize: 13.5,
    fontWeight: "700",
  },
  sheetLinkSub: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 1,
  },
});
