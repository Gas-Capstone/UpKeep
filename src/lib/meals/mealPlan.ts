// Pure meal-plan types and schedule logic. No I/O — see queries.ts for the
// Supabase reads/writes that feed this.
//
// Planned meals use the same schedule model as habits: a time of day, plus
// either weekdays to repeat on or a single date.

import { addDays, format, startOfDay } from "date-fns";

import {
  Weekday,
  isScheduledOnDate,
  timeToMinutes,
} from "@/lib/habits/habits";

// Mirrors the check constraint on meal_plan_entries.meal_type.
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

/** Suggested time for each meal type, in the habits "h:mm aa" format. */
export const DEFAULT_MEAL_TIMES: Record<MealType, string> = {
  breakfast: "8:00 AM",
  lunch: "12:00 PM",
  snack: "3:00 PM",
  dinner: "6:00 PM",
};

export type MealPlanEntry = {
  id: string;
  recipeId: string;
  // Catalog and custom recipes have independent id sequences, so this is
  // needed to look the entry back up — see recipeKey() in meals.ts.
  isCustom: boolean;
  mealType: MealType;
  time: string;
  // Exactly one of these is set. weekdays repeats like a habit (empty means
  // every day); plannedDate is a one-off ISO date (yyyy-MM-dd).
  weekdays: Weekday[] | null;
  plannedDate: string | null;
};

/** How a new entry is scheduled — the editable part of a MealPlanEntry. */
export type MealSchedule = Pick<
  MealPlanEntry,
  "mealType" | "time" | "weekdays" | "plannedDate"
>;

// The `date` column has no time or zone, so dates are formatted locally and
// never round-tripped through toISOString — that would shift the day for
// anyone west of UTC.
export function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function isMealOnDate(entry: MealPlanEntry, date: string): boolean {
  return isScheduledOnDate(entry, date);
}

export function getMealsForDate(
  entries: MealPlanEntry[],
  date: string,
): MealPlanEntry[] {
  return entries
    .filter((entry) => isMealOnDate(entry, date))
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}

/**
 * Every planned meal from today through the next `days` days, once per
 * occurrence — a dinner repeating three nights appears three times, because
 * it should buy three nights' worth of ingredients.
 */
export function getUpcomingMeals(
  entries: MealPlanEntry[],
  days: number,
  today: Date = new Date(),
): MealPlanEntry[] {
  const start = startOfDay(today);
  return Array.from({ length: days }, (_, i) =>
    getMealsForDate(entries, toDateKey(addDays(start, i))),
  ).flat();
}
