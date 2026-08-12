import { useContext, useMemo } from "react";
import { StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Avatar,
  Card,
  IconButton,
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

// One row in the "Jump back in" section — a pressable card linking to another tab.
function QuickLinkCard({
  title,
  subtitle,
  href,
  icon,
}: {
  title: string;
  subtitle: string;
  href: string;
  icon: string;
}) {
  const router = useRouter();
  const goTo = () => router.navigate(href as any);

  return (
    <Card mode="contained" onPress={goTo}>
      <Card.Title
        title={title}
        subtitle={subtitle}
        left={(props) => <Avatar.Icon {...props} icon={icon} />}
        right={(props) => (
          <IconButton {...props} icon="chevron-right" onPress={goTo} />
        )}
      />
    </Card>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const { user } = useContext(userContext) ?? {};

  // Real data, shared with WorkoutsPage via workoutsDataContext.
  const { completedWorkouts, loading: workoutsLoading } = useContext(
    workoutsDataContext,
  ) ?? {
    completedWorkouts: [] as CompletedWorkout[],
    loading: true,
  };

  // Real data, shared with HabitsScreen via habitsContext.
  const { habitArray, habitCompletions } = useContext(habitsContext) ?? {
    habitArray: [],
    habitCompletions: {},
  };

  // Real data, shared with MealsScreen via mealsDataContext.
  const {
    recipes,
    fridgeIds,
    catalogLoading: mealsLoading,
  } = useContext(mealsDataContext) ?? {
    recipes: [],
    fridgeIds: new Set<number>(),
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

  const displayName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";

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

      <VStack space="md" style={homeStyles.linksSection}>
        <Text variant="titleMedium">Jump back in</Text>

        <QuickLinkCard
          title="Today's habits"
          subtitle={
            habitsToday.length > 0
              ? `${habitsCompleteToday}/${habitsToday.length} done today`
              : "No habits scheduled today"
          }
          href="/habits"
          icon="timer-outline"
        />
        <QuickLinkCard
          title="Workouts"
          subtitle={
            workoutsThisWeek > 0
              ? `${workoutsThisWeek} completed this week`
              : "Find something to do today"
          }
          href="/workouts"
          icon="dumbbell"
        />
        <QuickLinkCard
          title="Meals"
          subtitle={
            mealsLoading
              ? "Loading your fridge..."
              : readyRecipes.length > 0
                ? `${readyRecipes.length} recipe${readyRecipes.length === 1 ? "" : "s"} ready to cook`
                : "Add ingredients to your fridge"
          }
          href="/meals"
          icon="silverware-fork-knife"
        />
      </VStack>
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
  linksSection: {
    alignSelf: "stretch",
  },
});
