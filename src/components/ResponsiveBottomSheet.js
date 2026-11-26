import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Pressable,
  KeyboardAvoidingView,
  Keyboard,
  StatusBar,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Portal } from 'react-native-paper';

let nextSheetId = 1;
const activeWebSheetStack = [];

/**
 * Viewport-contained bottom sheet overlay.
 *
 * Uses react-native-paper <Portal> on web so sheets stay strictly inside the
 * app's rendered <Portal.Host> root bounds (avoiding RNW <Modal> attaching to
 * document.body with mismatched viewport dimensions), and native <Modal> on
 * iOS/Android for status-bar translucency, keyboard-aware height clamping, and
 * hardware back-button support.
 */
export default function ResponsiveBottomSheet({
  visible,
  onRequestClose,
  animationType = 'slide',
  backdropColor = 'rgba(0,0,0,0.5)',
  sheetStyle,
  avoidKeyboard = false,
  maxHeightRatio = 0.85,
  disableBackdropPress = false,
  children,
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [keyboardMetrics, setKeyboardMetrics] = useState({ height: 0, screenY: 0 });
  const sheetIdRef = useRef(null);
  if (sheetIdRef.current === null) {
    sheetIdRef.current = nextSheetId++;
  }

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    if (!visible) {
      setKeyboardMetrics({ height: 0, screenY: 0 });
      return undefined;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const end = e?.endCoordinates || {};
      setKeyboardMetrics({
        height: Number(end.height) || 0,
        screenY: Number(end.screenY) || 0,
      });
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardMetrics({ height: 0, screenY: 0 });
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible || typeof window === 'undefined') {
      return undefined;
    }
    const sheetId = sheetIdRef.current;
    const existingIdx = activeWebSheetStack.indexOf(sheetId);
    if (existingIdx !== -1) activeWebSheetStack.splice(existingIdx, 1);
    activeWebSheetStack.push(sheetId);

    const handleKeyDown = (event) => {
      if (
        event.key === 'Escape' &&
        !disableBackdropPress &&
        activeWebSheetStack[activeWebSheetStack.length - 1] === sheetId
      ) {
        onRequestClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      const idx = activeWebSheetStack.indexOf(sheetId);
      if (idx !== -1) activeWebSheetStack.splice(idx, 1);
    };
  }, [visible, disableBackdropPress, onRequestClose]);

  const handleLayout = useCallback((event) => {
    const { width, height } = event.nativeEvent.layout || {};
    if (width > 0 && height > 0) {
      setContainerSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height }
      );
    }
  }, []);

  if (!visible && Platform.OS === 'web') {
    return null;
  }

  const effectiveHeight =
    containerSize.height > 0 ? containerSize.height : windowHeight || 720;
  const effectiveWidth =
    containerSize.width > 0 ? containerSize.width : windowWidth || 360;

  const isNativeKeyboardOpen =
    Platform.OS !== 'web' && avoidKeyboard && keyboardMetrics.height > 0;
  const topSafeInset =
    Platform.OS === 'android'
      ? Math.max(StatusBar.currentHeight || 28, 28)
      : Platform.OS === 'ios'
        ? 48
        : 8;

  const availableHeight = isNativeKeyboardOpen
    ? Math.min(
        effectiveHeight,
        keyboardMetrics.screenY > 0
          ? keyboardMetrics.screenY
          : Math.max(200, (windowHeight || effectiveHeight) - keyboardMetrics.height)
      )
    : effectiveHeight;

  const safeMaxHeightCap = Math.max(180, availableHeight - topSafeInset - 8);
  const computedMaxHeight = isNativeKeyboardOpen
    ? safeMaxHeightCap
    : Math.min(
        Math.max(220, Math.round(effectiveHeight * maxHeightRatio)),
        safeMaxHeightCap
      );
  const androidKeyboardBottomPad =
    Platform.OS === 'android' && isNativeKeyboardOpen
      ? Math.max(0, effectiveHeight - availableHeight)
      : 0;

  // Before onLayout fires on web, use percentage height so a mismatched outer
  // windowHeight cannot push the sheet beyond the Portal.Host root frame.
  const sheetMaxHeightStyle =
    containerSize.height > 0
      ? computedMaxHeight
      : Platform.OS === 'web'
        ? `${Math.round(maxHeightRatio * 100)}%`
        : computedMaxHeight;

  const sheetBody =
    typeof children === 'function'
      ? children({
        maxHeight: computedMaxHeight,
        viewportHeight: effectiveHeight,
        viewportWidth: effectiveWidth,
      })
      : children;

  const innerContent = (
    <>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => {
          if (!disableBackdropPress) onRequestClose?.();
        }}
      />
      <View
        style={[
          styles.sheetWrapper,
          Platform.OS === 'web' && styles.webSheetOverflow,
          { maxHeight: sheetMaxHeightStyle },
          sheetStyle,
        ]}
      >
        {sheetBody}
      </View>
    </>
  );

  if (Platform.OS === 'web') {
    return (
      <Portal>
        <View
          onLayout={handleLayout}
          style={[styles.portalOverlay, { backgroundColor: backdropColor }]}
        >
          {innerContent}
        </View>
      </Portal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType={animationType}
      onRequestClose={onRequestClose}
    >
      {avoidKeyboard && Platform.OS === 'ios' ? (
        <KeyboardAvoidingView
          behavior="padding"
          onLayout={handleLayout}
          style={[
            styles.nativeOverlay,
            { backgroundColor: backdropColor, paddingTop: topSafeInset },
          ]}
        >
          {innerContent}
        </KeyboardAvoidingView>
      ) : (
        <View
          onLayout={handleLayout}
          style={[
            styles.nativeOverlay,
            {
              backgroundColor: backdropColor,
              paddingTop: topSafeInset,
              paddingBottom: androidKeyboardBottomPad,
            },
          ]}
        >
          {innerContent}
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  portalOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'hidden',
    zIndex: 9999,
    elevation: 24,
  },
  nativeOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheetWrapper: {
    width: '100%',
    maxWidth: '100%',
  },
  webSheetOverflow: {
    overflow: 'hidden',
  },
});
