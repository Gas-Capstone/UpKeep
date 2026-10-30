import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Icon, Snackbar, Text } from "react-native-paper";
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
import { deleteWorkoutPlan, setWorkoutPlanImage } from "@/lib/supabaseFunctions";
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
  // Plan awaiting delete confirmation.
  const [deleteTarget, setDeleteTarget] = useState<Workout | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  // Plan id whose photo is uploading, so only that card's menu reads busy.
  const [photoUploadingId, setPhotoUploadingId] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState("");

  // Seeded plans have a null created_by and belong to everyone, so only the
  // author gets edit and delete.
  const ownsPlan = (workout: Workout) =>
    Boolean(user?.id) && workout.created_by === user?.id;

  // Each extra filter only appears when it's a real choice — or when it's
  // set, so an active filter can always be seen and cleared even if the
  // plans that offered it have since gone.
  const showSource = workoutList.some(ownsPlan) || filters.source !== "all";
  // Every goal tag on any plan. A plan can have several or none, so even a
  // single tag narrows the list.
  const goalOptions = [
    ...new Set(workoutList.flatMap((workout) => workout.goal_tags ?? [])),
  ].sort();
  const showGoal = goalOptions.length > 0 || filters.tag !== "all";
  const difficultyOptions = filterOptions(workoutList, "difficulty");
  const targetOptions = filterOptions(workoutList, "target");
  const showDifficulty = difficultyOptions.length > 1 || filters.difficulty !== null;
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
      // Backing out of the picker is not a failure, so it says nothing.
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
      // Only a denied permission tells the user something they can act on;
      // anything else is a storage or network fault they cannot fix from here.
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
          {/* Photo upload is started from a card menu, so there is no dialog
              to report back into — a snackbar is the only surface. */}
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

      <WeeklyProgress completedWorkouts={completedWorkouts} />

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
                    setFilters((current) => ({ ...current, source: source.value }))
                  }
                />
              ))
            : null}

          {showSource && (showGoal || showDifficulty || showTarget) ? (
            <View style={[styles.filterDivider, { backgroundColor: colors.border }]} />
          ) : null}

          {showGoal ? (
            <FilterMenuChip
              label="Goal"
              options={goalOptions}
              // "all" is how the filters spell no goal; the menu uses null.
              value={filters.tag === "all" ? null : filters.tag}
              onChange={(tag) => setFilters((current) => ({ ...current, tag: tag ?? "all" }))}
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
              onChange={(target) => setFilters((current) => ({ ...current, target }))}
              formatOption={sentenceCase}
            />
          ) : null}
        </ScrollView>
      ) : null}

      <View
        style={[
          styles.createCard,
          {
            backgroundColor: colors.brandSoft,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.createCopy}>
          <View
            style={[
              styles.createIcon,
              { backgroundColor: colors.backgroundElement },
            ]}
          >
            <Icon source="plus" size={24} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              variant="titleMedium"
              style={{ color: colors.text, fontWeight: "700" }}
            >
              Build your own plan
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: colors.textSecondary, marginTop: 2 }}
            >
              Choose exercises, sets, reps, and a target that works for you.
            </Text>
          </View>
        </View>

        <Button
          mode="contained"
          icon="plus"
          onPress={() => setCreateModalVisible(true)}
          buttonColor={colors.brandStrong}
          textColor="#FFFFFF"
          style={{ borderRadius: Radius.pill }}
        >
          Create Workout Plan
        </Button>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text
            variant="titleLarge"
            style={{ color: colors.text, fontWeight: "700" }}
          >
            {filters.tag === "all" ? "Your workouts" : sentenceCase(filters.tag)}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
            {loading
              ? "Loading workouts..."
              : `${filteredWorkouts.length} ${
                  filteredWorkouts.length === 1 ? "plan" : "plans"
                }`}
          </Text>
        </View>
      </View>

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
              style={[styles.emptyIcon, { backgroundColor: colors.brandSoft }]}
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
              equipment={formatEquipment(planEquipment.get(String(workout.id)))}
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
    width: 42,
    height: 42,
    borderRadius: Radius.medium,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  filterRow: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  // Splits "who made it" from "what it is" in the filter row.
  filterDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginVertical: Spacing.one,
  },
  createCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.large,
    padding: Spacing.three,
    gap: Spacing.three,
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
    alignItems: "flex-end",
    justifyContent: "space-between",
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
