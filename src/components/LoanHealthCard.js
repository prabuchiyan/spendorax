import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Card from './Card';
import { Colors } from './Theme';

export default function LoanHealthCard({ percent = 0, active = 0, closed = 0, overdue = 0 }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: Math.min(100, percent || 0), duration: 700, useNativeDriver: false }).start();
  }, [percent]);

  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Overall Repayment</Text>
        <Text style={styles.percent}>{Math.round(percent || 0)}%</Text>
      </View>
      <View style={styles.barBg}>
        <Animated.View style={[styles.barFill, { width }]} />
      </View>
      <View style={styles.statsRow}>
        <View style={styles.stat}><Text style={styles.statNum}>{active}</Text><Text style={styles.statLabel}>Active</Text></View>
        <View style={styles.stat}><Text style={styles.statNum}>{closed}</Text><Text style={styles.statLabel}>Closed</Text></View>
        <View style={styles.stat}><Text style={[styles.statNum, { color: Colors.danger || '#E46A6A' }]}>{overdue}</Text><Text style={styles.statLabel}>Overdue</Text></View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 18 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontWeight: '800', fontSize: 16 },
  percent: { fontWeight: '900', fontSize: 20, color: Colors.primary },
  barBg: { height: 12, backgroundColor: '#f1f5f9', borderRadius: 12, marginTop: 12, overflow: 'hidden' },
  barFill: { height: 12, backgroundColor: '#36B37E', borderRadius: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  stat: { alignItems: 'center' },
  statNum: { fontWeight: '800', fontSize: 14 },
  statLabel: { fontSize: 11, color: Colors.muted }
});
