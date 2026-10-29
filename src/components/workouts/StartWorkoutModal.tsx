import {
  Button,
  Modal,
  Portal,
  Card,
  TextInput,
} from "react-native-paper";
import { useState, useEffect, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Keyboard, ScrollView, StyleSheet, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { styles } from "@/constants/styles";
import { Spacing } from "@/constants/theme";
import { VStack } from "../ui/vstack";
import type { Workout } from "../context/workoutsDataContext";

function revealFocusedInput(scroll: ScrollView | null, target: number | null, offset: number) {
  if (!scroll || target === null) return;
  requestAnimationFrame(() => {
    scroll.scrollResponderScrollNativeHandleToKeyboard(target, offset, true);
  });
}

// Removed unused `user` prop (same issue WorkoutCard.tsx had) and swapped loose Object/Number types for Workout/number.
type startWorkoutProps = {
  visible: boolean;
  workout: Workout;
  onDismiss: () => void;
  onStart?: (workout: Workout, mins: number) => void;
};

export function StartWorkoutModal({
  visible,
  workout,
  onDismiss,
  onStart,
}: startWorkoutProps) {
  const [mins, setMins] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const formScroll = useRef<ScrollView>(null);
  const focusedInput = useRef<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    const shown = Keyboard.addListener("keyboardDidShow", () => {
      revealFocusedInput(
        formScroll.current,
        focusedInput.current,
        footerHeight + Spacing.four + Spacing.three,
      );
    });
    return () => shown.remove();
  }, [footerHeight, visible]);
  const insets = useSafeAreaInsets();

  const dismiss = () => {
    Keyboard.dismiss();
    onDismiss();
  };

  useEffect(() => {
    setMins(workout.duration_min);
  }, [workout]);
  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={dismiss}
        contentContainerStyle={modalStyles.outer}
      >
        <KeyboardAvoidingView behavior="height" keyboardVerticalOffset={insets.top} style={modalStyles.keyboardWrap}>
          <View style={modalStyles.viewport}>
            <Card mode="contained" style={[styles.modalCard, modalStyles.card]}>
              <Card.Title title={workout.name} />

              <ScrollView
                ref={formScroll}
                automaticallyAdjustKeyboardInsets={false}
                contentInsetAdjustmentBehavior="never"
                bounces={false}
                overScrollMode="never"
                onFocus={(event) => {
                  focusedInput.current = event.nativeEvent.target;
                  if (Keyboard.isVisible()) {
                    revealFocusedInput(
                      formScroll.current,
                      focusedInput.current,
                      footerHeight + Spacing.four + Spacing.three,
                    );
                  }
                }}
                onBlur={() => {
                  focusedInput.current = null;
                }}
                style={modalStyles.scroll}
                keyboardShouldPersistTaps="handled"
              >
                <Card.Content style={styles.stepContainer}>
                  <VStack space="md" style={{ alignSelf: "stretch" }}>
                    <TextInput
                      label="Planned minutes"
                      keyboardType="number-pad"
                      mode="outlined"
                      value={mins?.toString()}
                      onChangeText={(text) => setMins(Number(text))}
                    />
                  </VStack>
                </Card.Content>
              </ScrollView>

              <Card.Actions onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}>
                <Button onPress={dismiss}>Cancel</Button>

                <Button
                  mode="contained"
                  onPress={() => {
                    Keyboard.dismiss();
                    onStart?.(workout, mins);
                  }}
                >
                  Start Workout
                </Button>
              </Card.Actions>
            </Card>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
}

const modalStyles = StyleSheet.create({
  outer: { flex: 1, justifyContent: "flex-start" },
  keyboardWrap: { flex: 1, width: "100%" },
  viewport: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
  },
  card: { maxHeight: "100%", flexShrink: 1 },
  scroll: { flexGrow: 0, flexShrink: 1 },
});
