import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import CurrencyText from './CurrencyText';
import { useTheme } from '../context/ThemeContext';
import { useBalanceVisibility } from '../context/BalanceVisibilityContext';

export default function CategoryDonut({
  data = [],
  categoriesMap = {},
  size = 160,
  strokeWidth = 18,
  centerLabel = 'Total Spend',
  balanceVisible: propBalanceVisible,
}) {
  const { isDarkMode, theme } = useTheme();
  const { balanceVisible: ctxBalanceVisible } = useBalanceVisibility();
  const balanceVisible = propBalanceVisible !== undefined ? propBalanceVisible : ctxBalanceVisible;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((sum, d) => sum + Number(d.amount || 0), 0);

  let cumulative = 0;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={isDarkMode ? '#1E293B' : '#E2E8F0'}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {total > 0 &&
          data.map((d, i) => {
            const value = Number(d.amount || 0);
            if (value <= 0) return null;
            const percent = value / total;
            const cat = categoriesMap[d.category_id] || {};
            const color = cat.color || (isDarkMode ? '#475569' : '#CBD5E1');
            const strokeDasharray = `${circumference * percent} ${circumference}`;
            const rotation = (cumulative / total) * 360;

            cumulative += value;

            return (
              <Circle
                key={d.category_id ?? i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={strokeDasharray}
                rotation={rotation - 90}
                originX={size / 2}
                originY={size / 2}
                strokeLinecap="butt"
              />
            );
          })}
      </Svg>

      <View
        style={{
          position: 'absolute',
          width: size * 0.66,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            fontWeight: '700',
            fontSize: 11,
            letterSpacing: 0.3,
            color: theme.textSecondary,
            marginBottom: 2,
          }}
        >
          {centerLabel}
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={{
            fontSize: 17,
            fontWeight: '900',
            color: theme.textPrimary,
            textAlign: 'center',
          }}
        >
          {balanceVisible ? <CurrencyText amount={total} /> : '••••••'}
        </Text>
      </View>
    </View>
  );
}
