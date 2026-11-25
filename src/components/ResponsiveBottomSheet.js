import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Pressable,
  KeyboardAvoidingView,
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
 * iOS/Android for status-bar translucency and hardware back-button support.
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
  const sheetIdRef = useRef(null);
  if (sheetIdRef.current === null) {
    sheetIdRef.current = nextSheetId++;
  }

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
  const computedMaxHeight = Math.max(220, Math.round(effectiveHeight * maxHeightRatio));

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
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          onLayout={handleLayout}
          style={[styles.nativeOverlay, { backgroundColor: backdropColor }]}
        >
          {innerContent}
        </KeyboardAvoidingView>
      ) : (
        <View
          onLayout={handleLayout}
          style={[styles.nativeOverlay, { backgroundColor: backdropColor }]}
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
