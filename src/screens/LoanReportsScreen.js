import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Card from '../components/Card';
import CurrencyText from '../components/CurrencyText';
import { useTheme } from '../context/ThemeContext';
import { useBalanceVisibility } from '../context/BalanceVisibilityContext';
import { getLoanById, getLoanPayments, getLoans } from '../services/loans';
import events from '../services/events';
import { formatCompactAmount } from '../utils/numberUtils';
import {
  buildSingleLoanMonthlySeries,
  buildSingleLoanSummary,
  sampleSeriesPoints,
} from '../utils/loanReportUtils';

function formatShortDate(dateValue) {
  if (!dateValue) return '—';
  const normalized = String(dateValue).trim().replace(' ', 'T');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function CompactAmountText({ amount, style }) {
  const { balanceVisible } = useBalanceVisibility();
  return (
    <Text style={style} numberOfLines={1}>
      {balanceVisible ? formatCompactAmount(amount) : '•••'}
    </Text>
  );
}

/* =========================================================
   HERO SNAPSHOT CARD
========================================================= */

function LoanHeroCard({ summary, loan, isDarkMode }) {
  const accent = summary.isLent ? '#7C3AED' : '#2563EB';
  const progressColor = summary.isClosed
    ? '#16A34A'
    : summary.repaymentProgressPct >= 75
      ? '#10B981'
      : accent;

  return (
    <Card style={styles.heroCard}>
      <View style={[styles.heroBanner, { backgroundColor: accent }]}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroTitleBlock}>
            <View style={styles.heroBadgeRow}>
              <View style={styles.heroDirectionPill}>
                <MaterialCommunityIcons
                  name={summary.isLent ? 'hand-coin-outline' : 'bank-outline'}
                  size={12}
                  color="#FFFFFF"
                />
                <Text style={styles.heroDirectionText}>
                  {summary.isLent ? 'Money Lent' : 'Borrowed'}
                </Text>
              </View>

              {!!summary.loanType && (
                <View style={styles.heroTypePill}>
                  <Text style={styles.heroTypeText} numberOfLines={1}>
                    {summary.loanType}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.heroLoanTitle} numberOfLines={2}>
              {summary.loanName}
            </Text>

            {!!summary.lender && (
              <Text style={styles.heroCounterparty} numberOfLines={1}>
                {summary.isLent ? 'Borrower: ' : 'Lender: '}
                {summary.lender}
              </Text>
            )}
          </View>

          <View
            style={[
              styles.heroStatusPill,
              { backgroundColor: summary.isClosed ? '#DCFCE7' : '#DBEAFE' },
            ]}
          >
            <Text
              style={[
                styles.heroStatusText,
                { color: summary.isClosed ? '#15803D' : '#1D4ED8' },
              ]}
            >
              {summary.status}
            </Text>
          </View>
        </View>

        <View style={styles.heroBalanceRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.heroBalanceLabel}>
              {summary.isLent ? 'Pending Recovery' : 'Remaining Balance'}
            </Text>
            <Text
              style={styles.heroBalanceValue}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              <CurrencyText amount={summary.outstandingAmount} />
            </Text>
          </View>

          <View style={styles.heroRateBox}>
            <Text style={styles.heroRateLabel}>Interest Rate</Text>
            <Text style={styles.heroRateValue}>{summary.interestRate}% p.a.</Text>
          </View>
        </View>
      </View>

      {/* Progress Section */}
      <View style={styles.heroProgressWrap}>
        <View style={styles.heroProgressHeader}>
          <Text style={[styles.heroProgressTitle, { color: isDarkMode ? '#CBD5E1' : '#334155' }]}>
            {summary.isLent ? 'Recovery Progress' : 'Repayment Progress'}
          </Text>
          <Text style={[styles.heroProgressPct, { color: progressColor }]}>
            {summary.repaymentProgressPct}%
          </Text>
        </View>

        <View
          style={[
            styles.heroProgressTrack,
            { backgroundColor: isDarkMode ? '#334155' : '#E2E8F0' },
          ]}
        >
          <View
            style={[
              styles.heroProgressFill,
              {
                width: `${summary.repaymentProgressPct}%`,
                backgroundColor: progressColor,
              },
            ]}
          />
        </View>

        <View style={styles.heroProgressSubRow}>
          <Text style={[styles.heroProgressSubText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            {summary.isLent ? 'Recovered: ' : 'Principal Repaid: '}
            <Text style={{ fontWeight: '800', color: isDarkMode ? '#F1F5F9' : '#0F172A' }}>
              <CurrencyText amount={summary.principalPaid} minimumFractionDigits={0} maximumFractionDigits={0} />
            </Text>
          </Text>

          <Text style={[styles.heroProgressSubText, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            Total Principal:{' '}
            <Text style={{ fontWeight: '800', color: isDarkMode ? '#F1F5F9' : '#0F172A' }}>
              <CurrencyText amount={summary.currentPrincipal} minimumFractionDigits={0} maximumFractionDigits={0} />
            </Text>
          </Text>
        </View>

        {summary.additionsTotal > 0 && (
          <View
            style={[
              styles.additionNotice,
              { backgroundColor: isDarkMode ? 'rgba(124, 58, 237, 0.18)' : '#F5F3FF' },
            ]}
          >
            <MaterialCommunityIcons name="plus-circle-outline" size={14} color="#7C3AED" />
            <Text style={[styles.additionNoticeText, { color: isDarkMode ? '#DDD6FE' : '#5B21B6' }]}>
              Includes <CurrencyText amount={summary.additionsTotal} minimumFractionDigits={0} maximumFractionDigits={0} /> in{' '}
              {summary.isLent ? 'additional lending' : 'top-ups'} above the original{' '}
              <CurrencyText amount={summary.originalPrincipal} minimumFractionDigits={0} maximumFractionDigits={0} />
            </Text>
          </View>
        )}
      </View>

      {/* 3 Quick Highlight KPIs */}
      <View style={styles.heroKpiRow}>
        <View
          style={[
            styles.heroKpiBox,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <Text style={[styles.heroKpiLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            {summary.isLent ? 'Total Recovered' : 'Total Paid'}
          </Text>
          <Text
            style={[styles.heroKpiVal, { color: '#10B981' }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            <CurrencyText amount={summary.totalPaid} minimumFractionDigits={0} maximumFractionDigits={0} />
          </Text>
        </View>

        <View
          style={[
            styles.heroKpiBox,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <Text style={[styles.heroKpiLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            {summary.isLent ? 'Interest Earned' : 'Interest Paid'}
          </Text>
          <Text
            style={[styles.heroKpiVal, { color: '#F59E0B' }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            <CurrencyText amount={summary.interestPaid} minimumFractionDigits={0} maximumFractionDigits={0} />
          </Text>
        </View>

        <View
          style={[
            styles.heroKpiBox,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
              borderColor: isDarkMode ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <Text style={[styles.heroKpiLabel, { color: isDarkMode ? '#94A3B8' : '#64748B' }]}>
            {summary.isClosed ? 'Status' : 'Est. Payoff'}
          </Text>
          <Text
            style={[styles.heroKpiVal, { color: isDarkMode ? '#F1F5F9' : '#0F172A' }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {summary.isClosed
              ? 'Closed'
              : summary.remainingMonths > 0
                ? `${summary.remainingMonths} mo`
                : loan?.emi_amount > 0
                  ? '—'
                  : 'Flexible'}
          </Text>
        </View>
      </View>
    </Card>
  );
}

/* =========================================================
   DONUT BREAKDOWN CHART (SVG)
========================================================= */

function LoanBreakdownDonutCard({ summary, theme, isDarkMode, screenWidth }) {
  const [selectedSliceKey, setSelectedSliceKey] = useState(null);
  const isCompact = screenWidth < 360;
  const size = isCompact ? 168 : 148;
  const baseStroke = 20;
  const radius = (size - baseStroke - 8) / 2;
  const circumference = 2 * Math.PI * radius;

  const activeSegments = summary.donutSegments.filter((s) => s.amount > 0);
  const selectedSegment = activeSegments.find((s) => s.key === selectedSliceKey) || null;

  let cumulative = 0;

  return (
    <Card style={styles.sectionCard}>
      <View style={styles.cardTitleRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
            {summary.isLent ? 'Recovery & Earnings Split' : 'Where Your Money Goes'}
          </Text>
          <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
            Tap any slice row to highlight principal, interest, or remaining share
          </Text>
        </View>
      </View>

      {summary.donutTotal <= 0 ? (
        <View style={styles.emptyChartBox}>
          <MaterialCommunityIcons name="chart-donut" size={32} color={theme.textMuted} />
          <Text style={[styles.emptyChartText, { color: theme.textSecondary }]}>
            No loan balance or payment data recorded yet.
          </Text>
        </View>
      ) : (
        <View style={[styles.donutLayout, isCompact && styles.donutLayoutStacked]}>
          <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={isDarkMode ? '#334155' : '#F1F5F9'}
                strokeWidth={baseStroke}
                fill="none"
              />
              {activeSegments.map((seg) => {
                const percent = seg.amount / summary.donutTotal;
                const rotation = (cumulative / summary.donutTotal) * 360;
                cumulative += seg.amount;
                const isSelected = selectedSliceKey === seg.key;
                const isDimmed = selectedSliceKey != null && !isSelected;

                return (
                  <Circle
                    key={seg.key}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={seg.color}
                    strokeOpacity={isDimmed ? 0.35 : 1}
                    strokeWidth={isSelected ? baseStroke + 4 : baseStroke}
                    fill="none"
                    strokeDasharray={`${circumference * percent} ${circumference}`}
                    rotation={rotation - 90}
                    originX={size / 2}
                    originY={size / 2}
                    strokeLinecap="butt"
                  />
                );
              })}
            </Svg>

            <View style={styles.donutCenter}>
              <Text
                style={[styles.donutCenterLabel, { color: theme.textSecondary }]}
                numberOfLines={1}
              >
                {selectedSegment ? selectedSegment.label : summary.isLent ? 'Recovered' : 'Repaid'}
              </Text>
              <Text
                style={[
                  styles.donutCenterValue,
                  { color: selectedSegment ? selectedSegment.color : theme.textPrimary },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {selectedSegment ? `${selectedSegment.percentage}%` : `${summary.repaymentProgressPct}%`}
              </Text>
              {selectedSegment ? (
                <Text style={[styles.donutCenterSub, { color: theme.textSecondary }]} numberOfLines={1}>
                  <CurrencyText
                    amount={selectedSegment.amount}
                    minimumFractionDigits={0}
                    maximumFractionDigits={0}
                  />
                </Text>
              ) : (
                <Text style={[styles.donutCenterSub, { color: theme.textMuted }]} numberOfLines={1}>
                  Principal
                </Text>
              )}
            </View>
          </View>

          <View style={[styles.donutLegendWrap, isCompact && { marginLeft: 0, marginTop: 14, width: '100%' }]}>
            {summary.donutSegments.map((seg) => {
              const isSelected = selectedSliceKey === seg.key;
              return (
                <TouchableOpacity
                  key={seg.key}
                  activeOpacity={0.75}
                  onPress={() =>
                    setSelectedSliceKey((prev) => (prev === seg.key ? null : seg.key))
                  }
                  style={[
                    styles.donutLegendRow,
                    {
                      backgroundColor: isSelected
                        ? isDarkMode
                          ? '#1E293B'
                          : '#EFF6FF'
                        : isDarkMode
                          ? '#0F172A'
                          : '#F8FAFC',
                      borderColor: isSelected ? seg.color : theme.border,
                    },
                  ]}
                >
                  <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[styles.donutLegendLabel, { color: theme.textSecondary }]}
                      numberOfLines={1}
                    >
                      {seg.label}
                    </Text>
                    <Text
                      style={[styles.donutLegendAmount, { color: theme.textPrimary }]}
                      numberOfLines={1}
                    >
                      <CurrencyText amount={seg.amount} minimumFractionDigits={0} maximumFractionDigits={0} />
                    </Text>
                  </View>
                  <View style={[styles.pctBadge, { backgroundColor: `${seg.color}1F` }]}>
                    <Text style={[styles.pctBadgeText, { color: seg.color }]}>
                      {seg.percentage}%
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {(summary.interestRemaining > 0 || summary.prepaymentTotal > 0) && (
        <View
          style={[
            styles.insightStrip,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
              borderColor: theme.border,
            },
          ]}
        >
          {summary.interestRemaining > 0 && (
            <View style={styles.insightStripRow}>
              <MaterialCommunityIcons name="calculator-variant-outline" size={16} color="#F59E0B" />
              <Text style={[styles.insightStripText, { color: theme.textSecondary }]}>
                Est. Remaining Interest:{' '}
                <Text style={{ fontWeight: '800', color: theme.textPrimary }}>
                  <CurrencyText amount={summary.interestRemaining} minimumFractionDigits={0} maximumFractionDigits={0} />
                </Text>
                {'  •  '}
                Total Cost:{' '}
                <Text style={{ fontWeight: '800', color: theme.textPrimary }}>
                  <CurrencyText amount={summary.totalEstimatedInterest} minimumFractionDigits={0} maximumFractionDigits={0} />
                </Text>
              </Text>
            </View>
          )}

          {summary.prepaymentTotal > 0 && (
            <View
              style={[
                styles.insightStripRow,
                summary.interestRemaining > 0 && { marginTop: 6 },
              ]}
            >
              <MaterialCommunityIcons name="trending-down" size={16} color="#10B981" />
              <Text style={[styles.insightStripText, { color: theme.textSecondary }]}>
                Prepayments made:{' '}
                <Text style={{ fontWeight: '800', color: '#10B981' }}>
                  <CurrencyText amount={summary.prepaymentTotal} minimumFractionDigits={0} maximumFractionDigits={0} />
                </Text>
                {' '}reducing balance early
              </Text>
            </View>
          )}
        </View>
      )}
    </Card>
  );
}

/* =========================================================
   BALANCE TRAJECTORY GRAPH (SVG LINE + AREA)
========================================================= */

function BalanceTrajectoryCard({ series, summary, theme, isDarkMode, screenWidth }) {
  const [viewMode, setViewMode] = useState('all'); // 'all' | 'actual' | 'projected'
  const [selectedIndex, setSelectedIndex] = useState(null);

  const hasProjected = series.projectedMonths.length > 0;

  useEffect(() => {
    if (!hasProjected && viewMode === 'projected') {
      setViewMode('all');
    }
    setSelectedIndex(null);
  }, [summary.loanId, hasProjected, viewMode]);

  const rawPoints = useMemo(() => {
    if (viewMode === 'actual') return series.actualMonths;
    if (viewMode === 'projected') {
      const pivot = series.actualMonths[series.actualMonths.length - 1];
      return pivot ? [pivot, ...series.projectedMonths] : series.projectedMonths;
    }
    return series.combinedBalanceSeries;
  }, [series, viewMode]);

  const pivotInRaw = useMemo(() => {
    return rawPoints.findIndex((p) => p.isCurrentPivot);
  }, [rawPoints]);

  const sampledPoints = useMemo(() => {
    return sampleSeriesPoints(rawPoints, 14, pivotInRaw);
  }, [rawPoints, pivotInRaw]);

  const defaultPivotIndex = useMemo(() => {
    const idx = sampledPoints.findIndex((p) => p.isCurrentPivot);
    return idx >= 0 ? idx : Math.max(0, sampledPoints.length - 1);
  }, [sampledPoints]);

  const activeIndex =
    selectedIndex != null && selectedIndex >= 0 && selectedIndex < sampledPoints.length
      ? selectedIndex
      : defaultPivotIndex;
  const activePoint = sampledPoints[activeIndex] || null;

  const yAxisWidth = 50;
  const plotWidth = Math.max(180, screenWidth - 60 - yAxisWidth - 6);
  const plotHeight = 166;
  const padX = 12;
  const padTop = 14;
  const padBottom = 14;
  const usableW = Math.max(10, plotWidth - padX * 2);
  const usableH = Math.max(10, plotHeight - padTop - padBottom);

  const maxBalance = useMemo(() => {
    if (sampledPoints.length === 0) return 100;
    const m = Math.max(...sampledPoints.map((p) => Number(p.balance || 0)), 0);
    return m > 0 ? m : 100;
  }, [sampledPoints]);

  const coords = useMemo(() => {
    if (sampledPoints.length === 0) return [];
    return sampledPoints.map((pt, idx) => {
      const x =
        sampledPoints.length === 1
          ? plotWidth / 2
          : padX + (idx / (sampledPoints.length - 1)) * usableW;
      const ratio = Math.max(0, Math.min(1, Number(pt.balance || 0) / maxBalance));
      const y = padTop + usableH * (1 - ratio);
      return { ...pt, x, y, idx };
    });
  }, [sampledPoints, plotWidth, usableW, usableH, maxBalance]);

  const { actualLinePath, actualAreaPath, projectedLinePath } = useMemo(() => {
    if (coords.length === 0) {
      return { actualLinePath: '', actualAreaPath: '', projectedLinePath: '' };
    }
    const actualCoords = coords.filter((c) => !c.isProjected);
    const projectedCoords = coords.filter((c) => c.isProjected);

    let aLine = '';
    let aArea = '';
    if (actualCoords.length > 0) {
      aLine = actualCoords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
      const baselineY = (padTop + usableH).toFixed(1);
      const firstX = actualCoords[0].x.toFixed(1);
      const lastX = actualCoords[actualCoords.length - 1].x.toFixed(1);
      aArea = `${aLine} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;
    }

    let pLine = '';
    if (projectedCoords.length > 0) {
      const pivot = actualCoords[actualCoords.length - 1];
      const projList = pivot ? [pivot, ...projectedCoords] : projectedCoords;
      pLine = projList.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
    }

    return { actualLinePath: aLine, actualAreaPath: aArea, projectedLinePath: pLine };
  }, [coords, usableH]);

  const xLabels = useMemo(() => {
    if (coords.length === 0) return [];
    if (coords.length === 1) return [coords[0]];
    if (coords.length === 2) {
      return Math.abs(coords[1].x - coords[0].x) >= 52 ? [coords[0], coords[1]] : [coords[0]];
    }
    const first = coords[0];
    const last = coords[coords.length - 1];
    const pivotIdx = coords.findIndex((c) => c.isCurrentPivot);
    const midIdx = Math.floor((coords.length - 1) / 2);
    const candidate = pivotIdx > 0 && pivotIdx < coords.length - 1 ? coords[pivotIdx] : coords[midIdx];
    const fitsMiddle =
      candidate &&
      Math.abs(candidate.x - first.x) >= 54 &&
      Math.abs(last.x - candidate.x) >= 54;
    return fitsMiddle ? [first, candidate, last] : [first, last];
  }, [coords]);

  return (
    <Card style={styles.sectionCard}>
      <View style={styles.cardTitleRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
            Balance Over Time
          </Text>
          <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
            {hasProjected
              ? 'Actual balance path & projected payoff to ₹0'
              : 'Actual remaining balance history'}
          </Text>
        </View>
      </View>

      {hasProjected && (
        <View style={styles.filterPillsRow}>
          {[
            { key: 'all', label: 'Full Path' },
            { key: 'actual', label: 'Paid So Far' },
            { key: 'projected', label: 'Payoff Plan' },
          ].map((tab) => {
            const active = viewMode === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                activeOpacity={0.75}
                onPress={() => setViewMode(tab.key)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: active
                      ? '#2563EB'
                      : isDarkMode
                        ? '#1E293B'
                        : '#F1F5F9',
                    borderColor: active ? '#2563EB' : theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    { color: active ? '#FFFFFF' : theme.textSecondary },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {coords.length === 0 ? (
        <View style={styles.emptyChartBox}>
          <MaterialCommunityIcons name="chart-line" size={32} color={theme.textMuted} />
          <Text style={[styles.emptyChartText, { color: theme.textSecondary }]}>
            No balance history available yet.
          </Text>
        </View>
      ) : (
        <>
          {/* Inspector Banner */}
          {activePoint && (
            <View
              style={[
                styles.inspectorBox,
                {
                  backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                  borderColor: activePoint.isProjected ? '#10B981' : '#3B82F6',
                },
              ]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={[styles.inspectorMonth, { color: theme.textPrimary }]}>
                    {activePoint.fullLabel}
                  </Text>
                  <View
                    style={[
                      styles.inspectorBadge,
                      {
                        backgroundColor: activePoint.isProjected
                          ? 'rgba(16, 185, 129, 0.15)'
                          : activePoint.isCurrentPivot
                            ? 'rgba(37, 99, 235, 0.15)'
                            : 'rgba(100, 116, 139, 0.14)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.inspectorBadgeText,
                        {
                          color: activePoint.isProjected
                            ? '#10B981'
                            : activePoint.isCurrentPivot
                              ? '#2563EB'
                              : theme.textSecondary,
                        },
                      ]}
                    >
                      {activePoint.isProjected
                        ? 'Projected'
                        : activePoint.isCurrentPivot
                          ? 'Current'
                          : 'Actual'}
                    </Text>
                  </View>
                  {activePoint.additionAmount > 0 && (
                    <View style={[styles.inspectorBadge, { backgroundColor: 'rgba(124, 58, 237, 0.15)' }]}>
                      <Text style={[styles.inspectorBadgeText, { color: '#7C3AED' }]}>
                        +{summary.isLent ? 'Lent' : 'Top-Up'}
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={[styles.inspectorMeta, { color: theme.textSecondary }]}>
                  {activePoint.isProjected ? 'Scheduled Payment: ' : 'Paid in Month: '}
                  <CurrencyText
                    amount={activePoint.totalPaid}
                    minimumFractionDigits={0}
                    maximumFractionDigits={0}
                  />
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.inspectorBalanceLabel, { color: theme.textMuted }]}>
                  {summary.isLent ? 'Pending' : 'Balance'}
                </Text>
                <Text style={[styles.inspectorBalanceValue, { color: theme.textPrimary }]}>
                  <CurrencyText
                    amount={activePoint.balance}
                    minimumFractionDigits={0}
                    maximumFractionDigits={0}
                  />
                </Text>
              </View>
            </View>
          )}

          {/* Chart Body */}
          <View style={styles.lineChartWrap}>
            {/* Y-Axis Labels */}
            <View style={[styles.yAxisColumn, { width: yAxisWidth, height: plotHeight }]}>
              <CompactAmountText amount={maxBalance} style={[styles.yAxisLabel, { color: theme.textMuted }]} />
              <CompactAmountText amount={maxBalance / 2} style={[styles.yAxisLabel, { color: theme.textMuted }]} />
              <CompactAmountText amount={0} style={[styles.yAxisLabel, { color: theme.textMuted }]} />
            </View>

            {/* SVG + Touch Overlay */}
            <View style={{ width: plotWidth, height: plotHeight }}>
              <Svg width={plotWidth} height={plotHeight}>
                <Defs>
                  <LinearGradient id="actualBalanceGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor="#3B82F6" stopOpacity="0.24" />
                    <Stop offset="100%" stopColor="#3B82F6" stopOpacity="0.02" />
                  </LinearGradient>
                </Defs>

                {/* Horizontal Gridlines */}
                {[0, 0.5, 1].map((frac, idx) => {
                  const gy = padTop + usableH * frac;
                  return (
                    <Line
                      key={idx}
                      x1={padX}
                      y1={gy}
                      x2={plotWidth - padX}
                      y2={gy}
                      stroke={isDarkMode ? '#334155' : '#E2E8F0'}
                      strokeWidth={1}
                      strokeDasharray={frac === 1 ? undefined : '4, 4'}
                    />
                  );
                })}

                {/* Actual Area Fill */}
                {!!actualAreaPath && <Path d={actualAreaPath} fill="url(#actualBalanceGrad)" />}

                {/* Actual Line */}
                {!!actualLinePath && (
                  <Path
                    d={actualLinePath}
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Projected Dashed Line */}
                {!!projectedLinePath && (
                  <Path
                    d={projectedLinePath}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    strokeDasharray="6, 4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Selected Hairline Guide */}
                {activePoint && coords[activeIndex] && (
                  <Line
                    x1={coords[activeIndex].x}
                    y1={padTop}
                    x2={coords[activeIndex].x}
                    y2={padTop + usableH}
                    stroke={activePoint.isProjected ? '#10B981' : '#3B82F6'}
                    strokeWidth={1}
                    strokeOpacity={0.5}
                    strokeDasharray="3, 3"
                  />
                )}

                {/* Data Point Dots */}
                {coords.map((pt) => {
                  const isSelected = pt.idx === activeIndex;
                  const dotColor = pt.additionAmount > 0
                    ? '#7C3AED'
                    : pt.isProjected
                      ? '#10B981'
                      : '#3B82F6';
                  return (
                    <React.Fragment key={pt.key}>
                      {(isSelected || pt.isCurrentPivot) && (
                        <Circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isSelected ? 8 : 6}
                          fill={dotColor}
                          fillOpacity={0.2}
                        />
                      )}
                      <Circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isSelected ? 4.5 : pt.isCurrentPivot ? 4 : 2.8}
                        fill={isSelected || pt.isCurrentPivot ? dotColor : theme.cardBg}
                        stroke={dotColor}
                        strokeWidth={2}
                      />
                    </React.Fragment>
                  );
                })}
              </Svg>

              {/* Touch Hit Columns */}
              <View style={styles.touchColumnsOverlay}>
                {coords.map((pt) => (
                  <Pressable
                    key={pt.key}
                    onPress={() => setSelectedIndex(pt.idx)}
                    style={{ flex: 1, height: '100%' }}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${pt.fullLabel}`}
                  />
                ))}
              </View>
            </View>
          </View>

          {/* X-Axis Labels */}
          <View style={[styles.xAxisLabelsRow, { marginLeft: yAxisWidth, width: plotWidth }]}>
            {xLabels.map((pt) => {
              const labelWidth = 52;
              const left = Math.max(0, Math.min(plotWidth - labelWidth, pt.x - labelWidth / 2));
              return (
                <Text
                  key={pt.key}
                  numberOfLines={1}
                  style={[
                    styles.xAxisLabelText,
                    {
                      left,
                      width: labelWidth,
                      color: pt.idx === activeIndex ? theme.textPrimary : theme.textMuted,
                      fontWeight: pt.idx === activeIndex ? '800' : '600',
                    },
                  ]}
                >
                  {pt.label}
                </Text>
              );
            })}
          </View>

          {/* Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { backgroundColor: '#3B82F6' }]} />
              <Text style={[styles.legendItemText, { color: theme.textSecondary }]}>
                Actual Balance
              </Text>
            </View>

            {hasProjected && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDashedLine, { borderColor: '#10B981' }]} />
                <Text style={[styles.legendItemText, { color: theme.textSecondary }]}>
                  Projected Payoff
                </Text>
              </View>
            )}
          </View>
        </>
      )}
    </Card>
  );
}

/* =========================================================
   MONTHLY PRINCIPAL VS INTEREST BAR CHART
========================================================= */

function MonthlyBreakdownBarCard({ series, summary, theme, isDarkMode, screenWidth }) {
  const [showAllMonths, setShowAllMonths] = useState(false);
  const [selectedKey, setSelectedKey] = useState(null);
  const scrollRef = useRef(null);

  const hasEmptyGapMonths = series.actualMonths.length > series.activeMonths.length;
  const chartMonths = showAllMonths ? series.actualMonths : series.activeMonths;

  useEffect(() => {
    if (chartMonths.length === 0) {
      setSelectedKey(null);
      return;
    }
    const stillExists = selectedKey && chartMonths.some((m) => m.key === selectedKey);
    if (!stillExists) {
      setSelectedKey(chartMonths[chartMonths.length - 1].key);
    }
  }, [summary.loanId, showAllMonths, chartMonths.length]);

  useEffect(() => {
    if (chartMonths.length > 5 && scrollRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      });
    }
  }, [summary.loanId, showAllMonths, chartMonths.length]);

  const selectedMonth =
    chartMonths.find((m) => m.key === selectedKey) ||
    chartMonths[chartMonths.length - 1] ||
    null;

  const maxMonthlyVal = useMemo(() => {
    if (chartMonths.length === 0) return 100;
    const maxVal = Math.max(
      ...chartMonths.map((m) => Math.max(m.principalPaid + m.interestPaid, m.repaymentAmount)),
      0
    );
    return maxVal > 0 ? maxVal : 100;
  }, [chartMonths]);

  const BAR_AREA_HEIGHT = 136;
  const yAxisWidth = 48;
  const plotAreaWidth = Math.max(180, screenWidth - 60 - yAxisWidth - 6);
  const fitAll = chartMonths.length <= 5;
  const colWidth = fitAll
    ? Math.max(46, Math.floor(plotAreaWidth / Math.max(chartMonths.length, 1)))
    : 56;

  return (
    <Card style={styles.sectionCard}>
      <View style={styles.cardTitleRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
            Monthly Principal vs Interest
          </Text>
          <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
            Tap any bar to inspect that month&apos;s exact split
          </Text>
        </View>

        {hasEmptyGapMonths && series.activeMonths.length > 0 && (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setShowAllMonths((v) => !v)}
            style={[
              styles.toggleChip,
              {
                backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.toggleChipText, { color: theme.textSecondary }]}>
              {showAllMonths ? 'Active Only' : 'All Months'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {chartMonths.length === 0 ? (
        <View style={styles.emptyChartBox}>
          <MaterialCommunityIcons name="chart-bar" size={32} color={theme.textMuted} />
          <Text style={[styles.emptyChartText, { color: theme.textSecondary }]}>
            No payments recorded for this loan yet.
          </Text>
        </View>
      ) : (
        <>
          {/* Selected Month Inspector */}
          {selectedMonth && (
            <View
              style={[
                styles.monthInspectorCard,
                {
                  backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={styles.monthInspectorTop}>
                <Text style={[styles.inspectorMonth, { color: theme.textPrimary }]}>
                  {selectedMonth.fullLabel}
                </Text>
                <Text style={[styles.monthInspectorTotal, { color: theme.textPrimary }]}>
                  Total:{' '}
                  <CurrencyText
                    amount={selectedMonth.totalPaid}
                    minimumFractionDigits={0}
                    maximumFractionDigits={0}
                  />
                </Text>
              </View>

              <View style={styles.monthInspectorGrid}>
                <View style={styles.monthInspectorItem}>
                  <Text style={[styles.monthInspectorLabel, { color: theme.textMuted }]}>
                    Principal
                  </Text>
                  <Text style={[styles.monthInspectorVal, { color: '#10B981' }]}>
                    <CurrencyText
                      amount={selectedMonth.principalPaid}
                      minimumFractionDigits={0}
                      maximumFractionDigits={0}
                    />
                  </Text>
                </View>

                <View style={[styles.vDivider, { backgroundColor: theme.border }]} />

                <View style={styles.monthInspectorItem}>
                  <Text style={[styles.monthInspectorLabel, { color: theme.textMuted }]}>
                    Interest
                  </Text>
                  <Text style={[styles.monthInspectorVal, { color: '#F59E0B' }]}>
                    <CurrencyText
                      amount={selectedMonth.interestPaid}
                      minimumFractionDigits={0}
                      maximumFractionDigits={0}
                    />
                  </Text>
                </View>

                <View style={[styles.vDivider, { backgroundColor: theme.border }]} />

                <View style={styles.monthInspectorItem}>
                  <Text style={[styles.monthInspectorLabel, { color: theme.textMuted }]}>
                    Balance After
                  </Text>
                  <Text style={[styles.monthInspectorVal, { color: '#3B82F6' }]}>
                    <CurrencyText
                      amount={selectedMonth.balance}
                      minimumFractionDigits={0}
                      maximumFractionDigits={0}
                    />
                  </Text>
                </View>
              </View>

              {selectedMonth.additionAmount > 0 && (
                <View style={styles.monthAdditionBadge}>
                  <MaterialCommunityIcons name="cash-plus" size={14} color="#7C3AED" />
                  <Text style={styles.monthAdditionText}>
                    {summary.isLent ? 'Additional Lending: +' : 'Loan Top-Up: +'}
                    <CurrencyText
                      amount={selectedMonth.additionAmount}
                      minimumFractionDigits={0}
                      maximumFractionDigits={0}
                    />
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Bars with Y-Axis Gridlines */}
          <View style={styles.barChartContainer}>
            <View style={[styles.yAxisColumn, { width: yAxisWidth, height: BAR_AREA_HEIGHT }]}>
              <CompactAmountText amount={maxMonthlyVal} style={[styles.yAxisLabel, { color: theme.textMuted }]} />
              <CompactAmountText amount={maxMonthlyVal / 2} style={[styles.yAxisLabel, { color: theme.textMuted }]} />
              <CompactAmountText amount={0} style={[styles.yAxisLabel, { color: theme.textMuted }]} />
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              {/* Background gridlines */}
              <View style={[styles.barGridLines, { height: BAR_AREA_HEIGHT }]} pointerEvents="none">
                <View style={[styles.barGridLine, { borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]} />
                <View style={[styles.barGridLine, { borderColor: isDarkMode ? '#334155' : '#E2E8F0' }]} />
                <View style={[styles.barGridLineSolid, { backgroundColor: isDarkMode ? '#334155' : '#CBD5E1' }]} />
              </View>

              <ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={
                  fitAll ? { flexGrow: 1, justifyContent: 'space-around' } : { paddingHorizontal: 4 }
                }
              >
                {chartMonths.map((m) => {
                  const isSelected = selectedMonth && selectedMonth.key === m.key;
                  const stackTotal = m.principalPaid + m.interestPaid;
                  const pHeight =
                    m.principalPaid > 0
                      ? Math.max(4, Math.round((m.principalPaid / maxMonthlyVal) * (BAR_AREA_HEIGHT - 18)))
                      : 0;
                  const iHeight =
                    m.interestPaid > 0
                      ? Math.max(4, Math.round((m.interestPaid / maxMonthlyVal) * (BAR_AREA_HEIGHT - 18)))
                      : 0;

                  return (
                    <Pressable
                      key={m.key}
                      onPress={() => setSelectedKey(m.key)}
                      style={[
                        styles.barCol,
                        { width: colWidth },
                      ]}
                    >
                      <View style={[styles.barTrack, { height: BAR_AREA_HEIGHT }]}>
                        {m.additionAmount > 0 && (
                          <View style={styles.additionBarMarker}>
                            <Text style={styles.additionBarMarkerText}>+</Text>
                          </View>
                        )}

                        {stackTotal > 0 ? (
                          <View
                            style={[
                              styles.barStackWrapper,
                              isSelected && styles.barStackSelected,
                            ]}
                          >
                            {iHeight > 0 && (
                              <View
                                style={{
                                  width: isSelected ? 24 : 20,
                                  height: iHeight,
                                  backgroundColor: '#F59E0B',
                                  borderTopLeftRadius: 6,
                                  borderTopRightRadius: 6,
                                  borderBottomLeftRadius: pHeight === 0 ? 6 : 0,
                                  borderBottomRightRadius: pHeight === 0 ? 6 : 0,
                                }}
                              />
                            )}
                            {pHeight > 0 && (
                              <View
                                style={{
                                  width: isSelected ? 24 : 20,
                                  height: pHeight,
                                  backgroundColor: '#10B981',
                                  borderTopLeftRadius: iHeight === 0 ? 6 : 0,
                                  borderTopRightRadius: iHeight === 0 ? 6 : 0,
                                  borderBottomLeftRadius: 4,
                                  borderBottomRightRadius: 4,
                                }}
                              />
                            )}
                          </View>
                        ) : (
                          <View
                            style={{
                              width: 14,
                              height: 3,
                              borderRadius: 2,
                              backgroundColor: isDarkMode ? '#475569' : '#CBD5E1',
                            }}
                          />
                        )}
                      </View>

                      <Text
                        numberOfLines={1}
                        style={[
                          styles.barXLabel,
                          {
                            color: isSelected ? '#2563EB' : theme.textSecondary,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {m.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {/* Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSquare, { backgroundColor: '#10B981' }]} />
              <Text style={[styles.legendItemText, { color: theme.textSecondary }]}>
                Principal
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSquare, { backgroundColor: '#F59E0B' }]} />
              <Text style={[styles.legendItemText, { color: theme.textSecondary }]}>
                Interest
              </Text>
            </View>
            {summary.additionsTotal > 0 && (
              <View style={styles.legendItem}>
                <View style={[styles.legendSquare, { backgroundColor: '#7C3AED' }]} />
                <Text style={[styles.legendItemText, { color: theme.textSecondary }]}>
                  {summary.isLent ? '+Lent' : '+Top-Up'}
                </Text>
              </View>
            )}
          </View>
        </>
      )}
    </Card>
  );
}

/* =========================================================
   PAYMENT MIX & LOAN TERMS CARD
========================================================= */

function LoanMixAndTermsCard({ summary, loan, theme, isDarkMode }) {
  const mixRows = [
    {
      key: 'emi',
      label: summary.isLent ? 'Recoveries / Payments' : 'EMI / Regular Payments',
      icon: 'cash-check',
      color: '#10B981',
      data: summary.paymentMix.emi,
    },
    {
      key: 'prepayment',
      label: 'Prepayments',
      icon: 'trending-down',
      color: '#F97316',
      data: summary.paymentMix.prepayment,
    },
    {
      key: 'foreclosure',
      label: 'Foreclosure',
      icon: 'bank-remove',
      color: '#DC2626',
      data: summary.paymentMix.foreclosure,
    },
    {
      key: 'addition',
      label: summary.isLent ? 'Additional Lending' : 'Loan Top-Ups',
      icon: 'cash-plus',
      color: '#7C3AED',
      data: summary.paymentMix.addition,
    },
  ].filter((item) => item.data.count > 0 || item.key === 'emi');

  const terms = [
    {
      label: 'Original Principal',
      value: <CurrencyText amount={summary.originalPrincipal} minimumFractionDigits={0} maximumFractionDigits={0} />,
    },
    {
      label: summary.isLent ? 'Expected Recovery' : 'Monthly EMI',
      value: summary.emiAmount > 0
        ? <CurrencyText amount={summary.emiAmount} minimumFractionDigits={0} maximumFractionDigits={0} />
        : 'Flexible',
    },
    {
      label: 'Start Date',
      value: formatShortDate(loan?.loan_start_date),
    },
    {
      label: 'Tenure / Remaining',
      value: summary.isClosed
        ? 'Completed'
        : summary.tenureMonths > 0
          ? `${summary.remainingMonths} / ${summary.tenureMonths} mo`
          : summary.remainingMonths > 0
            ? `${summary.remainingMonths} mo`
            : 'Flexible',
    },
    {
      label: 'Est. Payoff Month',
      value: summary.estimatedPayoffLabel || 'Flexible',
    },
    {
      label: 'Interest Rate',
      value: `${summary.interestRate}% p.a.`,
    },
  ];

  return (
    <Card style={styles.sectionCard}>
      <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
        Payment Summary & Terms
      </Text>
      <Text style={[styles.cardSubtitle, { color: theme.textSecondary, marginBottom: 12 }]}>
        Activity mix and schedule details for this loan
      </Text>

      {/* Payment Mix Rows */}
      <View style={styles.mixList}>
        {mixRows.map((row) => (
          <View
            key={row.key}
            style={[
              styles.mixRow,
              {
                backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC',
                borderColor: theme.border,
              },
            ]}
          >
            <View style={[styles.mixIconBox, { backgroundColor: `${row.color}1C` }]}>
              <MaterialCommunityIcons name={row.icon} size={18} color={row.color} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.mixLabel, { color: theme.textPrimary }]} numberOfLines={1}>
                {row.label}
              </Text>
              <Text style={[styles.mixCount, { color: theme.textSecondary }]}>
                {row.data.count} {row.data.count === 1 ? 'entry' : 'entries'}
              </Text>
            </View>
            <Text style={[styles.mixAmount, { color: row.color }]}>
              <CurrencyText amount={row.data.amount} minimumFractionDigits={0} maximumFractionDigits={0} />
            </Text>
          </View>
        ))}
      </View>

      {/* Terms Grid */}
      <View style={styles.termsGrid}>
        {terms.map((item) => (
          <View
            key={item.label}
            style={[
              styles.termCell,
              {
                backgroundColor: isDarkMode ? '#0F172A' : '#F8FAFC',
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.termLabel, { color: theme.textMuted }]} numberOfLines={1}>
              {item.label}
            </Text>
            <Text style={[styles.termValue, { color: theme.textPrimary }]} numberOfLines={1}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

/* =========================================================
   MAIN SCREEN
========================================================= */

export default function LoanReportsScreen({ route, navigation }) {
  const { theme, isDarkMode } = useTheme();
  const { width: screenWidth } = useWindowDimensions();

  const routeLoanId = route?.params?.id ?? route?.params?.loanId ?? null;
  const [selectedFallbackId, setSelectedFallbackId] = useState(null);
  const [availableLoans, setAvailableLoans] = useState([]);
  const [loan, setLoan] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const activeLoanId = routeLoanId ?? selectedFallbackId;

  const loadReportData = useCallback(async () => {
    try {
      setLoading(true);
      if (routeLoanId != null) {
        const [targetLoan, loanPayments] = await Promise.all([
          getLoanById(routeLoanId),
          getLoanPayments(routeLoanId, 5000, 0),
        ]);
        setLoan(targetLoan || null);
        setPayments(loanPayments || []);
      } else {
        const allLoans = await getLoans();
        setAvailableLoans(allLoans || []);
        const chosenId = selectedFallbackId ?? allLoans?.[0]?.id ?? null;
        if (chosenId != null && selectedFallbackId == null) {
          setSelectedFallbackId(chosenId);
        }
        if (chosenId != null) {
          const [targetLoan, loanPayments] = await Promise.all([
            getLoanById(chosenId),
            getLoanPayments(chosenId, 5000, 0),
          ]);
          setLoan(targetLoan || null);
          setPayments(loanPayments || []);
        } else {
          setLoan(null);
          setPayments([]);
        }
      }
    } catch (error) {
      console.error('Failed to load loan report:', error);
    } finally {
      setLoading(false);
    }
  }, [routeLoanId, selectedFallbackId]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  useEffect(() => {
    const onLoansChanged = (payload) => {
      if (payload?.action === 'recalculate') return;
      loadReportData();
    };
    const onPaymentsChanged = (payload) => {
      if (payload?.action === 'recalculate') return;
      if (activeLoanId == null || payload?.loanId == null || Number(payload.loanId) === Number(activeLoanId)) {
        loadReportData();
      }
    };

    const offLoans = events.on('loansChanged', onLoansChanged);
    const offPayments = events.on('loanPaymentsChanged', onPaymentsChanged);
    return () => {
      offLoans && offLoans();
      offPayments && offPayments();
    };
  }, [loadReportData, activeLoanId]);

  useEffect(() => {
    if (navigation?.setOptions && loan?.loan_name) {
      navigation.setOptions({ title: `${loan.loan_name} Report` });
    }
  }, [navigation, loan?.loan_name]);

  const summary = useMemo(() => buildSingleLoanSummary(loan, payments), [loan, payments]);
  const series = useMemo(() => buildSingleLoanMonthlySeries(loan, payments), [loan, payments]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Fallback loan switcher ONLY when opened without a specific loan id */}
      {routeLoanId == null && availableLoans.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.loanPickerRow}
        >
          {availableLoans.map((item) => {
            const active = Number(item.id) === Number(activeLoanId);
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.75}
                onPress={() => setSelectedFallbackId(item.id)}
                style={[
                  styles.loanPickerChip,
                  {
                    backgroundColor: active
                      ? '#2563EB'
                      : isDarkMode
                        ? '#1E293B'
                        : '#FFFFFF',
                    borderColor: active ? '#2563EB' : theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.loanPickerChipText,
                    { color: active ? '#FFFFFF' : theme.textPrimary },
                  ]}
                  numberOfLines={1}
                >
                  {item.loan_name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {loading && !summary ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loaderText, { color: theme.textSecondary }]}>
            Preparing loan report...
          </Text>
        </View>
      ) : !summary ? (
        <Card style={styles.sectionCard}>
          <View style={styles.emptyChartBox}>
            <MaterialCommunityIcons name="file-chart-outline" size={40} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
              Loan Report Unavailable
            </Text>
            <Text style={[styles.emptyChartText, { color: theme.textSecondary }]}>
              Could not find details for this loan.
            </Text>
          </View>
        </Card>
      ) : (
        <>
          <LoanHeroCard summary={summary} loan={loan} isDarkMode={isDarkMode} />

          <LoanBreakdownDonutCard
            summary={summary}
            theme={theme}
            isDarkMode={isDarkMode}
            screenWidth={screenWidth}
          />

          <BalanceTrajectoryCard
            series={series}
            summary={summary}
            theme={theme}
            isDarkMode={isDarkMode}
            screenWidth={screenWidth}
          />

          <MonthlyBreakdownBarCard
            series={series}
            summary={summary}
            theme={theme}
            isDarkMode={isDarkMode}
            screenWidth={screenWidth}
          />

          <LoanMixAndTermsCard
            summary={summary}
            loan={loan}
            theme={theme}
            isDarkMode={isDarkMode}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 32,
  },
  loaderBox: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '800',
  },
  loanPickerRow: {
    paddingBottom: 12,
    gap: 8,
  },
  loanPickerChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  loanPickerChipText: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* Hero Card */
  heroCard: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  heroBanner: {
    margin: -16,
    marginBottom: 16,
    padding: 18,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  heroTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  heroDirectionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  heroDirectionText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  heroTypePill: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  heroTypeText: {
    color: '#E0E7FF',
    fontSize: 10,
    fontWeight: '700',
  },
  heroLoanTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 25,
  },
  heroCounterparty: {
    color: '#DBEAFE',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  heroStatusPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
  },
  heroStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  heroBalanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 18,
    gap: 12,
  },
  heroBalanceLabel: {
    color: '#DBEAFE',
    fontSize: 11,
    fontWeight: '600',
  },
  heroBalanceValue: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 2,
  },
  heroRateBox: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
  },
  heroRateLabel: {
    color: '#DBEAFE',
    fontSize: 10,
    fontWeight: '600',
  },
  heroRateValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
  },
  heroProgressWrap: {
    marginBottom: 14,
  },
  heroProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  heroProgressTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  heroProgressPct: {
    fontSize: 14,
    fontWeight: '900',
  },
  heroProgressTrack: {
    height: 9,
    borderRadius: 9,
    overflow: 'hidden',
  },
  heroProgressFill: {
    height: '100%',
    borderRadius: 9,
  },
  heroProgressSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  heroProgressSubText: {
    fontSize: 11,
    fontWeight: '600',
  },
  additionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  additionNoticeText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
  },
  heroKpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  heroKpiBox: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 9,
    minWidth: 0,
  },
  heroKpiLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  heroKpiVal: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '900',
  },

  /* Section Cards */
  sectionCard: {
    borderRadius: 20,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  emptyChartBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  emptyChartText: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },

  /* Donut Section */
  donutLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  donutLayoutStacked: {
    flexDirection: 'column',
  },
  donutCenter: {
    position: 'absolute',
    width: '62%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenterLabel: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  donutCenterValue: {
    fontSize: 20,
    fontWeight: '900',
    marginTop: 1,
  },
  donutCenterSub: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 1,
  },
  donutLegendWrap: {
    flex: 1,
    marginLeft: 14,
    gap: 8,
  },
  donutLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  donutLegendLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  donutLegendAmount: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 1,
  },
  pctBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pctBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  insightStrip: {
    marginTop: 14,
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  insightStripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  insightStripText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },

  /* Filter Pills */
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '800',
  },

  /* Trajectory Line Chart */
  inspectorBox: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  inspectorMonth: {
    fontSize: 13,
    fontWeight: '800',
  },
  inspectorBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  inspectorBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  inspectorMeta: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  inspectorBalanceLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  inspectorBalanceValue: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 1,
  },
  lineChartWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
  },
  yAxisColumn: {
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingRight: 6,
    alignItems: 'flex-end',
  },
  yAxisLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  touchColumnsOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  xAxisLabelsRow: {
    position: 'relative',
    height: 16,
    marginTop: 6,
  },
  xAxisLabelText: {
    position: 'absolute',
    fontSize: 10,
    textAlign: 'center',
  },

  /* Legend Row */
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendLine: {
    width: 14,
    height: 3,
    borderRadius: 2,
  },
  legendDashedLine: {
    width: 14,
    height: 0,
    borderTopWidth: 2.5,
    borderStyle: 'dashed',
  },
  legendSquare: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendItemText: {
    fontSize: 11,
    fontWeight: '700',
  },

  /* Monthly Bar Chart */
  toggleChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  toggleChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  monthInspectorCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  monthInspectorTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  monthInspectorTotal: {
    fontSize: 12,
    fontWeight: '800',
  },
  monthInspectorGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthInspectorItem: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  monthInspectorLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  monthInspectorVal: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 3,
  },
  vDivider: {
    width: 1,
    height: 26,
  },
  monthAdditionBadge: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  monthAdditionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7C3AED',
  },
  barChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 14,
  },
  barGridLines: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  barGridLine: {
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  barGridLineSolid: {
    height: 1,
  },
  barCol: {
    alignItems: 'center',
  },
  barTrack: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '100%',
  },
  barStackWrapper: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: 2,
    borderRadius: 8,
  },
  barStackSelected: {
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
  },
  additionBarMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  additionBarMarkerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 13,
  },
  barXLabel: {
    marginTop: 6,
    fontSize: 10,
  },

  /* Mix & Terms */
  mixList: {
    gap: 8,
  },
  mixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  mixIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mixLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  mixCount: {
    fontSize: 11,
    marginTop: 1,
  },
  mixAmount: {
    fontSize: 14,
    fontWeight: '900',
  },
  termsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 8,
  },
  termCell: {
    width: '48.5%',
    padding: 11,
    borderRadius: 14,
    borderWidth: 1,
  },
  termLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  termValue: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '800',
  },
});
