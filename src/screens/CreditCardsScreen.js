import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getCreditCards, deleteCreditCard } from "../services/creditCards";
import Card from "../components/Card";
import ConfirmDialog from "../components/ConfirmDialog";
import CreditCardCreateModal from "../components/CreditCardCreateModal";
import ContextualFAB from "../components/ContextualFAB";
import { Colors, Spacing } from "../components/Theme";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import {
  createCreditCard,
  updateCreditCard,
  getCreditCardById,
} from "../services/creditCards";
import { useAppDispatch, useCreditCards } from "../redux/hooks";
import { setCreditCards } from "../redux/slices/creditCardSlice";
import { useBalanceVisibility } from "../context/BalanceVisibilityContext";

export default function CreditCardsScreen({ navigation }) {
  const dispatch = useAppDispatch();
  const cards = useCreditCards() || [];
  const [showModal, setShowModal] = useState(false);
  const [editCard, setEditCard] = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState(null);
  const { balanceVisible } = useBalanceVisibility();

  const load = async () => {
    const items = await getCreditCards(true);
    dispatch(setCreditCards(items));
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, []),
  );

  const handleDelete = async () => {
    await deleteCreditCard(confirmTargetId);
    setConfirmVisible(false);
    setConfirmTargetId(null);
    load();
  };

  const totals = cards.reduce(
    (acc, card) => {
      acc.limit += Number(card.credit_limit || 0);
      acc.outstanding += Number(card.outstanding || 0);
      acc.available += Number(card.available_limit || 0);
      return acc;
    },
    { limit: 0, outstanding: 0, available: 0 },
  );

  const utilizationPercentage =
    totals.limit > 0 ? (totals.outstanding / totals.limit) * 100 : 0;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* DASHBOARD OVERVIEW */}
      <View style={styles.overviewContainer}>
        <View style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <View style={styles.overviewIconWrap}>
              <MaterialCommunityIcons
                name="chart-donut"
                size={20}
                color={Colors.primary}
              />
            </View>
            <Text style={styles.overviewTitle}>Credit Overview</Text>
          </View>

          <View style={styles.mainBalanceArea}>
            <Text style={styles.mainBalanceLabel}>Total Outstanding</Text>
            <Text style={styles.mainBalanceValue}>
              {balanceVisible
                ? `₹ ${totals.outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                : "••••••"}
            </Text>
          </View>

          {/* Utilization Bar */}
          <View style={styles.utilizationSection}>
            <View style={styles.utilizationLabels}>
              <Text style={styles.utilText}>Utilization</Text>
              <Text
                style={[
                  styles.utilText,
                  {
                    color: utilizationPercentage > 80 ? "#DC2626" : Colors.text,
                    fontWeight: "700",
                  },
                ]}
              >
                {utilizationPercentage.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.utilBarTrack}>
              <View
                style={[
                  styles.utilBarFill,
                  {
                    width: `${Math.min(utilizationPercentage, 100)}%`,
                    backgroundColor:
                      utilizationPercentage > 80
                        ? "#DC2626"
                        : utilizationPercentage > 50
                          ? "#F59E0B"
                          : "#22C55E",
                  },
                ]}
              />
            </View>
          </View>

          {/* Stats Row */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <MaterialCommunityIcons
                name="shield-check-outline"
                size={18}
                color="#22C55E"
                style={{ marginBottom: 4 }}
              />
              <Text style={styles.statLabel}>Available Limit</Text>
              <Text style={styles.statValue}>
                {balanceVisible
                  ? `₹${totals.available.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                  : "••••"}
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <MaterialCommunityIcons
                name="credit-card-outline"
                size={18}
                color={Colors.primary}
                style={{ marginBottom: 4 }}
              />
              <Text style={styles.statLabel}>Total Limit</Text>
              <Text style={styles.statValue}>
                {balanceVisible
                  ? `₹${totals.limit.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                  : "••••"}
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <MaterialCommunityIcons
                name="cards-outline"
                size={18}
                color="#8B5CF6"
                style={{ marginBottom: 4 }}
              />
              <Text style={styles.statLabel}>Active Cards</Text>
              <Text style={styles.statValue}>{cards.length}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your Cards</Text>
      </View>

      <FlatList
        data={cards}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: Spacing.s, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="credit-card-outline"
              size={48}
              color="#ccc"
            />
            <Text style={styles.emptyText}>No credit cards added yet</Text>
          </View>
        }
        renderItem={({ item }) => {
          const creditLimit = Number(item.credit_limit || 0);
          const outstanding = Number(item.outstanding || 0);
          const availableCredit = Number(
            item.available_limit ?? Math.max(0, creditLimit - outstanding),
          );
          const sourceColor = item.color || Colors.primary;

          return (
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => {
                if (item.source_id) {
                  navigation.navigate("SourcesDetails", {
                    sourceId: item.source_id,
                    sourceName: item.name,
                  });
                }
              }}
              style={styles.creditCardBoard}
            >
              <View
                style={[
                  styles.creditCardGradient,
                  { backgroundColor: sourceColor },
                ]}
              >
                {/* DECORATIVE CIRCLES */}
                <View style={styles.cardDecorCircleOne} />
                <View style={styles.cardDecorCircleTwo} />

                {/* TOP */}
                <View style={styles.creditCardTop}>
                  <View style={styles.creditCardBrandRow}>
                    {/* CHIP */}
                    <View style={styles.creditCardChip}>
                      <View style={styles.chipLineOne} />
                      <View style={styles.chipLineTwo} />
                      <View style={styles.chipLineThree} />
                    </View>
                    <Text numberOfLines={1} style={styles.creditCardType}>
                      CREDIT CARD
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="contactless-payment"
                    size={23}
                    color="rgba(255,255,255,0.86)"
                  />
                </View>

                {/* CARD INFORMATION */}
                <View style={styles.creditCardMiddle}>
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={styles.creditCardName}
                  >
                    {item.name}
                  </Text>
                  <Text style={styles.creditCardNumber}>
                    •••• •••• •••• {item.last4 || "••••"}
                  </Text>
                </View>

                {/* BOTTOM */}
                <View style={styles.creditCardBottom}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.creditCardLabel}>AVAILABLE CREDIT</Text>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.72}
                      style={styles.creditCardAmount}
                    >
                      {balanceVisible
                        ? `₹ ${availableCredit.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                        : "••••••"}
                    </Text>
                    <Text style={styles.creditCardUsedText}>
                      {balanceVisible
                        ? `₹ ${outstanding.toLocaleString("en-IN", { maximumFractionDigits: 2 })} used of ₹ ${creditLimit.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
                        : "••••••"}
                    </Text>
                  </View>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      onPress={async () => {
                        const card = await getCreditCardById(item.id);
                        setEditCard({ ...card });
                        setShowModal(true);
                      }}
                      style={styles.cardIconButton}
                    >
                      <Feather name="edit-2" size={16} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setConfirmTargetId(item.id);
                        setConfirmVisible(true);
                      }}
                      style={styles.cardIconButton}
                    >
                      <Feather name="trash-2" size={16} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <ConfirmDialog
        visible={confirmVisible}
        title="Delete Credit Card"
        message="Archive this credit card? Transactions will remain intact."
        onCancel={() => setConfirmVisible(false)}
        onConfirm={handleDelete}
      />

      <CreditCardCreateModal
        key={editCard ? `edit-${editCard.id}` : "new"}
        visible={showModal}
        onClose={() => {
          setShowModal(false);
          setEditCard(null);
        }}
        editData={editCard}
        onSave={async (payload) => {
          if (editCard) {
            await updateCreditCard(editCard.id, payload);
          } else {
            await createCreditCard(payload);
          }
          load();
        }}
      />

      <ContextualFAB
        onPress={() => {
          setEditCard(null);
          setShowModal(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overviewContainer: {
    padding: Spacing.m,
    paddingTop: Spacing.s,
  },
  overviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  overviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  overviewIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#EEF3FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  overviewTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.muted,
  },
  mainBalanceArea: {
    marginBottom: 20,
  },
  mainBalanceLabel: {
    fontSize: 13,
    color: Colors.muted,
    marginBottom: 6,
    fontWeight: "600",
  },
  mainBalanceValue: {
    fontSize: 34,
    fontWeight: "900",
    color: Colors.text,
    letterSpacing: -1,
  },
  utilizationSection: {
    marginBottom: 24,
  },
  utilizationLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  utilText: {
    fontSize: 12,
    color: Colors.muted,
    fontWeight: "600",
  },
  utilBarTrack: {
    height: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 4,
    overflow: "hidden",
  },
  utilBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#E5E7EB",
  },
  statLabel: {
    fontSize: 10,
    color: Colors.muted,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.text,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.m,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.text,
  },
  emptyText: {
    color: Colors.muted,
    marginTop: 10,
    fontSize: 14,
  },
  creditCardBoard: {
    marginBottom: 16,
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 7,
    },
    elevation: 5,
  },
  creditCardGradient: {
    minHeight: 205,
    padding: 20,
    position: "relative",
    overflow: "hidden",
    justifyContent: "space-between",
  },
  cardDecorCircleOne: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    right: -65,
    top: -75,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  cardDecorCircleTwo: {
    position: "absolute",
    width: 125,
    height: 125,
    borderRadius: 63,
    right: -30,
    bottom: -65,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  creditCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  creditCardBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  creditCardChip: {
    width: 39,
    height: 29,
    borderRadius: 6,
    backgroundColor: "#D8C889",
    marginRight: 10,
    overflow: "hidden",
    justifyContent: "center",
  },
  chipLineOne: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 9,
    height: 1,
    backgroundColor: "rgba(90,70,20,0.35)",
  },
  chipLineTwo: {
    position: "absolute",
    left: 12,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(90,70,20,0.35)",
  },
  chipLineThree: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(90,70,20,0.35)",
  },
  creditCardType: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.88)",
  },
  creditCardMiddle: {
    marginTop: 20,
  },
  creditCardName: {
    fontSize: 18,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  creditCardNumber: {
    marginTop: 13,
    fontSize: 15,
    fontWeight: "800",
    color: "rgba(255,255,255,0.82)",
    letterSpacing: 2.2,
  },
  creditCardBottom: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 18,
  },
  creditCardLabel: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "rgba(255,255,255,0.68)",
    marginBottom: 3,
  },
  creditCardAmount: {
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: -0.35,
    color: "#FFFFFF",
  },
  creditCardUsedText: {
    marginTop: 3,
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255,255,255,0.68)",
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
});
