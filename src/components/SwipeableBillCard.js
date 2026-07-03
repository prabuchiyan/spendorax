import React, { useRef, memo } from 'react';
import { Animated, PanResponder, View } from 'react-native';
import BillCard from './BillCard';

const SWIPE_THRESHOLD = 80;

function SwipeableBillCard(props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const { onMarkPaid, onSkip, bill } = props;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dy) < 20,
      onPanResponderMove: (_, g) => {
        translateX.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_THRESHOLD && bill.status !== 'paid' && bill.status !== 'skipped') {
          onMarkPaid && onMarkPaid(bill);
        } else if (g.dx < -SWIPE_THRESHOLD && bill.status !== 'paid') {
          onSkip && onSkip(bill);
        }
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      style={{ transform: [{ translateX }] }}
      {...panResponder.panHandlers}
    >
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 20,
        }}
        pointerEvents="none"
      >
        <View style={{ backgroundColor: '#36B37E33', padding: 8, borderRadius: 8 }}>
          {/* swipe right hint */}
        </View>
        <View style={{ backgroundColor: '#E46A6A22', padding: 8, borderRadius: 8 }}>
          {/* swipe left hint */}
        </View>
      </View>
      <BillCard {...props} />
    </Animated.View>
  );
}

export default memo(SwipeableBillCard);
