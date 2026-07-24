import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Colors } from './Theme';

const BAR_TRACK_HEIGHT = 170;
const ITEM_WIDTH = 52; // 42 + 10 margin

const hexToRgb = (hex) => {
  if (!hex || typeof hex !== 'string') return null;
  let cleanHex = hex.replace('#', '').trim();

  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }

  if (cleanHex.length !== 6) return null;

  const num = parseInt(cleanHex, 16);

  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
};

const getPremiumBarColor = (baseColor, index, total, opacity = 1) => {
  const safeColor = baseColor || Colors.primary;
  const rgb = hexToRgb(safeColor);

  if (!rgb) {
    return `rgba(76,110,245,${Math.max(0.84, opacity)})`;
  }

  const spread = total > 1 ? index / (total - 1) : 0;
  const lightenAmount = 0.04 + spread * 0.16;

  const r = Math.round(rgb.r + (255 - rgb.r) * lightenAmount);
  const g = Math.round(rgb.g + (255 - rgb.g) * lightenAmount);
  const b = Math.round(rgb.b + (255 - rgb.b) * lightenAmount);

  return `rgba(${r},${g},${b},${Math.min(1, Math.max(0.84, opacity))})`;
};

const formatCompactAmount = (amount) => {
  const num = Number(amount || 0);
  const abs = Math.abs(num);

  if (abs >= 10000000) return `₹${(num / 10000000).toFixed(1).replace(/\.0$/, '')}Cr`;
  if (abs >= 100000) return `₹${(num / 100000).toFixed(1).replace(/\.0$/, '')}L`;
  if (abs >= 1000) return `₹${(num / 1000).toFixed(1).replace(/\.0$/, '')}K`;

  return `₹${num.toLocaleString('en-IN')}`;
};

export default function PremiumRoundedBarChart({
  labels = [],
  values = [],
  width,
  height = 250,
  baseColor,
  onBarPress,
  selectedLabel,
  isEmpty = false,
}) {
  const scrollRef = useRef(null);

  if (isEmpty) {
    return (
      <View style={[styles.emptyChartArea, { width, height }]}>
        <Text style={styles.emptyChartText}>No transactions yet</Text>
      </View>
    );
  }

  const maxValue = Math.max(...values, 1);
  const chartInnerWidth = Math.max(width, labels.length * ITEM_WIDTH);

  useEffect(() => {
    if (!selectedLabel || !scrollRef.current) return;

    const index = labels.findIndex(l => l === selectedLabel);

    if (index < 0) return;

    const centerOffset = width / 2 - ITEM_WIDTH / 2;

    const x = Math.max(
      0,
      Math.min(
        index * ITEM_WIDTH - centerOffset,
        chartInnerWidth - width
      )
    );

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        x,
        animated: true,
      });
    });
  }, [selectedLabel, labels, width]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 8 }}
    >
      <View
        style={[
          styles.customChartWrap,
          {
            width: chartInnerWidth,
            height,
          },
        ]}
      >
        <View style={styles.customChartBarsRow}>
          {values.map((value, index) => {
            const selected = labels[index] === selectedLabel;

            const barHeight =
              maxValue > 0
                ? (value / maxValue) * BAR_TRACK_HEIGHT
                : 0;

            const barColor = selected
              ? baseColor || Colors.primary
              : getPremiumBarColor(baseColor, index, values.length, 0.55);

            return (
              <TouchableOpacity
                key={`${labels[index]}-${index}`}
                activeOpacity={0.9}
                style={styles.customBarItem}
                onPress={() =>
                  onBarPress?.({
                    index,
                    value,
                    label: labels[index],
                  })
                }
              >
                <View style={styles.customBarTrack}>
                  <View
                    style={[
                      styles.customBarGroup,
                      {
                        height: barHeight + 22,
                      },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.customBarValue,
                        selected && {
                          color: baseColor || Colors.primary,
                          fontSize: 11,
                        },
                      ]}
                    >
                      {formatCompactAmount(value)}
                    </Text>

                    <View
                      style={[
                        styles.customBar,
                        {
                          height: barHeight,
                          backgroundColor: barColor,
                          borderRadius: selected ? 20 : 16,
                          width: selected ? 32 : 26,
                        },
                      ]}
                    />
                  </View>
                </View>

                <Text
                  numberOfLines={1}
                  style={[
                    styles.customBarLabel,
                    selected && {
                      color: baseColor || Colors.primary,
                      fontWeight: '800',
                    },
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
  customChartWrap: {
    justifyContent: 'flex-end',
  },
  customChartBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  customBarItem: {
    width: 42,
    marginRight: 10,
    alignItems: 'center',
  },
  customBarTrack: {
    width: 38,
    height: BAR_TRACK_HEIGHT + 22,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  customBarGroup: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  customBarValue: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 6,
    maxWidth: 56,
    textAlign: 'center',
  },
  customBar: {
    width: 28,
  },
  customBarLabel: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: '700',
    color: Colors.muted,
  },
  emptyChartArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyChartText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.muted,
  },
});