import { useState } from "react";
import {
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
  Modal,
  Portal,
  Text,
  TextInput,
} from "react-native-paper";

import { useThemeMode } from "@/components/context/ThemeContext";
import { Colors, Radius, Spacing } from "@/constants/theme";
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
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  const [name, setName] = useState("");
  const [difficulty, setDifficulty] = useState(DIFFICULTIES[0]);
  const [target, setTarget] = useState("");
  const [durationMin, setDurationMin] = useState("30");
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
        [workoutId]: {
          sets: String(DEFAULT_SETS),
          reps: String(DEFAULT_REPS),
        },
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
    if (saving) return;
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
        onDismiss={handleDismiss}
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
                    New workout plan
                  </Text>
                </View>
                <Text
                  variant="bodySmall"
                  style={{ color: colors.textSecondary }}
                >
                  Set the basics, then choose the exercises you want in the
                  plan.
                </Text>
              </View>
            </View>

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
                  mode="outlined"
                  value={name}
                  onChangeText={setName}
                  outlineColor={colors.border}
                  activeOutlineColor={colors.brand}
                />

                <TextInput
                  label="Target (e.g. Upper body)"
                  mode="outlined"
                  value={target}
                  onChangeText={setTarget}
                  outlineColor={colors.border}
                  activeOutlineColor={colors.brand}
                />

                <TextInput
                  label="Expected time (minutes)"
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
                    <Text
                      variant="bodySmall"
                      style={{ color: colors.textSecondary, marginTop: 2 }}
                    >
                      Tap an exercise to include it.
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

                {availableWorkouts.length === 0 ? (
                  <View
                    style={[
                      styles.emptyBox,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Icon
                      source="dumbbell"
                      size={24}
                      color={colors.textSecondary}
                    />
                    <Text
                      variant="bodyMedium"
                      style={{ color: colors.textSecondary }}
                    >
                      No workouts are available to add yet.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.exerciseList}>
                    {availableWorkouts.map((workout) => {
                      const entry = selections[workout.id];
                      const isSelected = Boolean(entry);

                      return (
                        <View
                          key={workout.id}
                          style={[
                            styles.exerciseCard,
                            {
                              backgroundColor: isSelected
                                ? colors.brandSoft
                                : colors.background,
                              borderColor: isSelected
                                ? colors.brand
                                : colors.border,
                            },
                          ]}
                        >
                          <Chip
                            selected={isSelected}
                            showSelectedCheck
                            onPress={() => toggleWorkout(workout.id)}
                            style={{
                              alignSelf: "stretch",
                              backgroundColor: "transparent",
                            }}
                            textStyle={{
                              color: colors.text,
                              fontWeight: isSelected ? "700" : "600",
                            }}
                          >
                            {workout.name}
                            {workout.muscle_group
                              ? ` · ${workout.muscle_group}`
                              : ""}
                          </Chip>

                          {isSelected ? (
                            <View style={styles.repsRow}>
                              <TextInput
                                label="Sets"
                                mode="outlined"
                                dense
                                keyboardType="numeric"
                                style={styles.repsInput}
                                value={entry.sets}
                                onChangeText={(text) =>
                                  updateSelection(workout.id, "sets", text)
                                }
                                outlineColor={colors.border}
                                activeOutlineColor={colors.brand}
                              />
                              <TextInput
                                label="Reps"
                                mode="outlined"
                                dense
                                keyboardType="numeric"
                                style={styles.repsInput}
                                value={entry.reps}
                                onChangeText={(text) =>
                                  updateSelection(workout.id, "reps", text)
                                }
                                outlineColor={colors.border}
                                activeOutlineColor={colors.brand}
                              />
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </ScrollView>

            {error ? (
              <HelperText type="error" visible style={styles.errorText}>
                {error}
              </HelperText>
            ) : null}

            <View style={[styles.actions, { borderTopColor: colors.border }]}>
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
                buttonColor={colors.brandStrong}
                textColor="#FFFFFF"
                style={styles.createButton}
              >
                Create plan
              </Button>
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
    alignItems: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: 640,
    maxHeight: "88%",
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
    fontWeight: "800",
  },
  scroll: {
    flexGrow: 0,
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
  repsRow: {
    flexDirection: "row",
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.two,
  },
  repsInput: {
    flex: 1,
  },
  emptyBox: {
    minHeight: 110,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    padding: Spacing.four,
  },
  errorText: {
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.one,
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
