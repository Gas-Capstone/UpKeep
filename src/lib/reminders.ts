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
import { MEAL_TYPE_LABELS, MealPlanEntry, MealType, toDateKey } from "@/lib/meals/mealPlan";

export type Reminder = {
  // Unique within its kind; lib/notifications.ts prefixes it with the kind.
  key: string;
  title: string;
  body: string;
  date: Date;
};

// meal_plan_entries has no time column, so each meal type gets a fixed one.
// ponytail: fixed times, make them a setting if users ask to move them.
export const MEAL_REMINDER_MINUTES: Record<MealType, number> = {
  breakfast: 8 * 60,
  lunch: 12 * 60,
  snack: 15 * 60,
  dinner: 18 * 60,
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

export function buildMealReminders(
  entries: MealPlanEntry[],
  recipeName: (entry: MealPlanEntry) => string,
): Reminder[] {
  return entries.map((entry) => ({
    key: entry.id,
    title: `${MEAL_TYPE_LABELS[entry.mealType]} reminder`,
    body: `On your meal plan: ${recipeName(entry)}`,
    date: atMinutes(entry.plannedDate, MEAL_REMINDER_MINUTES[entry.mealType]),
  }));
}
