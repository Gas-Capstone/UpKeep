import React from "react";
import { ScrollView, ScrollViewProps, StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { styles } from "@/constants/styles";
import { BottomTabInset, Spacing, TopBadgeInset } from "@/constants/theme";
import { ThemedView } from "../themed-view";

type ScreenViewProps = {
  children: React.ReactNode;
  header?: React.ReactNode;
  overlay?: React.ReactNode;
  contentContainerStyle?: ScrollViewProps["contentContainerStyle"];
  onScroll?: ScrollViewProps["onScroll"];
  keyboardShouldPersistTaps?: ScrollViewProps["keyboardShouldPersistTaps"];
  keyboardBottomOffset?: number;
};

export function ScreenView({
  children,
  header,
  overlay,
  contentContainerStyle,
  onScroll,
  keyboardShouldPersistTaps,
  keyboardBottomOffset,
}: ScreenViewProps) {
  const insets = useSafeAreaInsets();
  const ScrollContainer = keyboardBottomOffset === undefined ? ScrollView : KeyboardAwareScrollView;
  const keyboardProps = keyboardBottomOffset === undefined
    ? {}
    : { bottomOffset: keyboardBottomOffset, mode: "layout" as const };

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        {header}

        <ScrollContainer
          {...keyboardProps}
          style={{ flex: 1, width: "100%" }}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: BottomTabInset + insets.bottom + Spacing.four,
              paddingTop: header ? Spacing.three : TopBadgeInset,
            },
            contentContainerStyle,
          ]}
          onScroll={onScroll}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollContainer>
      </SafeAreaView>

      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {overlay}
      </View>
    </ThemedView>
  );
}
