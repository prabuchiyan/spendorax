import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import Card from './Card';
import { Colors } from './Theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function LoanHealthCard({
  percent = 0,
  active = 0,
  closed = 0,
  overdue = 0,
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.min(100, percent),
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [percent]);

  const width = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const progressColor =
    percent >= 80
      ? '#16A34A'
      : percent >= 50
      ? '#2563EB'
      : '#F59E0B';

  return (
    <Card style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Loan Health</Text>
          <Text style={styles.subtitle}>
            Overall repayment progress
          </Text>
        </View>

        <View
          style={[
            styles.percentBox,
            {
              backgroundColor: progressColor + '20',
            },
          ]}
        >
          <Text
            style={[
              styles.percent,
              {
                color: progressColor,
              },
            ]}
          >
            {Math.round(percent)}%
          </Text>
        </View>
      </View>

      {/* Progress */}

      <View style={styles.progressBackground}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width,
              backgroundColor: progressColor,
            },
          ]}
        />
      </View>

      {/* Stats */}

      <View style={styles.statsRow}>
        <StatCard
          icon="bank-outline"
          label="Active"
          value={active}
          color="#2563EB"
          bg="#DBEAFE"
        />

        <StatCard
          icon="check-circle-outline"
          label="Closed"
          value={closed}
          color="#16A34A"
          bg="#DCFCE7"
        />

        <StatCard
          icon="alert-circle-outline"
          label="Overdue"
          value={overdue}
          color="#DC2626"
          bg="#FEE2E2"
        />
      </View>
    </Card>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  bg,
}) {
  return (
    <View style={styles.statCard}>
      <View
        style={[
          styles.iconBox,
          {
            backgroundColor: bg,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={icon}
          size={18}
          color={color}
        />
      </View>

      <Text
        style={[
          styles.statValue,
          {
            color,
          },
        ]}
      >
        {value}
      </Text>

      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  title: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111827',
  },

  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
  },

  percentBox: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },

  percent: {
    fontWeight: '900',
    fontSize: 18,
  },

  progressBackground: {
    marginTop: 16,
    height: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    overflow: 'hidden',
  },

  progressFill: {
    height: 10,
    borderRadius: 10,
  },

  statsRow: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  statCard: {
    width: '31%',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    paddingVertical: 12,
  },

  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },

  statValue: {
    fontSize: 18,
    fontWeight: '900',
  },

  statLabel: {
    marginTop: 4,
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
});