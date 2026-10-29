import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Button,
  Chip,
  Divider,
  HelperText,
  IconButton,
  Text,
  TextInput,
} from "react-native-paper";

import { useWorkoutsData } from "@/components/context/workoutsDataContext";
import { Center } from "@/components/ui/center";
import { HStack } from "@/components/ui/hstack";
import { ScreenView } from "@/components/ui/ScreenView";
import { VStack } from "@/components/ui/vstack";
import { Spacing, TopBadgeInset } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  getPlanExercises,
  replacePlanExercises,
  updateWorkoutPlan,
} from "@/lib/supabaseFunctions";
import {
  draftFromPlanExercise,
  newExerciseDraft,
  selectionFromDraft,
  type ExerciseAmountDraft,
} from "@/lib/workouts";
import { ExerciseAmountFields } from "./ExerciseAmountFields";

const DIFFICULTIES = ["beginner", "intermediate", "advanced"];

// One row of the plan being edited: which exercise, and its sets and reps or
// set length.
type ExerciseDraft = ExerciseAmountDraft & { workoutId: string };

export default function EditWorkoutPlanScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workoutList, availableWorkouts, refreshWorkouts } = useWorkoutsData();

  const plan = useMemo(
    () => workoutList.find((w) => String(w.id) === String(id)),
    [workoutList, id],
  );

  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [difficulty, setDifficulty] = useState(DIFFICULTIES[0]);
  const [durationMin, setDurationMin] = useState("30");
  const [drafts, setDrafts] = useState<ExerciseDraft[]>([]);
  const [picking, setPicking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const nameById = useMemo(
    () => new Map(availableWorkouts.map((w) => [w.id, w.name])),
    [availableWorkouts],
  );

  // Seed the form from the plan once it's in the list, and load its exercises.
  useEffect(() => {
    if (!plan) return;
    setName(plan.name ?? "");
    setTarget(plan.target ?? "");
    setDifficulty(plan.difficulty || DIFFICULTIES[0]);
    setDurationMin(String(plan.duration_min ?? 30));
  }, [plan]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getPlanExercises(String(id)).then((exercises) => {
      if (cancelled) return;
      setDrafts(
        exercises.map((exercise) => ({
          workoutId: exercise.workoutId,
          ...draftFromPlanExercise(exercise),
        })),
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const chosenIds = useMemo(
    () => new Set(drafts.map((d) => d.workoutId)),
    [drafts],
  );

  const updateDraft = (workoutId: string, next: ExerciseAmountDraft) => {
    setDrafts((current) =>
      current.map((d) => (d.workoutId === workoutId ? { ...d, ...next } : d)),
    );
  };

  const removeExercise = (workoutId: string) => {
    setDrafts((current) => current.filter((d) => d.workoutId !== workoutId));
  };

  const addExercise = (workoutId: string) => {
    setDrafts((current) => [...current, { workoutId, ...newExerciseDraft() }]);
    setPicking(false);
  };

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setError("Give the plan a name.");
      return;
    }
    if (drafts.length === 0) {
      setError("A plan needs at least one exercise.");
      return;
    }
    const minutes = Number(durationMin);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setError("Expected time must be a number greater than 0.");
      return;
    }

    setError("");
    setSaving(true);

    const selections = drafts.map((draft) =>
      selectionFromDraft(draft.workoutId, draft),
    );

    const detailsOk = await updateWorkoutPlan(String(id), {
      name: name.trim(),
      difficulty,
      target: target.trim(),
      duration_min: minutes,
    });
    const exercisesOk = detailsOk
      ? await replacePlanExercises(String(id), selections)
      : false;

    setSaving(false);

    if (!detailsOk || !exercisesOk) {
      setError("Couldn't save your changes. Please try again.");
      return;
    }

    refreshWorkouts();
    router.back();
  }, [name, target, difficulty, durationMin, drafts, id, refreshWorkouts, router]);

  return (
    <ScreenView
      header={
        <VStack
          style={{
            width: "100%",
            paddingHorizontal: Spacing.four,
            paddingTop: TopBadgeInset,
            paddingBottom: Spacing.two,
          }}
        >
          <HStack style={{ alignItems: "center" }}>
            <IconButton
              icon="arrow-left"
              size={24}
              style={{ margin: 0 }}
              onPress={() => router.back()}
              accessibilityLabel="Back"
            />
            <Text variant="titleLarge" style={{ marginLeft: Spacing.two, flex: 1 }}>
              Edit plan
            </Text>
          </HStack>
        </VStack>
      }
    >
      <VStack space="md" style={{ alignSelf: "stretch" }}>
        {loading ? (
          <Center style={{ paddingVertical: Spacing.five }}>
            <ActivityIndicator />
          </Center>
        ) : !plan ? (
          <Text style={{ color: theme.textSecondary }}>
            That plan couldn&apos;t be found.
          </Text>
        ) : (
          <>
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
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </Chip>
                ))}
              </HStack>
            </VStack>

            <Divider bold />

            <VStack space="sm" style={{ alignSelf: "stretch" }}>
              <Text variant="titleMedium">Exercises ({drafts.length})</Text>

              {drafts.map((draft, index) => {
                const exerciseName =
                  nameById.get(draft.workoutId) ?? "Unknown exercise";
                return (
                  <View key={draft.workoutId}>
                    {index > 0 && <Divider />}
                    <VStack space="xs" style={{ paddingVertical: Spacing.two }}>
                      <HStack style={{ alignItems: "center" }}>
                        <Text
                          variant="bodyLarge"
                          numberOfLines={2}
                          style={{ flex: 1, minWidth: 0, paddingRight: Spacing.two }}
                        >
                          {exerciseName}
                        </Text>
                        <IconButton
                          icon="close"
                          size={18}
                          style={{ margin: 0 }}
                          onPress={() => removeExercise(draft.workoutId)}
                          accessibilityLabel={`Remove ${exerciseName}`}
                        />
                      </HStack>

                      <ExerciseAmountFields
                        exerciseName={exerciseName}
                        draft={draft}
                        onChange={(next) => updateDraft(draft.workoutId, next)}
                      />
                    </VStack>
                  </View>
                );
              })}

              {/* The picker only offers exercises not already in the plan, so
                  the same one can't be added twice. */}
              {picking ? (
                <VStack space="xs" style={{ alignSelf: "stretch" }}>
                  <HStack space="sm" style={{ flexWrap: "wrap" }}>
                    {availableWorkouts
                      .filter((w) => !chosenIds.has(w.id))
                      .map((w) => (
                        <Chip key={w.id} onPress={() => addExercise(w.id)}>
                          {w.name}
                        </Chip>
                      ))}
                  </HStack>
                  <Button compact onPress={() => setPicking(false)}>
                    Cancel
                  </Button>
                </VStack>
              ) : (
                <Button
                  compact
                  icon="plus"
                  style={{ alignSelf: "flex-start" }}
                  onPress={() => setPicking(true)}
                >
                  Add exercise
                </Button>
              )}
            </VStack>

            {error !== "" && (
              <HelperText type="error" visible>
                {error}
              </HelperText>
            )}

            <Button
              mode="contained"
              onPress={handleSave}
              loading={saving}
              disabled={saving}
            >
              Save changes
            </Button>
          </>
        )}
      </VStack>
    </ScreenView>
  );
}
