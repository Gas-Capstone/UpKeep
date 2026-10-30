import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  Button,
  Card,
  Icon,
  Snackbar,
  Text,
  useTheme,
} from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";

import { useThemeMode } from "@/components/context/ThemeContext";
import { useScreenInteractive } from "@/components/context/startupContext";
import { useUserContext } from "@/components/context/userContext";
import { useWorkoutSessionContext } from "@/components/context/workoutSessionContext";
import { AddHabitModal } from "@/components/habits/AddHabitModal";
import {
  useWorkoutsData,
  type Workout,
} from "@/components/context/workoutsDataContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ScreenView } from "@/components/ui/ScreenView";
import { Colors, Radius, Spacing } from "@/constants/theme";
import {
  deleteWorkoutPlan,
  setWorkoutPlanImage,
} from "@/lib/supabaseFunctions";
import { pickImage, uploadUserImage } from "@/lib/userImages";
import {
  NO_FILTERS,
  filterOptions,
  filterWorkouts,
  formatEquipment,
  formatLastDone,
  hasActiveFilters,
  lastDoneByPlan,
  sentenceCase,
  type PlanSource,
  type WorkoutFilters,
} from "@/lib/workoutList";
import { sortFavoritesFirst } from "@/lib/workouts";

import { CompletedWorkoutsModal } from "./CompletedWorkoutsModal";
import { CreateWorkoutPlanModal } from "./CreateWorkoutPlanModal";
import { EditWorkoutPlanModal } from "./EditWorkoutPlanModal";
import { FilterMenuChip } from "./FilterMenuChip";
import { WeeklyProgress } from "./WeeklyProgress";
import { WorkoutCard } from "./WorkoutCard";
import { WorkoutFilterChip } from "./WorkoutFilterChip";

const SOURCES: { value: PlanSource; label: string }[] = [
  { value: "all", label: "All plans" },
  { value: "mine", label: "Mine" },
  { value: "built-in", label: "Built-in" },
];

export default function WorkoutsPage() {
  const router = useRouter();
  const paperTheme = useTheme();
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];
  const { user } = useUserContext();
  const { startSession } = useWorkoutSessionContext();

  const {
    workoutList,
    completedWorkouts,
    favoriteIds,
    availableWorkouts,
    planEquipment,
    loading,
    refreshWorkouts,
    refreshCompletedWorkouts,
    toggleFavorite,
    createPlan,
    scheduleWorkout,
  } = useWorkoutsData();
  useScreenInteractive(!loading);

  const [filters, setFilters] = useState<WorkoutFilters>(NO_FILTERS);
  const [completedModalVisible, setCompletedModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Workout | null>(null);
  // Plan being added to the Habits page schedule, or null when closed.
  const [scheduleTarget, setScheduleTarget] = useState<Workout | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Workout | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [photoUploadingId, setPhotoUploadingId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState("");

  const ownsPlan = (workout: Workout) =>
    Boolean(user?.id) && workout.created_by === user?.id;

  const showSource = workoutList.some(ownsPlan) || filters.source !== "all";
  const goalOptions = [
    ...new Set(workoutList.flatMap((workout) => workout.goal_tags ?? [])),
  ].sort();
  const showGoal = goalOptions.length > 0 || filters.tag !== "all";
  const difficultyOptions = filterOptions(workoutList, "difficulty");
  const targetOptions = filterOptions(workoutList, "target");
  const showDifficulty =
    difficultyOptions.length > 1 || filters.difficulty !== null;
  const showTarget = targetOptions.length > 1 || filters.target !== null;

  const lastDone = lastDoneByPlan(completedWorkouts);
  const lastDoneLabel = (workout: Workout) => {
    const at = lastDone.get(String(workout.id));
    return at === undefined ? null : formatLastDone(at);
  };

  const changePhoto = async (workout: Workout) => {
    if (!user?.id) return;
    setPhotoError("");

    try {
      const uri = await pickImage();
      if (!uri) return;

      setPhotoUploadingId(String(workout.id));
      const url = await uploadUserImage({
        uri,
        userId: user.id,
        kind: "workouts",
        itemId: String(workout.id),
      });
      await setWorkoutPlanImage(String(workout.id), url);
      refreshWorkouts();
    } catch (error) {
      setPhotoError(
        error instanceof Error && error.message.startsWith("Photo access")
          ? error.message
          : "Couldn't update that photo. Please try again.",
      );
    } finally {
      setPhotoUploadingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError("");
    setDeleting(true);
    const ok = await deleteWorkoutPlan(String(deleteTarget.id));
    setDeleting(false);
    if (!ok) {
      setDeleteError("Couldn't delete that plan. Please try again.");
      return;
    }
    setDeleteTarget(null);
    refreshWorkouts();
  };

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      refreshCompletedWorkouts();
    }, [user?.id, refreshCompletedWorkouts]),
  );

  const filteredWorkouts = useMemo(
    () =>
      sortFavoritesFirst(
        filterWorkouts(workoutList, filters, user?.id),
        favoriteIds,
      ),
    [workoutList, filters, user?.id, favoriteIds],
  );

  const handleStart = (workout: Workout) => {
    startSession(workout);
    router.navigate({
      pathname: "/workouttimer",
      params: { workoutId: String(workout.id) },
    });
  };

  return (
    <ScreenView
      contentContainerStyle={{ gap: Spacing.four }}
      overlay={
        <>
          <Snackbar
            visible={photoError !== ""}
            onDismiss={() => setPhotoError("")}
            duration={4000}
          >
            {photoError}
          </Snackbar>

          <CompletedWorkoutsModal
            visible={completedModalVisible}
            onDismiss={() => setCompletedModalVisible(false)}
            workouts={completedWorkouts}
          />

          {scheduleTarget ? (
            <AddHabitModal
              key={String(scheduleTarget.id)}
              visible
              onDismiss={() => setScheduleTarget(null)}
              initialWorkout={scheduleTarget}
              onSaveWorkout={scheduleWorkout}
            />
          ) : null}

          <CreateWorkoutPlanModal
            visible={createModalVisible}
            onDismiss={() => setCreateModalVisible(false)}
            availableWorkouts={availableWorkouts}
            onCreate={createPlan}
          />

          {editTarget ? (
            <EditWorkoutPlanModal
              key={String(editTarget.id)}
              plan={editTarget}
              onDismiss={() => setEditTarget(null)}
            />
          ) : null}

          <ConfirmDialog
            visible={deleteTarget !== null}
            title="Delete plan?"
            message={`${deleteTarget?.name ?? "This plan"} and its exercises will be removed. Workouts you already completed stay in your history, but will no longer show the plan's name. This can't be undone.`}
            confirmLabel="Delete"
            onConfirm={confirmDelete}
            onDismiss={() => setDeleteTarget(null)}
            loading={deleting}
            error={deleteError}
          />
        </>
      }
    >
      <View style={styles.headingRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <View
              style={[styles.titleIcon, { backgroundColor: colors.brandSoft }]}
            >
              <Icon source="dumbbell" size={22} color={colors.brand} />
            </View>
            <Text
              variant="headlineMedium"
              style={[styles.title, { color: colors.text }]}
            >
              Workouts
            </Text>
          </View>
          <Text
            variant="bodyMedium"
            style={{ color: colors.textSecondary, marginTop: Spacing.one }}
          >
            Find a plan that fits what you want to work on today.
          </Text>
        </View>

        <Button
          compact
          mode="text"
          icon="history"
          onPress={() => setCompletedModalVisible(true)}
          textColor={colors.brand}
          contentStyle={{ flexDirection: "row-reverse" }}
        >
          History
        </Button>
      </View>

      <View style={styles.workoutSection}>
        <View style={styles.sectionHeader}>
          <View>
            <Text
              variant="titleLarge"
              style={{ color: colors.text, fontWeight: "700" }}
            >
              {filters.tag === "all"
                ? "Your workouts"
                : sentenceCase(filters.tag)}
            </Text>
            <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
              {loading
                ? "Loading workouts..."
                : `${filteredWorkouts.length} ${
                    filteredWorkouts.length === 1 ? "plan" : "plans"
                  }`}
            </Text>
          </View>
          <Button
            mode="text"
            icon="plus"
            onPress={() => setCreateModalVisible(true)}
            textColor={colors.brand}
            contentStyle={styles.createAction}
          >
            Create plan
          </Button>
        </View>

        {showSource || showGoal || showDifficulty || showTarget ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -Spacing.four }}
            contentContainerStyle={styles.filterRow}
          >
            {showSource
              ? SOURCES.map((source) => (
                  <WorkoutFilterChip
                    key={source.value}
                    tag={source.value}
                    label={source.label}
                    isSelected={filters.source === source.value}
                    onSelect={() =>
                      setFilters((current) => ({
                        ...current,
                        source: source.value,
                      }))
                    }
                  />
                ))
              : null}

            {showSource && (showGoal || showDifficulty || showTarget) ? (
              <View
                style={[
                  styles.filterDivider,
                  { backgroundColor: colors.border },
                ]}
              />
            ) : null}

            {showGoal ? (
              <FilterMenuChip
                label="Goal"
                options={goalOptions}
                // "all" is how the filters spell no goal; the menu uses null.
                value={filters.tag === "all" ? null : filters.tag}
                onChange={(tag) =>
                  setFilters((current) => ({ ...current, tag: tag ?? "all" }))
                }
                formatOption={sentenceCase}
              />
            ) : null}

            {showDifficulty ? (
              <FilterMenuChip
                label="Difficulty"
                options={difficultyOptions}
                value={filters.difficulty}
                onChange={(difficulty) =>
                  setFilters((current) => ({ ...current, difficulty }))
                }
                formatOption={sentenceCase}
              />
            ) : null}

            {showTarget ? (
              <FilterMenuChip
                label="Target"
                options={targetOptions}
                value={filters.target}
                onChange={(target) =>
                  setFilters((current) => ({ ...current, target }))
                }
                formatOption={sentenceCase}
              />
            ) : null}
          </ScrollView>
        ) : null}

        <View style={styles.list}>
          {!loading && filteredWorkouts.length === 0 ? (
            <View
              style={[
                styles.emptyState,
                {
                  backgroundColor: colors.backgroundElement,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: colors.brandSoft },
                ]}
              >
                <Icon source="dumbbell" size={28} color={colors.brand} />
              </View>
              <Text
                variant="titleMedium"
                style={{ color: colors.text, fontWeight: "700" }}
              >
                No workouts here yet
              </Text>
              <Text
                variant="bodyMedium"
                style={{ color: colors.textSecondary, textAlign: "center" }}
              >
                Try another filter or create a workout plan of your own.
              </Text>
              {hasActiveFilters(filters) ? (
                <Button
                  mode="contained-tonal"
                  icon="filter-remove-outline"
                  onPress={() => setFilters(NO_FILTERS)}
                  style={{ marginTop: Spacing.one }}
                >
                  Clear filters
                </Button>
              ) : null}
            </View>
          ) : (
            filteredWorkouts.map((workout) => (
              <WorkoutCard
                key={workout.id}
                workout={workout}
                onPress={() => handleStart(workout)}
                isFavorited={favoriteIds.has(String(workout.id))}
                onToggleFavorite={() => toggleFavorite(String(workout.id))}
                onSchedule={() => setScheduleTarget(workout)}
                lastDone={lastDoneLabel(workout)}
                equipment={formatEquipment(
                  planEquipment.get(String(workout.id)),
                )}
                {...(ownsPlan(workout)
                  ? {
                      onChangePhoto: () => changePhoto(workout),
                      photoUploading: photoUploadingId === String(workout.id),
                      onEdit: () => setEditTarget(workout),
                      onDelete: () => setDeleteTarget(workout),
                    }
                  : {})}
              />
            ))
          )}
        </View>
      </View>

      <View style={styles.supportingSection}>
        <WeeklyProgress completedWorkouts={completedWorkouts} />
      </View>
    </ScreenView>
  );
}

const styles = StyleSheet.create({
  headingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.two,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  titleIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.medium,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontWeight: "900",
  },
  filterRow: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  filterDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginVertical: Spacing.one,
  },
  workoutSection: {
    gap: Spacing.three,
  },
  supportingSection: {
    marginTop: Spacing.two,
    gap: Spacing.three,
  },
  createCard: {
    borderRadius: Radius.medium,
  },
  createContent: {
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  createAction: {
    minHeight: Spacing.four * 2,
  },
  createCopy: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  createIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.medium,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  list: {
    gap: Spacing.three,
  },
  emptyState: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.large,
    padding: Spacing.four,
    alignItems: "center",
    gap: Spacing.two,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.one,
  },
});
