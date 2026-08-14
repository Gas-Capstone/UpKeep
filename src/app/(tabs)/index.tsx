import { useContext, useMemo } from "react";
import { StyleSheet } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Card,
  Chip,
  Text,
  useTheme,
} from "react-native-paper";

import { userContext } from "@/components/context/userContext";
import {
  workoutsDataContext,
  CompletedWorkout,
} from "@/components/context/workoutsDataContext";
import { habitsContext } from "@/components/context/habitsContext";
import { mealsDataContext } from "@/components/context/mealsDataContext";
import {
  profileDataContext,
  Profile,
} from "@/components/context/profileDataContext";
import { getHabitsForDate, isHabitDone } from "@/lib/habits/habits";
import { matchRecipes } from "@/lib/meals/meals";
import { getTodaysDate } from "@/lib/time_management/week";
import { estimateCalorieGoal } from "@/lib/calorieGoal";
import {
  computeWellnessScore,
  getHabitConsistencyStats,
  getNutrientGapStats,
  getWorkoutCategoryStats,
  WellnessComponent,
} from "@/lib/wellnessScore";
import { CircleTimer } from "@/components/ui/CircleTimer";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { ScreenView } from "@/components/ui/ScreenView";
import { Spacing } from "@/constants/theme";
import { styles } from "@/constants/styles";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Counts consecutive days (including today) with at least one completed workout.
function getWorkoutStreak(completedWorkouts: CompletedWorkout[]) {
  if (!completedWorkouts.length) return 0;

  const completedDays = new Set(
    completedWorkouts.map((w) => new Date(w.completed_at).toDateString()),
  );

  let streak = 0;
  const cursor = new Date();

  while (completedDays.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function getWorkoutsThisWeek(completedWorkouts: CompletedWorkout[]) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  return completedWorkouts.filter(
    (w) => new Date(w.completed_at) >= startOfWeek,
  ).length;
}

// Workouts have no fixed daily target (unlike habits), so this is simplified to a yes/no.
function hasWorkoutToday(completedWorkouts: CompletedWorkout[]) {
  const today = new Date().toDateString();
  return completedWorkouts.some(
    (w) => new Date(w.completed_at).toDateString() === today,
  );
}

// Only computable once height/weight/sex/age are all present on the profile.
function getCalorieGoal(profile: Profile | null): number | null {
  if (
    !profile?.height ||
    !profile?.weight ||
    !profile?.age ||
    profile.sex === null ||
    profile.sex === undefined
  ) {
    return null;
  }
  return estimateCalorieGoal({
    heightFeet: profile.height,
    weightLbs: profile.weight,
    sex: profile.sex,
    age: profile.age,
  });
}

// A row of two feedback lists (e.g. "consistent" vs "skipped") sharing one card.
function FeedbackCompareCard({
  title,
  leftLabel,
  leftItems,
  rightLabel,
  rightItems,
  emptyText,
}: {
  title: string;
  leftLabel: string;
  leftItems: string[];
  rightLabel: string;
  rightItems: string[];
  emptyText: string;
}) {
  const theme = useTheme();
  const hasAnyData = leftItems.length > 0 || rightItems.length > 0;

  return (
    <Card mode="contained" style={homeStyles.feedbackCard}>
      <Card.Content style={homeStyles.feedbackContent}>
        <Text variant="titleMedium">{title}</Text>

        {!hasAnyData ? (
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {emptyText}
          </Text>
        ) : (
          <HStack space="md" style={homeStyles.feedbackColumns}>
            <VStack space="xs" style={homeStyles.feedbackColumn}>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {leftLabel}
              </Text>
              {leftItems.length > 0 ? (
                <HStack space="xs" style={homeStyles.chipWrap}>
                  {leftItems.map((item) => (
                    <Chip key={item} compact style={homeStyles.chip}>
                      {item}
                    </Chip>
                  ))}
                </HStack>
              ) : (
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  Not enough data yet
                </Text>
              )}
            </VStack>

            <VStack space="xs" style={homeStyles.feedbackColumn}>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {rightLabel}
              </Text>
              {rightItems.length > 0 ? (
                <HStack space="xs" style={homeStyles.chipWrap}>
                  {rightItems.map((item) => (
                    <Chip key={item} compact style={homeStyles.chip}>
                      {item}
                    </Chip>
                  ))}
                </HStack>
              ) : (
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  Nothing to flag here
                </Text>
              )}
            </VStack>
          </HStack>
        )}
      </Card.Content>
    </Card>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const { user } = useContext(userContext) ?? {};

  // Real data, shared with WorkoutsPage via workoutsDataContext.
  const {
    completedWorkouts,
    workoutList,
    loading: workoutsLoading,
  } = useContext(workoutsDataContext) ?? {
    completedWorkouts: [] as CompletedWorkout[],
    workoutList: [],
    loading: true,
  };

  // Real data, shared with HabitsScreen via habitsContext.
  const { habitArray, habitCompletions } = useContext(habitsContext) ?? {
    habitArray: [],
    habitCompletions: {},
  };

  // Real data, shared with MealsScreen via mealsDataContext.
  const {
    ingredients,
    recipes,
    fridgeIds,
    catalogLoading: mealsLoading,
  } = useContext(mealsDataContext) ?? {
    ingredients: [],
    recipes: [],
    fridgeIds: new Set<string>(),
    catalogLoading: true,
  };

  // Real data, shared with profile.tsx/settings.tsx via profileDataContext.
  const { profile, loading: profileLoading } = useContext(
    profileDataContext,
  ) ?? {
    profile: null as Profile | null,
    loading: true,
  };

  const streak = useMemo(
    () => getWorkoutStreak(completedWorkouts),
    [completedWorkouts],
  );
  const workoutsThisWeek = useMemo(
    () => getWorkoutsThisWeek(completedWorkouts),
    [completedWorkouts],
  );
  const workoutDoneToday = useMemo(
    () => hasWorkoutToday(completedWorkouts),
    [completedWorkouts],
  );

  const today = getTodaysDate();
  const habitsToday = useMemo(
    () => getHabitsForDate(habitArray, today),
    [habitArray, today],
  );
  const habitsCompleteToday = useMemo(
    () =>
      habitsToday.filter((habit) =>
        isHabitDone(habit.id, today, habitCompletions),
      ).length,
    [habitsToday, today, habitCompletions],
  );
  const habitsProgress =
    habitsToday.length > 0 ? habitsCompleteToday / habitsToday.length : 0;

  const { ready: readyRecipes, almost: almostRecipes } = useMemo(
    () => matchRecipes(recipes, fridgeIds),
    [recipes, fridgeIds],
  );
  const totalConsideredRecipes = readyRecipes.length + almostRecipes.length;
  const recipesReadyProgress =
    totalConsideredRecipes > 0
      ? readyRecipes.length / totalConsideredRecipes
      : 0;

  const calorieGoal = useMemo(() => getCalorieGoal(profile), [profile]);

  // --- Wellness Score inputs -------------------------------------------
  // Habit consistency: completion rate over the last 7 days (not just today),
  // so a single missed habit this morning doesn't tank the score.
  const habitStats = useMemo(
    () => getHabitConsistencyStats(habitArray, habitCompletions, today, 7),
    [habitArray, habitCompletions, today],
  );

  // Workout consistency: how this week's completed-workout count compares to
  // a general 4x/week guideline, plus which body-area categories get the reps.
  const workoutStats = useMemo(
    () =>
      getWorkoutCategoryStats(workoutList, completedWorkouts, workoutsThisWeek, 4),
    [workoutList, completedWorkouts, workoutsThisWeek],
  );

  // Calorie goal consistency: there's no food diary in this app yet, so this
  // is a readiness proxy — having a computed goal, and having fridge stock
  // that lines up with recipes you can actually cook toward that goal.
  const calorieReadiness: number | null =
    calorieGoal === null
      ? null
      : totalConsideredRecipes > 0
        ? recipesReadyProgress
        : 0;

  const nutrientStats = useMemo(
    () => getNutrientGapStats(ingredients, fridgeIds),
    [ingredients, fridgeIds],
  );

  const wellnessComponents: WellnessComponent[] = [
    {
      key: "habits",
      label: "Habits",
      value: habitStats.rate,
      detail:
        habitStats.rate !== null
          ? `${Math.round(habitStats.rate * 100)}% of scheduled habits done (last 7 days)`
          : "No habits scheduled yet",
    },
    {
      key: "workouts",
      label: "Workouts",
      value: workoutStats.weeklyRate,
      detail:
        workoutStats.weeklyRate !== null
          ? `${workoutStats.workoutsThisWeek}/${workoutStats.weeklyTarget} workouts this week`
          : "No workouts logged yet",
    },
    {
      key: "calories",
      label: "Calorie goal",
      value: calorieReadiness,
      detail:
        calorieGoal === null
          ? "Add height/weight/age in Settings"
          : totalConsideredRecipes === 0
            ? "Add ingredients to your fridge to see readiness"
            : `${Math.round((calorieReadiness ?? 0) * 100)}% of your recipes are ready to cook`,
    },
  ];
  const wellnessScore = useMemo(
    () => computeWellnessScore(wellnessComponents),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [habitStats.rate, workoutStats.weeklyRate, calorieReadiness],
  );

  const displayName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";

  const isLoadingAnyData = workoutsLoading || profileLoading || mealsLoading;

  return (
    <ScreenView
      header={
        <VStack space="xs" style={styles.headerStyle}>
          <Text variant="bodyLarge">{getGreeting()},</Text>
          <Text variant="displaySmall">{displayName}</Text>
        </VStack>
      }
    >
      <Card mode="contained" style={homeStyles.streakCard}>
        <Card.Content style={homeStyles.streakContent}>
          <Avatar.Icon icon="fire" size={56} color={theme.colors.onPrimary} />

          <VStack style={homeStyles.streakColumn}>
            {workoutsLoading ? (
              <ActivityIndicator />
            ) : (
              <Text variant="displaySmall">{streak}</Text>
            )}
            <Text variant="labelMedium">Day streak</Text>
          </VStack>

          <VStack
            style={[
              homeStyles.streakColumn,
              homeStyles.streakDivider,
              { borderLeftColor: theme.colors.outlineVariant },
            ]}
          >
            {workoutsLoading ? (
              <ActivityIndicator />
            ) : (
              <Text variant="headlineMedium">{workoutsThisWeek}</Text>
            )}
            <Text variant="labelMedium">This week</Text>
          </VStack>
        </Card.Content>
      </Card>

      <Card mode="contained" style={homeStyles.streakCard}>
        <Card.Content style={homeStyles.calorieContent}>
          <Avatar.Icon
            icon="food-apple"
            size={48}
            color={theme.colors.onPrimary}
          />

          <VStack style={{ flex: 1 }}>
            <Text variant="labelMedium">Estimated daily calorie goal</Text>
            {profileLoading ? (
              <ActivityIndicator
                style={{ alignSelf: "flex-start", marginTop: Spacing.one }}
              />
            ) : calorieGoal ? (
              <>
                <Text variant="headlineSmall">
                  {calorieGoal.toLocaleString()} kcal
                </Text>
                <Text
                  variant="labelSmall"
                  style={{ color: theme.colors.onSurfaceVariant }}
                >
                  Estimate — based on your height, weight, sex, and age
                </Text>
              </>
            ) : (
              <Text
                variant="bodyMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Add your height, weight, and age in Settings to see this
              </Text>
            )}
          </VStack>
        </Card.Content>
      </Card>

      <VStack space="sm" style={homeStyles.todaySection}>
        <Text variant="titleMedium">Today</Text>

        <HStack space="md" style={homeStyles.ringRow}>
          <VStack style={homeStyles.ringColumn}>
            <CircleTimer
              progress={habitsProgress}
              label={`${habitsCompleteToday}/${habitsToday.length}`}
              duration={600}
              size={84}
              strokeWidth={8}
              labelVariant="labelLarge"
            />
            <Text variant="labelMedium">Habits</Text>
          </VStack>

          <VStack style={homeStyles.ringColumn}>
            <CircleTimer
              progress={workoutDoneToday ? 1 : 0}
              label={workoutDoneToday ? "Done" : "Not yet"}
              duration={600}
              size={84}
              strokeWidth={8}
              labelVariant="labelLarge"
            />
            <Text variant="labelMedium">Workout</Text>
          </VStack>

          <VStack style={homeStyles.ringColumn}>
            <CircleTimer
              progress={recipesReadyProgress}
              label={
                mealsLoading
                  ? "..."
                  : `${readyRecipes.length}/${totalConsideredRecipes}`
              }
              duration={600}
              size={84}
              strokeWidth={8}
              labelVariant="labelLarge"
            />
            <Text variant="labelMedium">Recipes ready</Text>
          </VStack>
        </HStack>
      </VStack>

      <VStack space="sm" style={homeStyles.wellnessSection}>
        <Text variant="titleMedium">Wellness Score</Text>

        <Card mode="contained" style={homeStyles.wellnessCard}>
          <Card.Content style={homeStyles.wellnessContent}>
            {isLoadingAnyData && wellnessScore === null ? (
              <ActivityIndicator />
            ) : (
              <CircleTimer
                progress={(wellnessScore ?? 0) / 100}
                label={wellnessScore !== null ? `${wellnessScore}` : "—"}
                duration={700}
                size={104}
                strokeWidth={10}
                labelVariant="headlineMedium"
              />
            )}

            <VStack space="xs" style={{ flex: 1 }}>
              {wellnessComponents.map((component) => (
                <HStack
                  key={component.key}
                  style={homeStyles.wellnessRow}
                  space="xs"
                >
                  <Text variant="labelMedium" style={{ width: 90 }}>
                    {component.label}
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant, flex: 1 }}
                  >
                    {component.detail}
                  </Text>
                </HStack>
              ))}
            </VStack>
          </Card.Content>
        </Card>
      </VStack>

      <FeedbackCompareCard
        title="Habit consistency"
        leftLabel="Sticking with it"
        leftItems={habitStats.mostConsistent.map(
          (h) => `${h.habit.title} · ${Math.round(h.rate * 100)}%`,
        )}
        rightLabel="Slipping"
        rightItems={habitStats.mostSkipped.map(
          (h) => `${h.habit.title} · ${Math.round(h.rate * 100)}%`,
        )}
        emptyText="Add a habit to start tracking consistency"
      />

      <FeedbackCompareCard
        title="Workout focus"
        leftLabel="In rotation"
        leftItems={workoutStats.prioritized.map(
          (c) => `${c.category} · ${c.count}`,
        )}
        rightLabel="Rarely touched"
        rightItems={workoutStats.lesserUsed.map((c) => c.category)}
        emptyText="Log a workout to see which categories you favor"
      />

      <FeedbackCompareCard
        title="Ingredients & nutrients"
        leftLabel="Commonly stocked"
        leftItems={nutrientStats.commonlyStocked
          .slice(0, 3)
          .map((c) => `${c.category} · ${c.count}`)}
        rightLabel="Vitamins you could be missing"
        rightItems={nutrientStats.possiblyMissing}
        emptyText="Add ingredients to your fridge to see your nutrient balance"
      />
    </ScreenView>
  );
}

const homeStyles = StyleSheet.create({
  header: {
    alignSelf: "flex-start",
  },
  streakCard: {
    width: "100%",
  },
  streakContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.four,
    paddingVertical: Spacing.three,
  },
  calorieContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.four,
    paddingVertical: Spacing.three,
  },
  streakColumn: {
    flex: 1,
    alignItems: "center",
    gap: Spacing.one,
  },
  streakDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingLeft: Spacing.four,
  },
  todaySection: {
    alignSelf: "stretch",
  },
  ringRow: {
    justifyContent: "space-evenly",
    alignSelf: "stretch",
  },
  ringColumn: {
    alignItems: "center",
    gap: Spacing.one,
  },
  wellnessSection: {
    alignSelf: "stretch",
  },
  wellnessCard: {
    width: "100%",
  },
  wellnessContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.four,
    paddingVertical: Spacing.three,
  },
  wellnessRow: {
    alignItems: "flex-start",
  },
  feedbackCard: {
    width: "100%",
  },
  feedbackContent: {
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  feedbackColumns: {
    alignSelf: "stretch",
  },
  feedbackColumn: {
    flex: 1,
  },
  chipWrap: {
    flexWrap: "wrap",
  },
  chip: {
    marginBottom: Spacing.one,
  },
});
