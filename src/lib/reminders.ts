// Pure builders for scheduled notifications. No I/O — notificationsContext
// feeds these the data it already has, and lib/notifications.ts schedules
// whatever they return.

import { addMinutes, parseISO, startOfDay } from "date-fns";

import { DailySummary, SUMMARY_TITLE, formatSummaryBody } from "@/lib/dailySummary";
import {
  CompletionsByDate,
  Habit,
  getHabitsForDate,
  isHabitDone,
  timeToMinutes,
} from "@/lib/habits/habits";
import {
  MEAL_TYPE_LABELS,
  MealPlanEntry,
  getMealsForDate,
  toDateKey,
} from "@/lib/meals/mealPlan";

export type Reminder = {
  // Unique within its kind; lib/notifications.ts prefixes it with the kind.
  key: string;
  title: string;
  body: string;
  date: Date;
};

function atMinutes(dateKey: string, minutes: number): Date {
  return addMinutes(startOfDay(parseISO(dateKey)), minutes);
}

export function buildSummaryReminders(
  summaries: DailySummary[],
  hour: number,
  minute: number,
): Reminder[] {
  return summaries.flatMap((summary) => {
    const body = formatSummaryBody(summary);
    if (!body) return [];
    return [
      {
        key: summary.dateKey,
        title: SUMMARY_TITLE,
        body,
        date: atMinutes(summary.dateKey, hour * 60 + minute),
      },
    ];
  });
}

// One reminder per habit per scheduled day, at the habit's own time. Habits
// already checked off for that day are skipped — there's nothing to remind.
export function buildHabitReminders(
  days: Date[],
  habits: Habit[],
  completions: CompletionsByDate,
): Reminder[] {
  return days.flatMap((day) => {
    const dateKey = toDateKey(day);
    return getHabitsForDate(habits, dateKey).flatMap((habit) => {
      const minutes = timeToMinutes(habit.time);
      if (Number.isNaN(minutes) || isHabitDone(habit.id, dateKey, completions)) {
        return [];
      }
      return [
        {
          key: `${dateKey}:${habit.id}`,
          title: "Habit reminder",
          body: `Time for: ${habit.title}`,
          date: atMinutes(dateKey, minutes),
        },
      ];
    });
  });
}

// Planned meals share the habits schedule model (a time, plus repeating
// weekdays or a single date), so this mirrors buildHabitReminders: one
// reminder per occurrence, skipping meals already checked off that day.
export function buildMealReminders(
  days: Date[],
  entries: MealPlanEntry[],
  completions: CompletionsByDate,
  recipeName: (entry: MealPlanEntry) => string,
): Reminder[] {
  return days.flatMap((day) => {
    const dateKey = toDateKey(day);
    return getMealsForDate(entries, dateKey).flatMap((entry) => {
      const minutes = timeToMinutes(entry.time);
      if (Number.isNaN(minutes) || isHabitDone(entry.id, dateKey, completions)) {
        return [];
      }
      return [
        {
          key: `${dateKey}:${entry.id}`,
          title: `${MEAL_TYPE_LABELS[entry.mealType]} reminder`,
          body: `On your meal plan: ${recipeName(entry)}`,
          date: atMinutes(dateKey, minutes),
        },
      ];
    });
  });
}
