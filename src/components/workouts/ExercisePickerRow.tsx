import { StyleSheet, View } from "react-native";
import { IconButton, List, useTheme } from "react-native-paper";

import type { PlanWorkout } from "@/components/context/workoutsDataContext";
import { Radius } from "@/constants/theme";

type ExercisePickerRowProps = {
  exercise: PlanWorkout;
  checked: boolean;
  onToggle: (id: string) => void;
  onViewDetails: (exercise: PlanWorkout) => void;
};

export function ExercisePickerRow({ exercise, checked, onToggle, onViewDetails }: ExercisePickerRowProps) {
  const theme = useTheme();

  return (
    <View style={[
      styles.row,
      { backgroundColor: checked ? theme.colors.secondaryContainer : theme.colors.surface },
    ]}>
      <List.Item
        title={exercise.name}
        titleNumberOfLines={2}
        description={[exercise.muscle_group, exercise.equipment].filter(Boolean).join(" · ")}
        descriptionNumberOfLines={2}
        onPress={() => onToggle(exercise.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={[exercise.name, exercise.muscle_group, exercise.equipment].filter(Boolean).join(", ")}
        style={styles.selection}
      />
      <IconButton
        icon="information-outline"
        size={24}
        iconColor={theme.colors.onSurfaceVariant}
        accessibilityLabel={`View details for ${exercise.name}`}
        onPress={() => onViewDetails(exercise)}
        style={styles.actionButton}
      />
      <IconButton
        icon={checked ? "checkbox-marked" : "checkbox-blank-outline"}
        size={24}
        iconColor={checked ? theme.colors.primary : theme.colors.onSurfaceVariant}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={`Select ${exercise.name}`}
        onPress={() => onToggle(exercise.id)}
        style={styles.actionButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderRadius: Radius.small, flexDirection: "row", alignItems: "center" },
  selection: { flex: 1, minWidth: 0 },
  actionButton: { width: 48, height: 48, margin: 0 },
});
