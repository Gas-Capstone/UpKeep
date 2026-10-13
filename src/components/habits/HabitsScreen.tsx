import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { format, isToday, parseISO } from "date-fns";
import { useFocusEffect } from "expo-router";
import { Button, Icon, ProgressBar, Text } from "react-native-paper";

import { useHabitsContext } from "@/components/context/habitsContext";
import { useMealsData } from "@/components/context/mealsDataContext";
import { useThemeMode } from "@/components/context/ThemeContext";
import { useWorkoutsData } from "@/components/context/workoutsDataContext";
import { ScreenView } from "@/components/ui/ScreenView";
import { Colors, Radius, Spacing } from "@/constants/theme";
import {
  Habit,
  getHabitsForDate,
  isHabitDone,
  timeToMinutes,
} from "@/lib/habits/habits";
import { recipeKey } from "@/lib/meals/meals";
import {
  MEAL_TYPE_LABELS,
  MealPlanEntry,
  getMealsForDate,
} from "@/lib/meals/mealPlan";
import {
  ScheduledWorkout,
  getScheduledWorkoutsForDate,
  getSessionDays,
  isScheduledWorkoutDone,
  wasLoggedOn,
} from "@/lib/workoutSchedule";

import { AddHabitModal } from "./AddHabitModal";
import { HabitCard, getScheduleLabel } from "./HabitCard";
import { WeekStrip } from "./WeekStrip";

// Habits, planned meals, and scheduled workouts share one timeline for the
// selected day.
type DayItem =
  | { kind: "habit"; habit: Habit }
  | { kind: "meal"; entry: MealPlanEntry }
  | { kind: "workout"; entry: ScheduledWorkout };

function itemTime(item: DayItem) {
  return item.kind === "habit" ? item.habit.time : item.entry.time;
}

function scheduleLabelFor(entry: { weekdays: Habit["weekdays"] | null }) {
  return entry.weekdays ? getScheduleLabel(entry.weekdays) : "Once";
}

export default function HabitsScreen() {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];
  const {
    selectedDate,
    setSelectedDate,
    habitArray,
    habitCompletions,
    addHabit,
    removeHabit,
    toggleHabit,
  } = useHabitsContext();
  const {
    recipes,
    mealPlanEntries,
    mealCompletions,
    addMealPlanEntry,
    removeMealPlanEntry,
    toggleMeal,
  } = useMealsData();
  const {
    workoutList,
    completedWorkouts,
    refreshCompletedWorkouts,
    scheduledWorkouts,
    workoutScheduleCompletions,
    scheduleWorkout,
    unscheduleWorkout,
    toggleScheduledWorkout,
  } = useWorkoutsData();

  // Finishing a workout elsewhere checks off its scheduled slot here, so pick
  // up newly logged sessions whenever this tab comes into view.
  useFocusEffect(refreshCompletedWorkouts);

  const [modalVisible, setModalVisible] = useState(false);

  const habitsForDay = useMemo(
    () => getHabitsForDate(habitArray, selectedDate),
    [habitArray, selectedDate],
  );

  const recipeNameByKey = new Map(recipes.map((r) => [recipeKey(r), r.name]));
  const planNameById = new Map(workoutList.map((w) => [String(w.id), w.name]));
  const sessionDays = getSessionDays(completedWorkouts);

  const itemsForDay: DayItem[] = [
    ...habitsForDay.map((habit) => ({ kind: "habit" as const, habit })),
    ...getMealsForDate(mealPlanEntries, selectedDate).map((entry) => ({
      kind: "meal" as const,
      entry,
    })),
    ...getScheduledWorkoutsForDate(scheduledWorkouts, selectedDate).map(
      (entry) => ({ kind: "workout" as const, entry }),
    ),
  ].sort((a, b) => timeToMinutes(itemTime(a)) - timeToMinutes(itemTime(b)));

  const isItemDone = (item: DayItem) =>
    item.kind === "habit"
      ? isHabitDone(item.habit.id, selectedDate, habitCompletions)
      : item.kind === "meal"
        ? isHabitDone(item.entry.id, selectedDate, mealCompletions)
        : isScheduledWorkoutDone(
            item.entry,
            selectedDate,
            workoutScheduleCompletions,
            sessionDays,
          );

  const habitsComplete = itemsForDay.filter(isItemDone).length;
  const total = itemsForDay.length;
  const progress = total > 0 ? habitsComplete / total : 0;
  const selectedDateObject = parseISO(selectedDate);
  const selectedLabel = isToday(selectedDateObject)
    ? "Today"
    : format(selectedDateObject, "EEEE, MMM d");

  return (
    <ScreenView
      contentContainerStyle={styles.content}
      overlay={
        // Mounted only while open so it picks up the selected day each time.
        modalVisible ? (
          <AddHabitModal
            visible
            onDismiss={() => setModalVisible(false)}
            onSave={addHabit}
            onSaveMeal={addMealPlanEntry}
            onSaveWorkout={scheduleWorkout}
            defaultDate={selectedDate}
          />
        ) : null
      }
      header={
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View
              style={[styles.titleIcon, { backgroundColor: colors.brandSoft }]}
            >
              <Icon
                source="check-circle-outline"
                size={22}
                color={colors.brand}
              />
            </View>

            <View style={styles.titleCopy}>
              <Text
                variant="headlineMedium"
                style={[styles.title, { color: colors.text }]}
              >
                Habits
              </Text>
              <Text
                variant="bodyMedium"
                style={{ color: colors.textSecondary }}
              >
                Routines and meals, scheduled through your day.
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.progressCard,
              {
                backgroundColor: colors.backgroundElement,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.progressTopRow}>
              <View>
                <Text
                  variant="labelMedium"
                  style={{ color: colors.textSecondary }}
                >
                  {selectedLabel.toUpperCase()}
                </Text>
                <Text
                  variant="titleLarge"
                  style={[styles.progressValue, { color: colors.text }]}
                >
                  {total === 0
                    ? "Nothing planned"
                    : `${habitsComplete}/${total} complete`}
                </Text>
              </View>

              {total > 0 ? (
                <View
                  style={[
                    styles.percentBadge,
                    { backgroundColor: colors.brandSoft },
                  ]}
                >
                  <Text
                    variant="labelLarge"
                    style={{ color: colors.brandStrong, fontWeight: "800" }}
                  >
                    {Math.round(progress * 100)}%
                  </Text>
                </View>
              ) : null}
            </View>

            <ProgressBar
              progress={progress}
              color={colors.brand}
              style={[styles.progressBar, { backgroundColor: colors.border }]}
            />
          </View>

          <WeekStrip
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </View>
      }
    >
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text
            variant="titleLarge"
            style={{ color: colors.text, fontWeight: "800" }}
          >
            {selectedLabel}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
            {total === 0
              ? "Nothing scheduled for this day yet."
              : `${total} ${total === 1 ? "item" : "items"} scheduled`}
          </Text>
        </View>
      </View>

      <View style={styles.list}>
        {itemsForDay.map((item) =>
          item.kind === "habit" ? (
            <HabitCard
              key={`habit-${item.habit.id}`}
              title={item.habit.title}
              time={item.habit.time}
              scheduleLabel={getScheduleLabel(item.habit.weekdays)}
              isDone={isItemDone(item)}
              onToggle={() =>
                toggleHabit({ habitId: item.habit.id, habitDate: selectedDate })
              }
              onDelete={() => removeHabit(item.habit.id)}
            />
          ) : item.kind === "meal" ? (
            <HabitCard
              key={`meal-${item.entry.id}`}
              title={
                recipeNameByKey.get(
                  recipeKey({
                    id: item.entry.recipeId,
                    isCustom: item.entry.isCustom,
                  }),
                ) ?? "Unknown recipe"
              }
              time={item.entry.time}
              scheduleLabel={scheduleLabelFor(item.entry)}
              tag={{
                icon: "silverware-fork-knife",
                label: MEAL_TYPE_LABELS[item.entry.mealType],
              }}
              deleteLabel="Remove from plan"
              isDone={isItemDone(item)}
              onToggle={() =>
                toggleMeal({ entryId: item.entry.id, date: selectedDate })
              }
              onDelete={() => removeMealPlanEntry(item.entry.id)}
            />
          ) : (
            <HabitCard
              key={`workout-${item.entry.id}`}
              title={planNameById.get(item.entry.workoutPlanId) ?? "Deleted plan"}
              time={item.entry.time}
              scheduleLabel={
                // Logged with the timer: say so, since a tick can't undo it.
                wasLoggedOn(item.entry, selectedDate, sessionDays)
                  ? `${scheduleLabelFor(item.entry)} · Logged`
                  : scheduleLabelFor(item.entry)
              }
              tag={{ icon: "dumbbell", label: "Workout" }}
              deleteLabel="Remove from schedule"
              isDone={isItemDone(item)}
              onToggle={() =>
                toggleScheduledWorkout({
                  entryId: item.entry.id,
                  date: selectedDate,
                })
              }
              onDelete={() => unscheduleWorkout(item.entry.id)}
            />
          ),
        )}

        {total === 0 ? (
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
              <Icon
                source="calendar-check-outline"
                size={28}
                color={colors.brand}
              />
            </View>
            <Text
              variant="titleMedium"
              style={{ color: colors.text, fontWeight: "800" }}
            >
              Nothing scheduled
            </Text>
            <Text
              variant="bodyMedium"
              style={[styles.emptyCopy, { color: colors.textSecondary }]}
            >
              Add a habit, plan a meal, or schedule a workout.
            </Text>
          </View>
        ) : null}
      </View>

      <Button
        mode="contained"
        icon="plus"
        onPress={() => setModalVisible(true)}
        buttonColor={colors.brandStrong}
        textColor="#FFFFFF"
        contentStyle={styles.addButtonContent}
        style={styles.addButton}
      >
        Add Habit, Meal, or Workout
      </Button>
    </ScreenView>
  );
}

const styles = StyleSheet.create({
  header: {
    width: "100%",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.three,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  titleIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.medium,
    alignItems: "center",
    justifyContent: "center",
  },
  titleCopy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  progressCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.large,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  progressTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  progressValue: {
    marginTop: 2,
    fontWeight: "900",
  },
  percentBadge: {
    minWidth: 54,
    height: 36,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  progressBar: {
    height: 8,
    borderRadius: Radius.pill,
    overflow: "hidden",
  },
  content: {
    gap: Spacing.three,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  list: {
    gap: Spacing.two,
  },
  emptyState: {
    minHeight: 190,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.large,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.one,
  },
  emptyCopy: {
    textAlign: "center",
    maxWidth: 290,
    lineHeight: 20,
  },
  addButton: {
    borderRadius: Radius.pill,
    marginTop: Spacing.one,
  },
  addButtonContent: {
    minHeight: 50,
  },
});
