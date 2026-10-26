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
  const muscleGroup = exercise?.muscleGroup?.trim();
  const muscleGroupLabel = muscleGroup
    ? muscleGroup.charAt(0).toUpperCase() + muscleGroup.slice(1)
    : "No muscle information recorded for this exercise.";
  const equipment = exercise?.equipment?.trim();
  const equipmentLabel = equipment
    ? equipment.charAt(0).toUpperCase() + equipment.slice(1)
    : "No equipment information recorded for this exercise.";

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
            <View style={styles.section}>
              <Text variant="titleMedium">Muscle group</Text>

              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {muscleGroupLabel}
              </Text>
            </View>

            <View style={styles.section}>
              <Text variant="titleMedium">Equipment</Text>

              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {equipmentLabel}
              </Text>
            </View>

            <View style={styles.section}>
              <Text variant="titleMedium">How to perform</Text>

              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {exercise?.instructions?.trim() || "No instructions recorded for this exercise."}
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
