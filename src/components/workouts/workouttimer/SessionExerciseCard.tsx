import { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  Card,
  Divider,
  HelperText,
  IconButton,
  List,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

import { Radius, Spacing } from "@/constants/theme";
import type { ExerciseProgress, PlanExercise } from "@/lib/workouts";

type Props = {
  exercise: PlanExercise;
  progress: ExerciseProgress;
  disabled: boolean;
  trackingDisabled: boolean;
  onViewDetails: () => void;
  onChange: (progress: ExerciseProgress) => void;
};

export function SessionExerciseCard({
  exercise,
  progress,
  disabled,
  trackingDisabled,
  onViewDetails,
  onChange,
}: Props) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [sets, setSets] = useState(String(progress.sets));
  const [reps, setReps] = useState(String(progress.reps));
  const [weight, setWeight] = useState(progress.weightKg?.toString() ?? "");
  const [edited, setEdited] = useState(false);
  const setsValue = Number(sets);
  const repsValue = Number(reps);
  const weightValue = weight.trim() === "" ? null : Number(weight.replace(",", "."));
  const setsValid = /^\d+$/.test(sets) && setsValue >= 1 && setsValue <= 999;
  const repsValid = /^\d+$/.test(reps) && repsValue >= 1 && repsValue <= 999;
  const weightValid = weightValue === null || (Number.isFinite(weightValue) && weightValue >= 0 && weightValue <= 9999);
  const valid = setsValid && repsValid && weightValid;
  const done = progress.sets - progress.setsRemaining;

  const apply = () => {
    if (!valid || disabled) return;
    const remaining = Math.max(0, setsValue - done);
    onChange({
      ...progress,
      sets: setsValue,
      reps: repsValue,
      weightKg: weightValue,
      setsRemaining: remaining,
      completed: remaining === 0,
    });
    setEdited(false);
    setEditing(false);
  };

  return (
    <Card
      mode="outlined"
      style={[styles.card, {
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.outlineVariant,
      }]}
    >
      <List.Item
        title={exercise.name}
        titleNumberOfLines={3}
        description={`${progress.sets} sets × ${progress.reps} reps${progress.weightKg !== null ? ` · ${progress.weightKg} kg` : ""}`}
        descriptionNumberOfLines={2}
        onPress={onViewDetails}
        accessibilityLabel={`View details for ${exercise.name}, ${progress.sets} sets of ${progress.reps} reps${progress.weightKg !== null ? ` at ${progress.weightKg} kilograms` : ""}`}
        left={(props) => (
          <List.Icon
            {...props}
            color={progress.completed ? theme.colors.primary : theme.colors.onSurfaceVariant}
            icon={progress.completed ? "check-circle-outline" : "dumbbell"}
          />
        )}
        right={(props) => <List.Icon {...props} icon="information-outline" />}
      />

      <Card.Content style={styles.tracking}>
        <View style={styles.progressRow}>
          <Text
            variant="labelLarge"
            style={[styles.progressText, {
              color: progress.completed ? theme.colors.primary : theme.colors.onSurfaceVariant,
            }]}
          >
            {progress.completed ? "All sets complete" : `${done} of ${progress.sets} sets complete`}
          </Text>

          <View style={styles.actions}>
            <IconButton
              icon="undo-variant"
              size={24}
              style={styles.undo}
              disabled={disabled || trackingDisabled || done <= 0}
              accessibilityLabel={`Undo last set of ${exercise.name}`}
              onPress={() => onChange({
                ...progress,
                setsRemaining: Math.min(progress.sets, progress.setsRemaining + 1),
                completed: false,
              })}
            />

            <Button
              mode="contained-tonal"
              icon={progress.completed ? "check" : "plus"}
              compact
              disabled={disabled || trackingDisabled || progress.setsRemaining <= 0}
              contentStyle={styles.button}
              accessibilityLabel={`Log one set of ${exercise.name}`}
              onPress={() => {
                const remaining = Math.max(0, progress.setsRemaining - 1);
                onChange({ ...progress, setsRemaining: remaining, completed: remaining === 0 });
              }}
            >
              {progress.completed ? "Done" : "Log set"}
            </Button>
          </View>
        </View>

        {!disabled && (
          <Button
            mode="text"
            compact
            onPress={() => setEditing(!editing)}
            accessibilityLabel={`Edit sets, reps and weight for ${exercise.name}`}
            accessibilityState={{ expanded: editing }}
            textColor={theme.colors.onSurfaceVariant}
            style={styles.editButton}
            labelStyle={[theme.fonts.labelMedium, styles.editLabel]}
            contentStyle={styles.button}
          >
            {editing ? "Close editor" : "Edit"}
          </Button>
        )}

        {editing && !disabled && (
          <View style={styles.editor}>
            <Divider />

            <View style={styles.fields}>
              <TextInput
                mode="outlined"
                label="Sets"
                accessibilityLabel="Sets"
                value={sets}
                onChangeText={(value) => { setSets(value); setEdited(true); }}
                keyboardType="number-pad"
                error={!setsValid}
                style={styles.field}
              />

              <TextInput
                mode="outlined"
                label="Reps per set"
                accessibilityLabel="Reps per set"
                value={reps}
                onChangeText={(value) => { setReps(value); setEdited(true); }}
                keyboardType="number-pad"
                error={!repsValid}
                style={styles.field}
              />
            </View>

            <TextInput
              mode="outlined"
              label="Weight (kg, optional)"
              accessibilityLabel="Weight (kg, optional)"
              value={weight}
              onChangeText={(value) => { setWeight(value); setEdited(true); }}
              keyboardType="decimal-pad"
              error={!weightValid}
            />

            {!valid && (
              <HelperText type="error">
                Sets and reps must be whole numbers from 1–999. Weight must be 0–9999 kg or blank.
              </HelperText>
            )}

            <Button
              mode="outlined"
              onPress={apply}
              disabled={!valid || !edited}
              contentStyle={styles.button}
            >
              Apply adjustments
            </Button>
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.medium, overflow: "hidden" },
  tracking: { gap: Spacing.one, paddingBottom: Spacing.two },
  progressRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: Spacing.two },
  progressText: { flexGrow: 1, flexBasis: 110 },
  actions: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  undo: { margin: 0, width: 48, height: 48 },
  editButton: { alignSelf: "flex-start" },
  editLabel: { marginHorizontal: Spacing.two, marginVertical: Spacing.one },
  editor: { gap: Spacing.three, paddingBottom: Spacing.two },
  fields: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  field: { flex: 1, minWidth: 100 },
  button: { minHeight: 48 },
});
