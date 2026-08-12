import { useState, useEffect, useCallback } from "react";
import type { NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { useUserContext } from "../context/userContext";
import { useWorkoutSessionContext } from "../context/workoutSessionContext";
import { useWorkoutsData, Workout } from "../context/workoutsDataContext";
import { setWorkoutComplete } from "@/lib/supabaseFunctions";
import { WorkoutCard } from "./WorkoutCard";
import { ScreenView } from "../ui/ScreenView";
import { useRouter, usePathname, useFocusEffect } from "expo-router";
import { Chip, Divider } from "react-native-paper";
import { styles } from "@/constants/styles";
import { HStack } from "../ui/hstack";
import { WorkoutFilterChip } from "./WorkoutFilterChip";
import { getWorkoutsWithTag, sortFavoritesFirst } from "@/lib/workouts";
import { ScrollView } from "react-native";
import { Spacing, TopBadgeInset } from "@/constants/theme";
import { WorkoutsAnimatedFAB } from "./WorkoutsAnimatedFAB";
import { CompletedWorkoutsModal } from "./CompletedWorkoutsModal";
import { StartWorkoutModal } from "./StartWorkoutModal";
import { CreateWorkoutPlanModal } from "./CreateWorkoutPlanModal";
import { Button } from "react-native-paper";
import { VStack } from "../ui/vstack";

export default function WorkoutsPage() {
  const router = useRouter();
  const { user } = useUserContext();
  const { startSession } = useWorkoutSessionContext();
  // workoutList/completedWorkouts now live in workoutsDataContext so index.tsx can read the same data.
  const {
    workoutList,
    completedWorkouts,
    favoriteIds,
    availableWorkouts,
    refreshWorkouts,
    refreshCompletedWorkouts,
    toggleFavorite,
    createPlan,
  } = useWorkoutsData();
  const [workoutTags, setWorkoutTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [fabExtended, setFabExtended] = useState(true);
  const [completedModalVisible, setCompletedModalVisible] = useState(false);
  const [startModalVisible, setStartModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  // null (rather than {}) so we can check "is a workout selected" with a plain truthiness check TS can narrow on.
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);

  const onScroll = ({
    nativeEvent,
  }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentPos = Math.floor(nativeEvent?.contentOffset?.y) ?? 0;
    setFabExtended(currentPos <= 0);
  };

  const setFilter = (tag: string) => {
    setSelectedTag(tag);
  };

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

  // Derive filter tags from the shared workout list whenever it changes, rather than only at fetch time.
  useEffect(() => {
    const tags = [
      ...new Set(workoutList.flatMap((workout) => workout.goal_tags ?? [])),
    ].sort();
    setWorkoutTags(tags);
  }, [workoutList]);


  useFocusEffect(
    // grabs completed workouts whenever page is focused
    useCallback(() => {
      if (!user?.id) return;
      refreshCompletedWorkouts();
    }, [user?.id, refreshCompletedWorkouts]),
  );

  const filteredWorkouts = sortFavoritesFirst(
    getWorkoutsWithTag(workoutList, selectedTag),
    favoriteIds,
  );
  return (
    <>
      {/* TODO:
            1. add workout display cards DONE
            2. add ability to filter workouts DONE
            3. add ability to add workout to "completed" WIP
            4. add ability to view completed workouts DONE
            5. add "settings" modal before starting workout DONE
            6. add workout timer WIP
            7. Add calendar
            */}
      <ScreenView
        onScroll={onScroll}
        overlay={
          <>
            <WorkoutsAnimatedFAB
              extended={fabExtended}
              onPress={() => setCompletedModalVisible(true)}
            />
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
                onStart={(workout, mins) => handleTimer(workout, mins)}
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
        header={
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{
                flexGrow: 0,
                paddingTop: TopBadgeInset,
                paddingBottom: Spacing.two,
              }}
              contentContainerStyle={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingHorizontal: Spacing.four,
              }}
            >
              {workoutTags.map((tag) => (
                <WorkoutFilterChip
                  key={tag}
                  tag={tag}
                  isSelected={selectedTag === tag}
                  onSelect={(tag: string) => setFilter(tag)}
                />
              ))}
            </ScrollView>
            <Divider bold style={{ width: "100%" }}></Divider>
          </>
        }
      >
        <VStack space="md" style={{ alignSelf: "stretch" }}>
        <Button
          mode="contained-tonal"
          icon="plus"
          onPress={() => setCreateModalVisible(true)}
        >
          Create Workout Plan
        </Button>
        {filteredWorkouts.map((workout) => (
          <WorkoutCard
            key={workout.id}
            workout={workout}
            onPress={() => handleStart(workout)}
            isFavorited={favoriteIds.has(String(workout.id))}
            onToggleFavorite={() => toggleFavorite(String(workout.id))}
          />
        ))}
        </VStack>
      </ScreenView>
    </>
  );
}
