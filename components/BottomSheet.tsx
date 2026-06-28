import { palette, radii, spacing } from '@/constants/theme';
import GorhomBottomSheet, {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { PropsWithChildren, useCallback } from 'react';
import { Modal, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

type BottomSheetProps = PropsWithChildren<{
  contentStyle?: StyleProp<ViewStyle>;
  onClose: () => void;
  visible: boolean;
}>;

export function BottomSheet({ children, contentStyle, onClose, visible }: BottomSheetProps) {
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
    ),
    []
  );

  // A full-window RN Modal hosts the sheet so it overlays everything (incl. the tab bar).
  // gorhom sizes the sheet to its content (dynamic sizing) and lifts it above the keyboard via
  // `keyboardBehavior="interactive"`, driven by the KeyboardProvider mounted inside this modal
  // window (gorhom reads the keyboard through react-native-keyboard-controller, which handles
  // Android edge-to-edge correctly). Note: gorhom's portal BottomSheetModal does not render over
  // expo-router's native screens here, which is why the sheet is hosted in an RN Modal instead.
  return (
    <Modal
      animationType="none"
      navigationBarTranslucent
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}>
      <KeyboardProvider>
        <GestureHandlerRootView style={styles.fill}>
          <GorhomBottomSheet
            index={0}
            enableDynamicSizing
            enablePanDownToClose
            onClose={onClose}
            backdropComponent={renderBackdrop}
            keyboardBehavior="interactive"
            keyboardBlurBehavior="restore"
            handleIndicatorStyle={styles.handleIndicator}
            backgroundStyle={styles.background}>
            <BottomSheetScrollView
              contentContainerStyle={[styles.content, contentStyle]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {children}
            </BottomSheetScrollView>
          </GorhomBottomSheet>
        </GestureHandlerRootView>
      </KeyboardProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  background: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    borderWidth: 1,
  },
  handleIndicator: {
    backgroundColor: palette.border,
    width: 44,
  },
  content: {
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
});
