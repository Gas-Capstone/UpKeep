import { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  Card,
  Divider,
  HelperText,
  Icon,
  IconButton,
  List,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

import { useWeightUnit } from "@/components/context/UnitsContext";
import { Radius, Spacing } from "@/constants/theme";
import {
  beatsRecord,
  formatRecord,
  type ExerciseRecords,
} from "@/lib/personalRecords";
import { differsFromPlan } from "@/lib/planOverrides";
import { displayWeight, formatThousands, maxWeight, toKg } from "@/lib/units";
import {
  formatExerciseTarget,
  type ExerciseProgress,
  type PlanExercise,
} from "@/lib/workouts";

type Props = {
  exercise: PlanExercise;
  progress: ExerciseProgress;
  // The user's best on this exercise from earlier sessions, if any.
  record?: ExerciseRecords;
  disabled: boolean;
  trackingDisabled: boolean;
  onViewDetails: () => void;
  onChange: (progress: ExerciseProgress) => void;
};

export function SessionExerciseCard({
  exercise,
  progress,
  record,
  disabled,
  trackingDisabled,
  onViewDetails,
  onChange,
}: Props) {
  const theme = useTheme();
  // Weights are kept in kilograms and shown and typed in this unit.
  const { weightUnit } = useWeightUnit();
  // Timed exercises (cardio, holds) are edited in the unit the plan uses:
  // minutes when it's a whole number of them, otherwise seconds.
  const timed = progress.durationSec !== null;
  const unitSec = exercise.durationSec !== null && exercise.durationSec % 60 === 0 ? 60 : 1;
  const unitLabel = unitSec === 60 ? "Minutes" : "Seconds";
  const [editing, setEditing] = useState(false);
  const [sets, setSets] = useState(String(progress.sets));
  const [reps, setReps] = useState(String(progress.reps));
  const [duration, setDuration] = useState(
    progress.durationSec === null ? "" : String(Math.round(progress.durationSec / unitSec)),
  );
  const weightField = () =>
    progress.weightKg === null ? "" : String(displayWeight(progress.weightKg, weightUnit));
  const [weight, setWeight] = useState(weightField);
  const [edited, setEdited] = useState(false);
  const [weightEdited, setWeightEdited] = useState(false);
  const setsValue = Number(sets);
  const repsValue = Number(reps);
  const durationValue = Number(duration);
  const weightValue = weight.trim() === "" ? null : Number(weight.replace(",", "."));
  const setsValid = /^\d+$/.test(sets) && setsValue >= 1 && setsValue <= 999;
  const repsValid = /^\d+$/.test(reps) && repsValue >= 1 && repsValue <= 999;
  const durationValid = /^\d+$/.test(duration) && durationValue >= 1 && durationValue <= 999;
  const weightValid = weightValue === null || (Number.isFinite(weightValue) && weightValue >= 0 && weightValue <= maxWeight(weightUnit));
  const valid = setsValid && (timed ? durationValid : repsValid && weightValid);
  const done = progress.sets - progress.setsRemaining;
  const recordText = formatRecord(progress, record, { unit: weightUnit });
  const newRecord = beatsRecord(progress, record);
  const recordColor = newRecord ? theme.colors.primary : theme.colors.onSurfaceVariant;

  // Back to the plan's sets and reps (or set length), keeping the sets
  // already logged and the weight.
  const resetToPlan = () => {
    if (disabled) return;
    const remaining = Math.max(0, exercise.sets - done);
    onChange({
      ...progress,
      sets: exercise.sets,
      reps: exercise.reps,
      durationSec: exercise.durationSec,
      setsRemaining: remaining,
      completed: remaining === 0,
    });
    setEdited(false);
    setEditing(false);
  };

  const apply = () => {
    if (!valid || disabled) return;
    const remaining = Math.max(0, setsValue - done);
    onChange({
      ...progress,
      sets: setsValue,
      ...(timed
        ? { durationSec: durationValue * unitSec }
        : { reps: repsValue, weightKg: weightEdited
          ? (weightValue === null ? null : toKg(weightValue, weightUnit))
          : progress.weightKg 

        }),
      setsRemaining: remaining,
      completed: remaining === 0,
    });
    setEdited(false);
    setEditing(false);
  };

  // The fields start from the current values each time, so they're in the
  // weight unit chosen now even if it changed since this card appeared.
  const toggleEditor = () => {
    if (!editing) {
      setSets(String(progress.sets));
      setReps(String(progress.reps));
      setDuration(
        progress.durationSec === null ? "" : String(Math.round(progress.durationSec / unitSec)),
      );
      setWeight(weightField());
      setEdited(false);
      setWeightEdited(false);
    }
    setEditing(!editing);
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
        description={formatExerciseTarget(progress, { unit: weightUnit })}
        descriptionNumberOfLines={2}
        onPress={onViewDetails}
        accessibilityLabel={`View details for ${exercise.name}, ${formatExerciseTarget(progress, { spoken: true, unit: weightUnit })}`}
        left={(props) => (
          <List.Icon
            {...props}
            color={progress.completed ? theme.colors.primary : theme.colors.onSurfaceVariant}
            icon={progress.completed ? "check-circle-outline" : timed ? "timer-outline" : "dumbbell"}
          />
        )}
        right={(props) => <List.Icon {...props} icon="information-outline" />}
      />

      <Card.Content style={styles.tracking}>
        {recordText !== null && (
          <View
            style={styles.recordRow}
            accessible
            accessibilityLabel={
              newRecord
                ? `New personal record. Beat your previous best of ${formatRecord(progress, record, { spoken: true, unit: weightUnit })}`
                : `Personal record: ${formatRecord(progress, record, { spoken: true, unit: weightUnit })}`
            }
          >
            <Icon source={newRecord ? "trophy" : "trophy-outline"} size={16} color={recordColor} />
            <Text
              variant="labelMedium"
              style={{ color: recordColor, fontWeight: newRecord ? "700" : "500", flex: 1 }}
            >
              {newRecord ? `New PR · beat ${recordText}` : `PR ${recordText}`}
            </Text>
          </View>
        )}

        <View style={styles.progressRow}>
          <Text
            variant="labelLarge"
            style={[styles.progressText, { color: theme.colors.onSurface }]}
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
            onPress={toggleEditor}
            accessibilityLabel={
              timed
                ? `Edit sets and ${unitLabel.toLowerCase()} for ${exercise.name}`
                : `Edit sets, reps and weight for ${exercise.name}`
            }
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

              {timed ? (
                <TextInput
                  mode="outlined"
                  label={`${unitLabel} per set`}
                  accessibilityLabel={`${unitLabel} per set`}
                  value={duration}
                  onChangeText={(value) => { setDuration(value); setEdited(true); }}
                  keyboardType="number-pad"
                  error={!durationValid}
                  style={styles.field}
                />
              ) : (
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
              )}
            </View>

            {!timed && (
              <TextInput
                mode="outlined"
                label={`Weight (${weightUnit}, optional)`}
                accessibilityLabel={`Weight in ${weightUnit === "kg" ? "kilograms" : "pounds"}, optional`}
                value={weight}
                onChangeText={(value) => { setWeight(value); setEdited(true); setWeightEdited(true);}}
                keyboardType="decimal-pad"
                error={!weightValid}
              />
            )}

            {!valid && (
              <HelperText type="error">
                {timed
                  ? `Sets and ${unitLabel.toLowerCase()} must be whole numbers from 1–999.`
                  : `Sets and reps must be whole numbers from 1–999. Weight must be 0–${formatThousands(maxWeight(weightUnit))} ${weightUnit} or blank.`}
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

            {differsFromPlan(exercise, progress) && (
              <Button
                mode="text"
                icon="restore"
                onPress={resetToPlan}
                contentStyle={styles.button}
                accessibilityLabel={`Reset ${exercise.name} to the plan's sets and reps`}
              >
                Reset to plan
              </Button>
            )}
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.medium, overflow: "hidden" },
  tracking: { gap: Spacing.one, paddingBottom: Spacing.two },
  recordRow: { flexDirection: "row", alignItems: "center", gap: Spacing.one },
  progressRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: Spacing.two },
  // The line to read at a glance mid-set, so it's bold.
  progressText: { flexGrow: 1, flexBasis: 110, fontWeight: "700" },
  actions: { flexDirection: "row", alignItems: "center", gap: Spacing.two },
  undo: { margin: 0, width: 48, height: 48 },
  editButton: { alignSelf: "flex-start" },
  editLabel: { marginHorizontal: Spacing.two, marginVertical: Spacing.one },
  editor: { gap: Spacing.three, paddingBottom: Spacing.two },
  fields: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  field: { flex: 1, minWidth: 100 },
  button: { minHeight: 48 },
});
