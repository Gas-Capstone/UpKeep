import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Icon, Text } from "react-native-paper";
import { useFocusEffect, useRouter } from "expo-router";

import { useThemeMode } from "@/components/context/ThemeContext";
import { useUserContext } from "@/components/context/userContext";
import { useWorkoutSessionContext } from "@/components/context/workoutSessionContext";
import {
  useWorkoutsData,
  type Workout,
} from "@/components/context/workoutsDataContext";
import { ScreenView } from "@/components/ui/ScreenView";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { getWorkoutsWithTag, sortFavoritesFirst } from "@/lib/workouts";

import { CompletedWorkoutsModal } from "./CompletedWorkoutsModal";
import { CreateWorkoutPlanModal } from "./CreateWorkoutPlanModal";
import { StartWorkoutModal } from "./StartWorkoutModal";
import { WorkoutCard } from "./WorkoutCard";
import { WorkoutFilterChip } from "./WorkoutFilterChip";

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
    loading,
    refreshCompletedWorkouts,
    toggleFavorite,
    createPlan,
  } = useWorkoutsData();

  const [workoutTags, setWorkoutTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState("all");
  const [completedModalVisible, setCompletedModalVisible] = useState(false);
  const [startModalVisible, setStartModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);

  useEffect(() => {
    const tags = [
      ...new Set(workoutList.flatMap((workout) => workout.goal_tags ?? [])),
    ].sort();
    setWorkoutTags(tags);
  }, [workoutList]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      refreshCompletedWorkouts();
    }, [user?.id, refreshCompletedWorkouts]),
  );

  const filteredWorkouts = useMemo(
    () =>
      sortFavoritesFirst(
        getWorkoutsWithTag(workoutList, selectedTag),
        favoriteIds,
      ),
    [workoutList, selectedTag, favoriteIds],
  );

  const handleStart = (workout: Workout) => {
    setSelectedWorkout(workout);
    setStartModalVisible(true);
  };

  const handleTimer = (workout: Workout, mins: number) => {
    startSession(workout, mins);
    setStartModalVisible(false);
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
          <CompletedWorkoutsModal
            visible={completedModalVisible}
            onDismiss={() => setCompletedModalVisible(false)}
            workouts={completedWorkouts}
          />

          {selectedWorkout && (
            <StartWorkoutModal
              visible={startModalVisible}
              onDismiss={() => setStartModalVisible(false)}
              workout={selectedWorkout}
              onStart={handleTimer}
            />
          )}

          <CreateWorkoutPlanModal
            visible={createModalVisible}
            onDismiss={() => setCreateModalVisible(false)}
            availableWorkouts={availableWorkouts}
            onCreate={createPlan}
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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -Spacing.four }}
        contentContainerStyle={styles.filterRow}
      >
        <WorkoutFilterChip
          tag="all"
          isSelected={selectedTag === "all"}
          onSelect={setSelectedTag}
        />
        {workoutTags.map((tag) => (
          <WorkoutFilterChip
            key={tag}
            tag={tag}
            isSelected={selectedTag === tag}
            onSelect={setSelectedTag}
          />
        ))}
      </ScrollView>

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
            {selectedTag === "all"
              ? "Your workouts"
              : `${selectedTag.charAt(0).toUpperCase()}${selectedTag.slice(1)}`}
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
          </View>
        ) : (
          filteredWorkouts.map((workout) => (
            <WorkoutCard
              key={workout.id}
              workout={workout}
              onPress={() => handleStart(workout)}
              isFavorited={favoriteIds.has(String(workout.id))}
              onToggleFavorite={() => toggleFavorite(String(workout.id))}
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
