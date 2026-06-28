import { palette, radii, spacing } from '@/constants/theme';
import { PropsWithChildren, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

type BottomSheetProps = PropsWithChildren<{
  contentStyle?: StyleProp<ViewStyle>;
  onClose: () => void;
  visible: boolean;
}>;

export function BottomSheet({ children, contentStyle, onClose, visible }: BottomSheetProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const scrollOffsetY = useRef(0);
  const resetPosition = useCallback(() => {
    Animated.spring(translateY, {
      bounciness: 0,
      speed: 18,
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }, [translateY]);
  const closeFromDrag = useCallback(() => {
    Animated.timing(translateY, {
      duration: 160,
      toValue: 420,
      useNativeDriver: true,
    }).start(onClose);
  }, [onClose, translateY]);
  const canClaimSheetDrag = useCallback(
    (gesture: { dx: number; dy: number }) =>
      scrollOffsetY.current <= 0 && gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    []
  );
  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => canClaimSheetDrag(gesture),
        onMoveShouldSetPanResponderCapture: (_, gesture) => canClaimSheetDrag(gesture),
        onPanResponderGrant: () => {
          translateY.stopAnimation();
        },
        onPanResponderMove: (_, gesture) => {
          translateY.setValue(Math.max(0, gesture.dy));
        },
        onPanResponderTerminate: resetPosition,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 110 || gesture.vy > 0.75) {
            closeFromDrag();
            return;
          }

          resetPosition();
        },
      }),
    [canClaimSheetDrag, closeFromDrag, resetPosition, translateY]
  );
  const handlePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 2 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          translateY.stopAnimation();
        },
        onPanResponderMove: (_, gesture) => {
          translateY.setValue(Math.max(0, gesture.dy));
        },
        onPanResponderTerminate: resetPosition,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 90 || gesture.vy > 0.65) {
            closeFromDrag();
            return;
          }

          resetPosition();
        },
      }),
    [closeFromDrag, resetPosition, translateY]
  );

  useEffect(() => {
    if (visible) {
      translateY.setValue(0);
    }
  }, [translateY, visible]);

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.container}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <Animated.View
          {...sheetPanResponder.panHandlers}
          style={[styles.sheet, contentStyle, { transform: [{ translateY }] }]}>
          <View {...handlePanResponder.panHandlers} style={styles.dragZone}>
            <View style={styles.handle} />
          </View>
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            onScroll={(event) => {
              scrollOffsetY.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(21, 26, 24, 0.42)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    borderWidth: 1,
    maxHeight: '88%',
    padding: spacing.lg,
    paddingBottom: 0,
  },
  dragZone: {
    alignItems: 'center',
    minHeight: 30,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
  },
  handle: {
    backgroundColor: palette.border,
    borderRadius: 999,
    height: 4,
    width: 44,
  },
  content: {
    paddingBottom: spacing.xl,
  },
});
