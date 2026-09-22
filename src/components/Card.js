import React from 'react';

import { Card as PaperCard } from 'react-native-paper';
import { Colors, Spacing } from './Theme';

export default function Card({ children, style }) {
  return (
    <PaperCard mode="elevated" style={[{ marginBottom: Spacing.m, borderRadius: 12, overflow: 'hidden' }, style]}>
      <PaperCard.Content style={{ backgroundColor: Colors.card, padding: Spacing.m, flex: 1 }}>
        {children}
      </PaperCard.Content>
    </PaperCard>);

}