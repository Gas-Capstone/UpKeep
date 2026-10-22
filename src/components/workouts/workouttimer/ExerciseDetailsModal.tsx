import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Dialog, Portal, Text, useTheme } from "react-native-paper";

import { MaxContentWidth, Radius, Spacing } from "@/constants/theme";
import type { PlanExercise } from "@/lib/workouts";

type Props = {
  exercise: PlanExercise | null;
  onDismiss: () => void;
};

export function ExerciseDetailsModal({ exercise, onDismiss }: Props) {
  const theme = useTheme();

  return (
    <Portal>
      <Dialog
        visible={exercise !== null}
        onDismiss={onDismiss}
        style={[styles.dialog, { backgroundColor: theme.colors.surface }]}
      >
        <Dialog.Title>{exercise?.name}</Dialog.Title>

        <Dialog.ScrollArea>
          <ScrollView contentContainerStyle={styles.content}>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              Exercise information is coming soon.
            </Text>

            <View style={styles.section}>
              <Text variant="titleMedium">How to perform</Text>

              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Instructions are not available yet.
              </Text>
            </View>

            <View style={styles.section}>
              <Text variant="titleMedium">Muscles worked</Text>

              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                Muscle information is not available yet.
              </Text>
            </View>
          </ScrollView>
        </Dialog.ScrollArea>

        <Dialog.Actions>
          <Button onPress={onDismiss} contentStyle={styles.button}>Close</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    alignSelf: "center",
    width: "90%",
    maxWidth: MaxContentWidth,
    maxHeight: "85%",
    borderRadius: Radius.large,
  },
  content: { paddingVertical: Spacing.three, gap: Spacing.four },
  section: { gap: Spacing.two },
  button: { minHeight: 48 },
});
