import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { formatCompactAmount } from '../utils/numberUtils';
import { Colors } from './Theme';

const BAR_TRACK_HEIGHT = 100;

const hexToRgb = (hex) => {
  if (!hex || typeof hex !== 'string') return null;
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) cleanHex = cleanHex.split('').map(c => c + c).join('');
  if (cleanHex.length !== 6) return null;
  const num = parseInt(cleanHex, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
};

const getPremiumBarColor = (baseColor, index, total, opacity = 1) => {
  return baseColor || '#dce9ff';
};

export default function PremiumRoundedBarChart({
  labels = [],
  ids = [],
  values = [],
  dueValues = [],
  paidValues = [],
  width,
  height = 150,
  baseColor,
  onBarPress,
  selectedLabel,
  isEmpty = false,
}) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (isEmpty || !selectedLabel || !scrollRef.current) return;

    const index = labels.findIndex(l => l === selectedLabel);
    if (index < 0) return;

    const itemWidth = Math.min(52, Math.max(38, width / 5));
    const centerOffset = width / 2 - itemWidth / 2;
    const chartInnerWidth = Math.max(width, labels.length * itemWidth);
    const x = Math.max(0, Math.min(index * itemWidth - centerOffset, chartInnerWidth - width));

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x, animated: true });
    });
  }, [selectedLabel, labels, width, isEmpty]);

  if (isEmpty) {
    return (
      <View style={[styles.emptyChartArea, { width, height }]}>
        <Text style={styles.emptyChartText}>No data yet</Text>
      </View>
    );
  }

  const itemWidth = Math.min(52, Math.max(38, width / 5));
  const chartInnerWidth = Math.max(width, labels.length * itemWidth);
  const finalDue = dueValues.length > 0 ? dueValues : values;
  const finalPaid = paidValues.length > 0 ? paidValues : values;
  const maxValue = Math.max(...finalDue, 1);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 8 }}
    >
      <View style={[styles.customChartWrap, { width: chartInnerWidth, height }]}>
        <View style={styles.customChartBarsRow}>
          {finalDue.map((due, index) => {
            const selected = labels[index] === selectedLabel;
            const paid = Number(finalPaid[index] || 0);
            const barHeight = (due / maxValue) * BAR_TRACK_HEIGHT;
            const paidHeight = due === 0 ? 0 : (paid / due) * barHeight;
            const barColor = selected
              ? baseColor || Colors.primary
              : getPremiumBarColor(
                baseColor,
                index,
                finalDue.length,
                0.55
              );

            return (
              <TouchableOpacity
                key={`${labels[index]}-${index}`}
                activeOpacity={0.9}
                style={styles.customBarItem}
                onPress={() =>
                  onBarPress?.({
                    id: ids[index],
                    index,
                    value: due,
                    paid,
                    label: labels[index],
                  })
                }
              >
                <View style={styles.customBarTrack}>
                  <View style={[styles.customBarGroup, { height: barHeight + 24 }]}>
                    {selected ? (
                      <View style={[styles.selectedTooltipBadge, baseColor ? { backgroundColor: baseColor } : null]}>
                        <Text style={styles.selectedTooltipText}>
                          {formatCompactAmount(due)}
                        </Text>
                      </View>
                    ) : (
                      <Text
                        numberOfLines={1}
                        style={styles.customBarValue}
                      >
                        {formatCompactAmount(due)}
                      </Text>
                    )}
                    <View
                      style={[
                        styles.customBar,
                        {
                          height: BAR_TRACK_HEIGHT,
                          width: selected ? 32 : 26,
                          backgroundColor: selected ? "#f0fdfa" : "#f4f8fb",
                          borderRadius: selected ? 20 : 16,
                          borderWidth: selected ? 2 : 1,
                          borderColor: selected ? (baseColor || "#006a61") : "#e2ebf8",
                          overflow: "hidden",
                        },
                      ]}
                    >
                      <View
                        style={{
                          position: "absolute",
                          bottom: 0,
                          width: "100%",
                          height: paidHeight,
                          backgroundColor: selected ? (baseColor || "#006a61") : barColor,
                          borderRadius: selected ? 18 : 15,
                        }}
                      />
                    </View>
                  </View>
                </View>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.customBarLabel,
                    selected && { color: baseColor || Colors.primary, fontWeight: '800' },
                  ]}
                >
                  {labels[index]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  customChartWrap: { justifyContent: 'flex-end', flex: 1 },
  customChartBarsRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-evenly', flex: 1 },
  customBarItem: { width: 44, alignItems: 'center' },
  customBarTrack: { width: 40, height: BAR_TRACK_HEIGHT + 26, justifyContent: 'flex-end', alignItems: 'center' },
  customBarGroup: { width: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  customBarValue: { fontSize: 10, fontWeight: '700', color: Colors.muted || '#64748b', marginBottom: 6, maxWidth: 56, textAlign: 'center' },
  selectedTooltipBadge: {
    backgroundColor: '#006a61',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 5,
    shadowColor: '#006a61',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  selectedTooltipText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
  },
  customBar: { width: 28 },
  customBarLabel: { marginTop: 10, fontSize: 11, fontWeight: '700', color: Colors.muted },
  emptyChartArea: { alignItems: 'center', justifyContent: 'center' },
  emptyChartText: { fontSize: 13, fontWeight: '600', color: Colors.muted },
});
