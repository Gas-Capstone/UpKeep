import { StyleSheet } from "react-native";
import { List, useTheme } from "react-native-paper";

import type { PlanWorkout } from "@/components/context/workoutsDataContext";
import { Radius } from "@/constants/theme";

type ExercisePickerRowProps = {
  exercise: PlanWorkout;
  checked: boolean;
  onToggle: (id: string) => void;
};

export function ExercisePickerRow({ exercise, checked, onToggle }: ExercisePickerRowProps) {
  const theme = useTheme();

  return (
    <List.Item
      title={exercise.name}
      titleNumberOfLines={2}
      description={[exercise.muscle_group, exercise.equipment].filter(Boolean).join(" · ")}
      descriptionNumberOfLines={2}
      onPress={() => onToggle(exercise.id)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={[exercise.name, exercise.muscle_group, exercise.equipment].filter(Boolean).join(", ")}
      style={[
        styles.row,
        { backgroundColor: checked ? theme.colors.secondaryContainer : theme.colors.surface },
      ]}
      right={(props) => (
        <List.Icon
          {...props}
          icon={checked ? "checkbox-marked" : "checkbox-blank-outline"}
          color={checked ? theme.colors.primary : theme.colors.onSurfaceVariant}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { borderRadius: Radius.small },
});
