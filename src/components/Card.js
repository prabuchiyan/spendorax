import React from 'react';
import { Card as PaperCard } from 'react-native-paper';
import { Spacing } from './Theme';
import { useTheme } from '../context/ThemeContext';

export default function Card({ children, style, contentStyle }) {
  const { theme } = useTheme();
  return (
    <PaperCard
      mode="elevated"
      style={[
        {
          marginBottom: Spacing.m,
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: theme.cardBg,
          borderColor: theme.border,
          borderWidth: theme.isDark ? 1 : 0,
        },
        style,
      ]}
    >
      <PaperCard.Content
        style={[
          {
            backgroundColor: theme.cardBg,
            padding: Spacing.m,
            flex: 1,
          },
          contentStyle,
        ]}
      >
        {children}
      </PaperCard.Content>
    </PaperCard>
  );
}
