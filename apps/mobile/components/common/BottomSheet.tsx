import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StyleProp,
  ViewStyle
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "../../constants/Colors";
import Spacing from "../../constants/Spacing";
import Typography from "../../constants/Typography";

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeight?: number | `${number}%`;
}

export default function BottomSheet({
  visible,
  onClose,
  title,
  children,
  maxHeight = "75%"
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const sheetStyle: StyleProp<ViewStyle> = [{ maxHeight }, { paddingBottom: insets.bottom + Spacing.lg }];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.sheet, sheetStyle]}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <Text style={styles.title}>{title ?? "선택"}</Text>
              <Pressable onPress={onClose} style={styles.closeButton} accessibilityRole="button">
                <Text style={styles.closeText}>닫기</Text>
              </Pressable>
            </View>

            <View style={styles.content}>{children}</View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end"
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)"
  },
  sheet: {
    backgroundColor: Colors.common.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.sm
  },
  handle: {
    width: 52,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.common.gray300,
    alignSelf: "center",
    marginBottom: Spacing.md
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md
  },
  title: {
    ...Typography.normal.h3,
    color: Colors.common.black
  },
  closeButton: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm
  },
  closeText: {
    ...Typography.normal.bodySmall,
    color: Colors.young.primary,
    fontWeight: "700"
  },
  content: {
    flexShrink: 1
  }
});
