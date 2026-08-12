import { useState } from "react";
import { ScrollView } from "react-native";
import {
  Button,
  Card,
  Chip,
  Divider,
  HelperText,
  Modal,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { styles } from "@/constants/styles";
import { HStack } from "../ui/hstack";
import { VStack } from "../ui/vstack";
import type {
  NewWorkoutPlan,
  PlanWorkout,
  PlanWorkoutSelection,
} from "../context/workoutsDataContext";

type CreateWorkoutPlanModalProps = {
  visible: boolean;
  onDismiss: () => void;
  availableWorkouts: PlanWorkout[];
  onCreate: (
    plan: NewWorkoutPlan,
    selections: PlanWorkoutSelection[],
  ) => Promise<boolean>;
};

const DIFFICULTIES = ["beginner", "intermediate", "advanced"];

const DEFAULT_SETS = 3;
const DEFAULT_REPS = 10;

export function CreateWorkoutPlanModal({
  visible,
  onDismiss,
  availableWorkouts,
  onCreate,
}: CreateWorkoutPlanModalProps) {
  const theme = useTheme();
  const [name, setName] = useState("");
  const [difficulty, setDifficulty] = useState(DIFFICULTIES[0]);
  const [target, setTarget] = useState("");
  const [durationMin, setDurationMin] = useState("30");
  // Keyed by workout id so toggling is O(1) and the sets/reps a user typed
  // survive re-renders of the picker list.
  const [selections, setSelections] = useState<
    Record<string, { sets: string; reps: string }>
  >({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedIds = Object.keys(selections);

  const toggleWorkout = (workoutId: string) => {
    setSelections((current) => {
      if (current[workoutId]) {
        const next = { ...current };
        delete next[workoutId];
        return next;
      }
      return {
        ...current,
        [workoutId]: { sets: String(DEFAULT_SETS), reps: String(DEFAULT_REPS) },
      };
    });
  };

  const updateSelection = (
    workoutId: string,
    field: "sets" | "reps",
    value: string,
  ) => {
    setSelections((current) => ({
      ...current,
      [workoutId]: { ...current[workoutId], [field]: value },
    }));
  };

  const resetForm = () => {
    setName("");
    setDifficulty(DIFFICULTIES[0]);
    setTarget("");
    setDurationMin("30");
    setSelections({});
    setError("");
  };

  const handleDismiss = () => {
    resetForm();
    onDismiss();
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Give your plan a name.");
      return;
    }
    if (selectedIds.length === 0) {
      setError("Pick at least one workout.");
      return;
    }

    const minutes = Number(durationMin);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setError("Expected time must be a number greater than 0.");
      return;
    }

    setError("");
    setSaving(true);

    // Blank or malformed sets/reps fall back to the defaults rather than
    // writing NaN into the database.
    const payload: PlanWorkoutSelection[] = selectedIds.map((workoutId) => {
      const entry = selections[workoutId];
      const sets = Number(entry.sets);
      const reps = Number(entry.reps);
      return {
        workout_id: workoutId,
        sets: Number.isFinite(sets) && sets > 0 ? sets : DEFAULT_SETS,
        reps: Number.isFinite(reps) && reps > 0 ? reps : DEFAULT_REPS,
      };
    });

    const ok = await onCreate(
      {
        name: name.trim(),
        difficulty,
        target: target.trim(),
        duration_min: minutes,
      },
      payload,
    );

    setSaving(false);

    if (!ok) {
      // Deliberately plain — database and permission failures belong in the
      // console, not in front of the user. Only validation messages above
      // tell them something they can actually act on.
      setError("Couldn't save your plan. Please try again.");
      return;
    }

    resetForm();
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      onDismiss={handleDismiss}
      contentContainerStyle={styles.modalContent}
    >
      <Card mode="contained" style={styles.modalCard}>
        <Card.Title title={<Text variant="titleLarge">New Workout Plan</Text>} />
        <Card.Content style={styles.stepContainer}>
          {/* The picker list can get long, so the body scrolls while the
              title and action buttons stay put. */}
          <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
            <VStack space="md" style={{ alignSelf: "stretch" }}>
              <TextInput
                label="Plan name"
                mode="outlined"
                value={name}
                onChangeText={setName}
              />

              <TextInput
                label="Target (e.g. Upper body)"
                mode="outlined"
                value={target}
                onChangeText={setTarget}
              />

              <TextInput
                label="Expected time (minutes)"
                mode="outlined"
                keyboardType="numeric"
                value={durationMin}
                onChangeText={setDurationMin}
              />

              <VStack space="sm" style={{ alignSelf: "stretch" }}>
                <Text variant="labelLarge">Difficulty</Text>
                <HStack space="sm" style={{ flexWrap: "wrap" }}>
                  {DIFFICULTIES.map((level) => (
                    <Chip
                      key={level}
                      selected={difficulty === level}
                      showSelectedCheck
                      onPress={() => setDifficulty(level)}
                      style={{ backgroundColor: theme.colors.background }}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </Chip>
                  ))}
                </HStack>
              </VStack>

              <Divider bold />

              <VStack space="sm" style={{ alignSelf: "stretch" }}>
                <Text variant="labelLarge">
                  Workouts {selectedIds.length > 0 && `(${selectedIds.length})`}
                </Text>

                {availableWorkouts.length === 0 && (
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    No workouts available to add yet.
                  </Text>
                )}

                {availableWorkouts.map((workout) => {
                  const entry = selections[workout.id];
                  const isSelected = Boolean(entry);

                  return (
                    <VStack
                      key={workout.id}
                      space="xs"
                      style={{ alignSelf: "stretch" }}
                    >
                      <Chip
                        selected={isSelected}
                        showSelectedCheck
                        onPress={() => toggleWorkout(workout.id)}
                        style={{ backgroundColor: theme.colors.background }}
                      >
                        {workout.name}
                        {workout.muscle_group ? ` · ${workout.muscle_group}` : ""}
                      </Chip>

                      {/* Sets/reps only appear once a workout is actually in
                          the plan, to keep the unselected list scannable. */}
                      {isSelected && (
                        <HStack space="sm" style={{ alignSelf: "stretch" }}>
                          <TextInput
                            label="Sets"
                            mode="outlined"
                            dense
                            keyboardType="numeric"
                            style={{ flex: 1 }}
                            value={entry.sets}
                            onChangeText={(text) =>
                              updateSelection(workout.id, "sets", text)
                            }
                          />
                          <TextInput
                            label="Reps"
                            mode="outlined"
                            dense
                            keyboardType="numeric"
                            style={{ flex: 1 }}
                            value={entry.reps}
                            onChangeText={(text) =>
                              updateSelection(workout.id, "reps", text)
                            }
                          />
                        </HStack>
                      )}
                    </VStack>
                  );
                })}
              </VStack>

            </VStack>
          </ScrollView>

          {/* Kept outside the ScrollView: inside it, a long workout list
              pushes the message off-screen and the failure looks like the
              button simply doing nothing. */}
          {error !== "" && (
            <HelperText type="error" visible>
              {error}
            </HelperText>
          )}
        </Card.Content>

        <Card.Actions>
          <HStack style={styles.rowBox}>
            <Button onPress={handleDismiss} disabled={saving}>
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleCreate}
              loading={saving}
              disabled={saving}
            >
              Create Plan
            </Button>
          </HStack>
        </Card.Actions>
      </Card>
    </Modal>
  );
}
