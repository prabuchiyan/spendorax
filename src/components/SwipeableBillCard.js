import React, { memo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  View,
  Text,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import BillCard from './BillCard';

const SWIPE_THRESHOLD = 55;
const MAX_SWIPE = 130;
const TAP_THRESHOLD = 10;

function SwipeableBillCard(props) {
  const {
    bill,
    onMarkPaid,
    onSkip,
    onPress,
  } = props;

  const translateX = useRef(
    new Animated.Value(0)
  ).current;

  const isPaid = bill?.status === 'paid';
  const isSkipped = bill?.status === 'skipped';

  const canSwipe = !isPaid && !isSkipped;

  /*
   * Keep latest callbacks.
   */
  const callbacksRef = useRef({
    onMarkPaid,
    onSkip,
    onPress,
  });

  callbacksRef.current = {
    onMarkPaid,
    onSkip,
    onPress,
  };

  /*
   * Reset card position.
   */
  const resetCard = (callback) => {
    Animated.spring(translateX, {
      toValue: 0,
      friction: 8,
      tension: 65,
      useNativeDriver: true,
    }).start(() => {
      callback?.();
    });
  };

  /*
   * =========================================
   * PAN RESPONDER
   * =========================================
   *
   * IMPORTANT:
   *
   * We only capture HORIZONTAL movement.
   *
   * A normal tap is NOT captured.
   *
   * This allows buttons inside BillCard
   * (Delete / Edit / Mark Paid) to receive
   * the touch normally on Web + Mobile.
   */
  const panResponder = useRef(
    PanResponder.create({

      onStartShouldSetPanResponder: () => false,

      onStartShouldSetPanResponderCapture: () => false,

      onMoveShouldSetPanResponderCapture: (_, gesture) => {
        if (!canSwipe) {
          return false;
        }

        const dx = Math.abs(gesture.dx);
        const dy = Math.abs(gesture.dy);

        return (
          dx > TAP_THRESHOLD &&
          dx > dy * 1.15
        );
      },

      onMoveShouldSetPanResponder: (_, gesture) => {
        if (!canSwipe) {
          return false;
        }

        const dx = Math.abs(gesture.dx);
        const dy = Math.abs(gesture.dy);

        return (
          dx > TAP_THRESHOLD &&
          dx > dy * 1.15
        );
      },

      onPanResponderGrant: () => {
        translateX.stopAnimation();
      },

      onPanResponderMove: (_, gesture) => {
        if (!canSwipe) {
          return;
        }

        let x = gesture.dx;

        x = Math.max(
          -MAX_SWIPE,
          Math.min(MAX_SWIPE, x)
        );

        translateX.setValue(x);
      },

      onPanResponderRelease: (_, gesture) => {
        const dx = gesture.dx;
        const dy = gesture.dy;

        const horizontal =
          Math.abs(dx) > Math.abs(dy) * 1.15;

        /*
         * RIGHT SWIPE
         * Mark paid
         */
        if (
          canSwipe &&
          horizontal &&
          dx >= SWIPE_THRESHOLD
        ) {
          resetCard(() => {
            Alert.alert(
              'Mark as Paid?',
              `Are you sure you want to mark "${bill?.name || 'this bill'}" as paid?`,
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Mark Paid',
                  style: 'default',
                  onPress: () => {
                    callbacksRef.current.onMarkPaid?.(
                      bill
                    );
                  },
                },
              ]
            );
          });

          return;
        }

        /*
         * LEFT SWIPE
         * Skip
         */
        if (
          canSwipe &&
          horizontal &&
          dx <= -SWIPE_THRESHOLD
        ) {
          resetCard(() => {
            callbacksRef.current.onSkip?.(
              bill
            );
          });

          return;
        }

        /*
         * NORMAL TAP
         *
         * We intentionally do NOT call onPress here.
         *
         * BillCard owns its own press handling.
         *
         * This is important because BillCard contains
         * Delete/Edit/Mark Paid buttons.
         */
        resetCard();
      },

      onPanResponderTerminate: () => {
        resetCard();
      },
    })
  ).current;

  return (
    <View
      style={{
        position: 'relative',
        width: '100%',
      }}
    >
      {/* =====================================
          LEFT SWIPE HINT
      ===================================== */}
      {canSwipe && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            borderRadius: 16,
            backgroundColor: '#FFF7E8',
            borderWidth: 1,
            borderColor: '#F4DFC0',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingLeft: 18,
          }}
        >
          <MaterialCommunityIcons
            name="skip-next-outline"
            size={23}
            color="#C98A2E"
          />

          <View
            style={{
              marginLeft: 9,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '900',
                color: '#B87920',
              }}
            >
              Skip
            </Text>

            <Text
              style={{
                marginTop: 2,
                fontSize: 9,
                fontWeight: '600',
                color: '#9A7B4B',
              }}
            >
              Swipe left
            </Text>
          </View>
        </View>
      )}

      {/* =====================================
          RIGHT SWIPE HINT
      ===================================== */}
      {canSwipe && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            borderRadius: 16,
            backgroundColor: '#EAF7F0',
            borderWidth: 1,
            borderColor: '#D1EBDD',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: 18,
          }}
        >
          <View
            style={{
              alignItems: 'flex-end',
              marginRight: 9,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '900',
                color: '#3F8F6B',
              }}
            >
              Mark Paid
            </Text>

            <Text
              style={{
                marginTop: 2,
                fontSize: 9,
                fontWeight: '600',
                color: '#719482',
              }}
            >
              Swipe right
            </Text>
          </View>

          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: '#D8F0E3',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={23}
              color="#3F8F6B"
            />
          </View>
        </View>
      )}

      {/* =====================================
          ACTUAL BILL CARD
      ===================================== */}
      <Animated.View
        {...panResponder.panHandlers}
        style={{
          transform: [
            {
              translateX,
            },
          ],
        }}
      >
        {/*
         * IMPORTANT:
         *
         * Do NOT wrap BillCard in another
         * TouchableOpacity here.
         *
         * BillCard itself handles:
         * - card press
         * - delete
         * - edit
         * - mark paid
         *
         * This avoids nested TouchableOpacity
         * problems on React Native Web.
         */}
        <BillCard
          {...props}
        />
      </Animated.View>
    </View>
  );
}

export default memo(SwipeableBillCard);