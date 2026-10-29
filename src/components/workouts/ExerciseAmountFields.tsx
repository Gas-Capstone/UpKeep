import { StyleSheet, View } from "react-native";
import { SegmentedButtons, TextInput } from "react-native-paper";

import { Spacing } from "@/constants/theme";
import {
  DEFAULT_AMOUNT,
  type ExerciseAmountDraft,
  type ExerciseAmountUnit,
} from "@/lib/workouts";

type ExerciseAmountFieldsProps = {
  /** The exercise's name, for screen readers. */
  exerciseName: string;
  draft: ExerciseAmountDraft;
  onChange: (draft: ExerciseAmountDraft) => void;
  outlineColor?: string;
  activeOutlineColor?: string;
};

const AMOUNT_LABEL: Record<ExerciseAmountUnit, string> = {
  reps: "Reps",
  min: "Minutes",
  sec: "Seconds",
};

// Digits only: sets, reps and times are all whole numbers.
const digits = (text: string) => text.replace(/[^0-9]/g, "");

/**
 * Sets and amount for one exercise in a plan editor, with a switch between
 * counting reps and timing each set in minutes or seconds. Shared by the
 * create modal and the edit screen so both work the same way.
 */
export function ExerciseAmountFields({
  exerciseName,
  draft,
  onChange,
  outlineColor,
  activeOutlineColor,
}: ExerciseAmountFieldsProps) {
  const amountLabel = AMOUNT_LABEL[draft.unit];

  return (
    <View style={styles.wrap}>
      <SegmentedButtons
        density="small"
        value={draft.unit}
        onValueChange={(unit) => {
          if (unit === draft.unit) return;
          // A count of reps means nothing as minutes, so the field restarts
          // at the new unit's default instead of carrying the number over.
          onChange({ ...draft, unit, amount: String(DEFAULT_AMOUNT[unit]) });
        }}
        buttons={[
          { value: "reps", label: "Reps", accessibilityLabel: `Count reps for ${exerciseName}` },
          { value: "min", label: "Min", accessibilityLabel: `Time ${exerciseName} in minutes` },
          { value: "sec", label: "Sec", accessibilityLabel: `Time ${exerciseName} in seconds` },
        ]}
      />

      <View style={styles.row}>
        <TextInput
          label="Sets"
          accessibilityLabel={`Sets of ${exerciseName}`}
          mode="outlined"
          dense
          keyboardType="number-pad"
          style={styles.input}
          value={draft.sets}
          onChangeText={(text) => onChange({ ...draft, sets: digits(text) })}
          outlineColor={outlineColor}
          activeOutlineColor={activeOutlineColor}
        />
        <TextInput
          label={amountLabel}
          accessibilityLabel={`${amountLabel} per set of ${exerciseName}`}
          mode="outlined"
          dense
          keyboardType="number-pad"
          style={styles.input}
          value={draft.amount}
          onChangeText={(text) => onChange({ ...draft, amount: digits(text) })}
          outlineColor={outlineColor}
          activeOutlineColor={activeOutlineColor}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  input: {
    flex: 1,
  },
});
