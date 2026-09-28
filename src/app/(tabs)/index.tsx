import { Ionicons } from "@expo/vector-icons";
import { useContext, useMemo } from "react";
import { Image, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Avatar,
  ProgressBar,
  Text,
  useTheme,
} from "react-native-paper";

import { habitsContext } from "@/components/context/habitsContext";
import { mealsDataContext } from "@/components/context/mealsDataContext";
import {
  profileDataContext,
  Profile,
} from "@/components/context/profileDataContext";
import {
  CompletedWorkout,
  workoutsDataContext,
} from "@/components/context/workoutsDataContext";
import { ScreenView } from "@/components/ui/ScreenView";
import { CircleTimer } from "@/components/ui/CircleTimer";
import { useThemeMode } from "@/components/context/ThemeContext";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { estimateCalorieGoal } from "@/lib/calorieGoal";
import { getHabitsForDate, isHabitDone } from "@/lib/habits/habits";
import { matchRecipes } from "@/lib/meals/meals";
import { getTodaysDate } from "@/lib/time_management/week";
import {
  computeWellnessScore,
  getHabitConsistencyStats,
  getNutrientGapStats,
  getWorkoutCategoryStats,
  WellnessComponent,
} from "@/lib/wellnessScore";

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getWorkoutStreak(completedWorkouts: CompletedWorkout[]) {
  if (!completedWorkouts.length) return 0;

  const completedDays = new Set(
    completedWorkouts.map((workout) =>
      new Date(workout.completed_at).toDateString(),
    ),
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
    (workout) => new Date(workout.completed_at) >= startOfWeek,
  ).length;
}

function hasWorkoutToday(completedWorkouts: CompletedWorkout[]) {
  const today = new Date().toDateString();

  return completedWorkouts.some(
    (workout) => new Date(workout.completed_at).toDateString() === today,
  );
}

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

function MetricTile({
  icon,
  value,
  label,
  loading = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  loading?: boolean;
}) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  return (
    <View
      style={[
        homeStyles.metricTile,
        {
          backgroundColor: colors.backgroundElement,
          borderColor: colors.border,
        },
      ]}
    >
      <View
        style={[homeStyles.metricIcon, { backgroundColor: colors.brandSoft }]}
      >
        <Ionicons name={icon} size={20} color={colors.brand} />
      </View>

      {loading ? (
        <ActivityIndicator size="small" />
      ) : (
        <Text style={[homeStyles.metricValue, { color: colors.text }]}>
          {value}
        </Text>
      )}

      <Text
        numberOfLines={1}
        style={[homeStyles.metricLabel, { color: colors.textSecondary }]}
      >
        {label}
      </Text>
    </View>
  );
}

function TodayTile({
  icon,
  title,
  value,
  progress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value: string;
  progress: number;
}) {
  const theme = useTheme();
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];
  const normalizedProgress = Math.max(0, Math.min(progress, 1));

  return (
    <View
      style={[
        homeStyles.todayTile,
        {
          backgroundColor: colors.backgroundElement,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={homeStyles.todayTileTop}>
        <View
          style={[homeStyles.todayIcon, { backgroundColor: colors.brandSoft }]}
        >
          <Ionicons name={icon} size={18} color={colors.brand} />
        </View>
        <Text style={[homeStyles.todayValue, { color: colors.text }]}>
          {value}
        </Text>
      </View>

      <Text
        numberOfLines={1}
        style={[homeStyles.todayLabel, { color: colors.textSecondary }]}
      >
        {title}
      </Text>

      <ProgressBar
        progress={normalizedProgress}
        color={theme.colors.primary}
        style={[
          homeStyles.progressBar,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      />
    </View>
  );
}

function WellnessDetailRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | null;
  detail: string;
}) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];
  const percentage = value === null ? null : Math.round(value * 100);

  return (
    <View style={homeStyles.wellnessDetailRow}>
      <View style={homeStyles.wellnessDetailHeader}>
        <Text style={[homeStyles.wellnessDetailLabel, { color: colors.text }]}>
          {label}
        </Text>
        <Text
          style={[
            homeStyles.wellnessDetailValue,
            {
              color: percentage === null ? colors.textSecondary : colors.brand,
            },
          ]}
        >
          {percentage === null ? "—" : `${percentage}%`}
        </Text>
      </View>

      <Text
        numberOfLines={2}
        style={[homeStyles.wellnessDetailText, { color: colors.textSecondary }]}
      >
        {detail}
      </Text>
    </View>
  );
}

function InsightPill({ label }: { label: string }) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  return (
    <View
      style={[
        homeStyles.insightPill,
        {
          backgroundColor: colors.brandSoft,
          borderColor: colors.border,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[homeStyles.insightPillText, { color: colors.text }]}
      >
        {label}
      </Text>
    </View>
  );
}

function SummaryList({
  items,
  emptyText,
}: {
  items: string[];
  emptyText: string;
}) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];
  const visible = items.slice(0, 2);
  const hiddenCount = Math.max(items.length - visible.length, 0);

  if (!visible.length) {
    return (
      <Text
        style={[homeStyles.emptyInsightText, { color: colors.textSecondary }]}
      >
        {emptyText}
      </Text>
    );
  }

  return (
    <View style={homeStyles.insightPillWrap}>
      {visible.map((item) => (
        <InsightPill key={item} label={item} />
      ))}
      {hiddenCount > 0 && <InsightPill label={`+${hiddenCount} more`} />}
    </View>
  );
}

function InsightCard({
  icon,
  title,
  leftLabel,
  leftItems,
  rightLabel,
  rightItems,
  emptyText,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  leftLabel: string;
  leftItems: string[];
  rightLabel: string;
  rightItems: string[];
  emptyText: string;
}) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];
  const hasData = leftItems.length > 0 || rightItems.length > 0;

  return (
    <View
      style={[
        homeStyles.insightCard,
        {
          backgroundColor: colors.backgroundElement,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={homeStyles.insightHeader}>
        <View
          style={[
            homeStyles.insightIcon,
            { backgroundColor: colors.brandSoft },
          ]}
        >
          <Ionicons name={icon} size={18} color={colors.brand} />
        </View>
        <Text style={[homeStyles.insightTitle, { color: colors.text }]}>
          {title}
        </Text>
      </View>

      {!hasData ? (
        <Text
          style={[homeStyles.emptyInsightText, { color: colors.textSecondary }]}
        >
          {emptyText}
        </Text>
      ) : (
        <View style={homeStyles.insightColumns}>
          <View style={homeStyles.insightColumn}>
            <Text
              style={[homeStyles.insightLabel, { color: colors.textSecondary }]}
            >
              {leftLabel}
            </Text>
            <SummaryList items={leftItems} emptyText="Not enough data yet" />
          </View>

          <View
            style={[
              homeStyles.insightColumn,
              homeStyles.insightColumnDivider,
              { borderLeftColor: colors.border },
            ]}
          >
            <Text
              style={[homeStyles.insightLabel, { color: colors.textSecondary }]}
            >
              {rightLabel}
            </Text>
            <SummaryList items={rightItems} emptyText="Nothing to flag" />
          </View>
        </View>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  const {
    completedWorkouts,
    workoutList,
    loading: workoutsLoading,
  } = useContext(workoutsDataContext) ?? {
    completedWorkouts: [] as CompletedWorkout[],
    workoutList: [],
    loading: true,
  };

  const { habitArray, habitCompletions } = useContext(habitsContext) ?? {
    habitArray: [],
    habitCompletions: {},
  };

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

  const habitStats = useMemo(
    () => getHabitConsistencyStats(habitArray, habitCompletions, today, 7),
    [habitArray, habitCompletions, today],
  );

  const workoutStats = useMemo(
    () =>
      getWorkoutCategoryStats(
        workoutList,
        completedWorkouts,
        workoutsThisWeek,
        4,
      ),
    [workoutList, completedWorkouts, workoutsThisWeek],
  );

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
          ? `${Math.round(habitStats.rate * 100)}% of scheduled habits completed in the last 7 days`
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
      label: "Meal readiness",
      value: calorieReadiness,
      detail:
        calorieGoal === null
          ? "Add biometrics to calculate your calorie target"
          : totalConsideredRecipes === 0
            ? "Add ingredients to your fridge to check meal readiness"
            : `${Math.round((calorieReadiness ?? 0) * 100)}% of matched recipes are ready to cook`,
    },
  ];

  const wellnessScore = useMemo(
    () => computeWellnessScore(wellnessComponents),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [habitStats.rate, workoutStats.weeklyRate, calorieReadiness],
  );

  const displayName = profileLoading ? "..." : profile?.display_name || "there";
  const isLoadingAnyData = workoutsLoading || profileLoading || mealsLoading;

  const profileAvatar = profile?.avatar_url ? (
    <Avatar.Image size={46} source={{ uri: profile.avatar_url }} />
  ) : (
    <Avatar.Icon
      size={46}
      icon="account"
      color={theme.colors.primary}
      style={{ backgroundColor: theme.colors.primaryContainer }}
    />
  );

  return (
    <ScreenView
      header={
        <View style={homeStyles.header}>
          <View style={homeStyles.brandGroup}>
            <Image
              source={require("../../../assets/images/upkeep-logo.png")}
              style={homeStyles.logo}
              resizeMode="cover"
              accessibilityLabel="UpKeep logo"
            />

            <View style={homeStyles.headerCopy}>
              <Text
                style={[homeStyles.greeting, { color: colors.textSecondary }]}
              >
                {getGreeting()},
              </Text>
              <Text
                numberOfLines={1}
                style={[homeStyles.displayName, { color: colors.text }]}
              >
                {displayName}
              </Text>
            </View>
          </View>

          {profileAvatar}
        </View>
      }
      contentContainerStyle={homeStyles.content}
    >
      <View style={homeStyles.metricRow}>
        <MetricTile
          icon="flame-outline"
          value={`${streak}`}
          label="Day streak"
          loading={workoutsLoading}
        />
        <MetricTile
          icon="calendar-outline"
          value={`${workoutsThisWeek}`}
          label="This week"
          loading={workoutsLoading}
        />
      </View>

      <View
        style={[
          homeStyles.goalCard,
          {
            backgroundColor: colors.backgroundElement,
            borderColor: colors.border,
          },
        ]}
      >
        <View
          style={[homeStyles.goalIcon, { backgroundColor: colors.brandSoft }]}
        >
          <Ionicons name="nutrition-outline" size={24} color={colors.brand} />
        </View>

        <View style={homeStyles.goalCopy}>
          <Text
            style={[homeStyles.cardEyebrow, { color: colors.textSecondary }]}
          >
            ESTIMATED DAILY TARGET
          </Text>

          {profileLoading ? (
            <ActivityIndicator size="small" style={homeStyles.goalLoader} />
          ) : calorieGoal ? (
            <>
              <Text style={[homeStyles.goalValue, { color: colors.text }]}>
                {calorieGoal.toLocaleString()} kcal
              </Text>
              <Text
                style={[homeStyles.goalNote, { color: colors.textSecondary }]}
              >
                Personalized from the profile details you provided.
              </Text>
            </>
          ) : (
            <>
              <Text style={[homeStyles.goalMissing, { color: colors.text }]}>
                Finish your biometrics
              </Text>
              <Text
                style={[homeStyles.goalNote, { color: colors.textSecondary }]}
              >
                Add height, weight, age, and sex in Settings to calculate it.
              </Text>
            </>
          )}
        </View>
      </View>

      <View style={homeStyles.sectionHeader}>
        <Text style={[homeStyles.sectionTitle, { color: colors.text }]}>
          Today
        </Text>
        <Text style={[homeStyles.sectionHint, { color: colors.textSecondary }]}>
          Your daily snapshot
        </Text>
      </View>

      <View style={homeStyles.todayRow}>
        <TodayTile
          icon="checkmark-circle-outline"
          title="Habits"
          value={`${habitsCompleteToday}/${habitsToday.length}`}
          progress={habitsProgress}
        />
        <TodayTile
          icon="barbell-outline"
          title="Workout"
          value={workoutDoneToday ? "Done" : "Not yet"}
          progress={workoutDoneToday ? 1 : 0}
        />
        <TodayTile
          icon="restaurant-outline"
          title="Meals ready"
          value={
            mealsLoading
              ? "..."
              : `${readyRecipes.length}/${totalConsideredRecipes}`
          }
          progress={recipesReadyProgress}
        />
      </View>

      <View style={homeStyles.sectionHeader}>
        <Text style={[homeStyles.sectionTitle, { color: colors.text }]}>
          Wellness score
        </Text>
        <Text style={[homeStyles.sectionHint, { color: colors.textSecondary }]}>
          Based on recent activity
        </Text>
      </View>

      <View
        style={[
          homeStyles.wellnessCard,
          {
            backgroundColor: colors.backgroundElement,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={homeStyles.scoreWrap}>
          {isLoadingAnyData && wellnessScore === null ? (
            <View style={homeStyles.scoreLoader}>
              <ActivityIndicator />
            </View>
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
          <Text
            style={[homeStyles.scoreCaption, { color: colors.textSecondary }]}
          >
            out of 100
          </Text>
        </View>

        <View style={homeStyles.wellnessDetails}>
          {wellnessComponents.map((component) => (
            <WellnessDetailRow
              key={component.key}
              label={component.label}
              value={component.value}
              detail={component.detail}
            />
          ))}
        </View>
      </View>

      <View style={homeStyles.sectionHeader}>
        <Text style={[homeStyles.sectionTitle, { color: colors.text }]}>
          Your patterns
        </Text>
        <Text style={[homeStyles.sectionHint, { color: colors.textSecondary }]}>
          Quick insights from your recent data
        </Text>
      </View>

      <InsightCard
        icon="repeat-outline"
        title="Habit consistency"
        leftLabel="STICKING WITH IT"
        leftItems={habitStats.mostConsistent.map(
          (habit) => `${habit.habit.title} · ${Math.round(habit.rate * 100)}%`,
        )}
        rightLabel="NEEDS ATTENTION"
        rightItems={habitStats.mostSkipped.map(
          (habit) => `${habit.habit.title} · ${Math.round(habit.rate * 100)}%`,
        )}
        emptyText="Add a habit to start seeing consistency patterns."
      />

      <InsightCard
        icon="barbell-outline"
        title="Workout focus"
        leftLabel="IN ROTATION"
        leftItems={workoutStats.prioritized.map(
          (category) => `${category.category} · ${category.count}`,
        )}
        rightLabel="LESS USED"
        rightItems={workoutStats.lesserUsed.map(
          (category) => category.category,
        )}
        emptyText="Log a workout to see which categories you use most."
      />

      <InsightCard
        icon="leaf-outline"
        title="Ingredients & nutrients"
        leftLabel="COMMONLY STOCKED"
        leftItems={nutrientStats.commonlyStocked
          .slice(0, 3)
          .map((item) => `${item.category} · ${item.count}`)}
        rightLabel="POSSIBLE GAPS"
        rightItems={nutrientStats.possiblyMissing}
        emptyText="Add ingredients to your fridge to see nutrition patterns."
      />
    </ScreenView>
  );
}

const homeStyles = StyleSheet.create({
  content: {
    gap: Spacing.three,
  },
  header: {
    width: "100%",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  brandGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: Radius.medium,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
  },
  displayName: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  metricRow: {
    width: "100%",
    flexDirection: "row",
    gap: Spacing.three,
  },
  metricTile: {
    flex: 1,
    minHeight: 118,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.medium,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: {
    fontSize: 27,
    lineHeight: 31,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  metricLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600",
  },
  goalCard: {
    width: "100%",
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  goalIcon: {
    width: 50,
    height: 50,
    borderRadius: Radius.medium,
    alignItems: "center",
    justifyContent: "center",
  },
  goalCopy: {
    flex: 1,
    minHeight: 68,
    justifyContent: "center",
  },
  cardEyebrow: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  goalValue: {
    marginTop: 2,
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  goalMissing: {
    marginTop: 3,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "700",
  },
  goalNote: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  goalLoader: {
    alignSelf: "flex-start",
    marginTop: Spacing.two,
  },
  sectionHeader: {
    marginTop: Spacing.one,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "800",
    letterSpacing: -0.25,
  },
  sectionHint: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  todayRow: {
    width: "100%",
    flexDirection: "row",
    gap: Spacing.two,
  },
  todayTile: {
    flex: 1,
    minWidth: 0,
    minHeight: 118,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    justifyContent: "space-between",
  },
  todayTileTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.one,
  },
  todayIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.small,
    alignItems: "center",
    justifyContent: "center",
  },
  todayValue: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    textAlign: "right",
  },
  todayLabel: {
    marginTop: Spacing.two,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  progressBar: {
    height: 5,
    borderRadius: Radius.pill,
    marginTop: Spacing.two,
    overflow: "hidden",
  },
  wellnessCard: {
    width: "100%",
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  scoreWrap: {
    width: 116,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreLoader: {
    width: 104,
    height: 104,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreCaption: {
    marginTop: Spacing.one,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
  },
  wellnessDetails: {
    flex: 1,
    gap: Spacing.two,
  },
  wellnessDetailRow: {
    gap: 2,
  },
  wellnessDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  wellnessDetailLabel: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "700",
  },
  wellnessDetailValue: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  wellnessDetailText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "500",
  },
  insightCard: {
    width: "100%",
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  insightIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.small,
    alignItems: "center",
    justifyContent: "center",
  },
  insightTitle: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
  },
  insightColumns: {
    width: "100%",
    flexDirection: "row",
    gap: Spacing.three,
  },
  insightColumn: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.two,
  },
  insightColumnDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingLeft: Spacing.three,
  },
  insightLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.65,
  },
  insightPillWrap: {
    gap: Spacing.one,
  },
  insightPill: {
    minHeight: 30,
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
  },
  insightPillText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
  },
  emptyInsightText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
});
