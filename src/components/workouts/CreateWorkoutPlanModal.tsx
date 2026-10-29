import { useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  Button,
  Chip,
  HelperText,
  Icon,
  IconButton,
  List,
  Modal,
  Portal,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";

import { useThemeMode } from "@/components/context/ThemeContext";
import { Colors, Radius, Spacing } from "@/constants/theme";
import {
  newExerciseDraft,
  selectionFromDraft,
  type ExerciseAmountDraft,
} from "@/lib/workouts";
import type {
  NewWorkoutPlan,
  PlanWorkout,
  PlanWorkoutSelection,
} from "../context/workoutsDataContext";
import { ExercisePicker } from "./ExercisePicker";
import { ExerciseAmountFields } from "./ExerciseAmountFields";
import { Center } from "../ui/center";

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

export function CreateWorkoutPlanModal({
  visible,
  onDismiss,
  availableWorkouts,
  onCreate,
}: CreateWorkoutPlanModalProps) {
  const theme = useTheme();
  const [pickingExercises, setPickingExercises] = useState(false);
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  const [name, setName] = useState("");
  const [difficulty, setDifficulty] = useState(DIFFICULTIES[0]);
  const [target, setTarget] = useState("");
  const [durationMin, setDurationMin] = useState("30");
  const [selections, setSelections] = useState<
    Record<string, ExerciseAmountDraft>
  >({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedIds = Object.keys(selections);
  const workoutsById = new Map(availableWorkouts.map((workout) => [workout.id, workout]));

  const finishPicking = () => {
    Keyboard.dismiss();
    setPickingExercises(false);
  };

  const toggleWorkout = (workoutId: string) => {
    setSelections((current) => {
      if (current[workoutId]) {
        const next = { ...current };
        delete next[workoutId];
        return next;
      }

      return { ...current, [workoutId]: newExerciseDraft() };
    });
  };

  const updateSelection = (workoutId: string, draft: ExerciseAmountDraft) => {
    setSelections((current) => ({ ...current, [workoutId]: draft }));
  };

  const resetForm = () => {
    setPickingExercises(false);
    setName("");
    setDifficulty(DIFFICULTIES[0]);
    setTarget("");
    setDurationMin("30");
    setSelections({});
    setError("");
  };

  const handleDismiss = () => {
    if (saving) return;
    resetForm();
    onDismiss();
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Plan name is required.");
      return;
    }

    if (selectedIds.length === 0) {
      setError("Choose at least one exercise.");
      return;
    }

    const minutes = Number(durationMin);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setError("Expected time must be a number greater than 0.");
      return;
    }

    setError("");
    setSaving(true);

    const payload: PlanWorkoutSelection[] = selectedIds.map((workoutId) =>
      selectionFromDraft(workoutId, selections[workoutId]),
    );

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
      setError("Couldn't save your plan. Please try again.");
      return;
    }

    resetForm();
    onDismiss();
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={pickingExercises ? finishPicking : handleDismiss}
        contentContainerStyle={styles.modalOuter}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardWrap}
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.backgroundElement,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <View style={styles.titleRow}>
                  <View
                    style={[
                      styles.titleIcon,
                      { backgroundColor: colors.brandSoft },
                    ]}
                  >
                    <Icon
                      source="clipboard-text-outline"
                      size={21}
                      color={colors.brand}
                    />
                  </View>
                  <Text
                    variant="titleLarge"
                    style={[styles.title, { color: colors.text }]}
                  >
                    {pickingExercises ? "Choose exercises" : "New workout plan"}
                  </Text>
                </View>

              </View>
            </View>

            {pickingExercises ? (
              <ExercisePicker
                exercises={availableWorkouts}
                selectedIds={selectedIds}
                onToggle={toggleWorkout}
              />
            ) : (
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.section}>
                  <View style={styles.sectionHeadingRow}>
                    <Text
                      variant="titleMedium"
                      style={[styles.sectionTitle, { color: colors.text }]}
                    >
                      Plan details
                    </Text>
                    <Text
                      variant="labelSmall"
                      style={{ color: colors.textSecondary }}
                    >
                      Required basics
                    </Text>
                  </View>

                  <TextInput
                    label="Plan name"
                    accessibilityLabel="Plan name"
                    mode="outlined"
                    value={name}
                    onChangeText={setName}
                    outlineColor={colors.border}
                    activeOutlineColor={colors.brand}
                  />

                  <TextInput
                    label="Target (e.g. Upper body)"
                    accessibilityLabel="Plan target"
                    mode="outlined"
                    value={target}
                    onChangeText={setTarget}
                    outlineColor={colors.border}
                    activeOutlineColor={colors.brand}
                  />

                  <TextInput
                    label="Expected time (minutes)"
                    accessibilityLabel="Expected time in minutes"
                    mode="outlined"
                    keyboardType="numeric"
                    value={durationMin}
                    onChangeText={setDurationMin}
                    outlineColor={colors.border}
                    activeOutlineColor={colors.brand}
                  />

                  <View style={styles.fieldGroup}>
                    <Text variant="labelLarge" style={{ color: colors.text }}>
                      Difficulty
                    </Text>
                    <View style={styles.chipRow}>
                      {DIFFICULTIES.map((level) => {
                        const selected = difficulty === level;
                        return (
                          <Chip
                            key={level}
                            selected={selected}
                            showSelectedCheck={false}
                            onPress={() => setDifficulty(level)}
                            style={{
                              backgroundColor: selected
                                ? colors.backgroundSelected
                                : colors.background,
                              borderColor: selected
                                ? colors.brand
                                : colors.border,
                            }}
                            textStyle={{
                              color: selected ? colors.brandStrong : colors.text,
                              fontWeight: selected ? "700" : "500",
                            }}
                          >
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </Chip>
                        );
                      })}
                    </View>
                  </View>
                </View>

                <View
                  style={[
                    styles.section,
                    styles.exerciseSection,
                    { borderTopColor: colors.border },
                  ]}
                >
                  <View style={styles.sectionHeadingRow}>
                    <View>
                      <Text
                        variant="titleMedium"
                        style={[styles.sectionTitle, { color: colors.text }]}
                      >
                        Exercises
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.countBadge,
                        { backgroundColor: colors.brandSoft },
                      ]}
                    >
                      <Text
                        variant="labelMedium"
                        style={{ color: colors.brandStrong, fontWeight: "800" }}
                      >
                        {selectedIds.length} selected
                      </Text>
                    </View>
                  </View>

                  <Button
                    mode="outlined"
                    icon="magnify"
                    onPress={() => {
                      Keyboard.dismiss();
                      setPickingExercises(true);
                    }}
                  >
                    {selectedIds.length ? "Add or change exercises" : "Choose exercises"}
                  </Button>
                  {selectedIds.length === 0 ? (
                    <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
                      Search the catalog by name, muscle group, or equipment.
                    </Text>
                  ) : (
                    <View style={styles.exerciseList}>
                      {selectedIds.map((workoutId) => {
                        const workout = workoutsById.get(workoutId);
                        const entry = selections[workoutId];
                        if (!workout || !entry) return null;
                        return (
                          <View
                            key={workoutId}
                            style={[
                              styles.exerciseCard,
                              { backgroundColor: colors.background, borderColor: colors.border },
                            ]}
                          >
                            <List.Item
                              title={workout.name}
                              titleNumberOfLines={3}
                              description={[workout.muscle_group, workout.equipment].filter(Boolean).join(" · ")}
                              descriptionNumberOfLines={2}
                              right={() => (
                                <IconButton
                                  icon="close"
                                  accessibilityLabel={`Remove ${workout.name}`}
                                  onPress={() => toggleWorkout(workoutId)}
                                />
                              )}
                            />
                            <View style={styles.amountFields}>
                              <ExerciseAmountFields
                                exerciseName={workout.name}
                                draft={entry}
                                onChange={(draft) => updateSelection(workoutId, draft)}
                                outlineColor={colors.border}
                                activeOutlineColor={colors.brand}
                              />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              </ScrollView>
            )}

            {error && !pickingExercises ? (
              <Center>
              <HelperText type="error" visible style={styles.errorText}>
                {error}
              </HelperText>
              </Center>
            ) : null}

            <View style={[styles.actions, { borderTopColor: colors.border }]}>
              {pickingExercises ? (
                <Button mode="contained" onPress={finishPicking}>
                  Done ({selectedIds.length} selected)
                </Button>
              ) : (
                <>
                  <Button
                    mode="text"
                    onPress={handleDismiss}
                    disabled={saving}
                    textColor={colors.textSecondary}
                  >
                    Cancel
                  </Button>
                  <Button
                    mode="contained"
                    icon="check"
                    onPress={handleCreate}
                    loading={saving}
                    disabled={saving}
                    buttonColor={theme.colors.primary}
                    textColor={theme.colors.onPrimary}
                    style={styles.createButton}
                  >
                    Create plan
                  </Button>
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalOuter: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
  },
  keyboardWrap: {
    width: "100%",
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: 640,
    height: "100%",
    maxHeight: "100%",
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
  },
  headerCopy: {
    gap: Spacing.two,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  titleIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.medium,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flexShrink: 1,
    fontWeight: "800",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.three,
  },
  exerciseSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.four,
  },
  sectionHeadingRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.three,
  },
  sectionTitle: {
    fontWeight: "800",
  },
  fieldGroup: {
    gap: Spacing.two,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  countBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
  },
  exerciseList: {
    gap: Spacing.two,
  },
  exerciseCard: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.two,
  },
  amountFields: {
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.two,
  },
  errorText: {
    marginBottom: Spacing.one,
    fontSize: 15,
    fontWeight: 800,
  },
  actions: {
    minHeight: 70,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: Spacing.two,
  },
  createButton: {
    borderRadius: Radius.pill,
  },
});
