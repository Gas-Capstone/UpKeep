// Pure meal-plan types and week math. No I/O — see queries.ts for the
// Supabase reads/writes that feed this.

import { addDays, format, startOfWeek } from "date-fns";

// Mirrors the check constraint on meal_plan_entries.meal_type.
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export type MealPlanEntry = {
  id: string;
  recipeId: string;
  // Catalog and custom recipes have independent id sequences, so this is
  // needed to look the entry back up — see recipeKey() in meals.ts.
  isCustom: boolean;
  // ISO date (yyyy-MM-dd), matching the `date` column.
  plannedDate: string;
  mealType: MealType;
};

/** Key for looking an entry up by the slot it occupies. */
export function slotKey(plannedDate: string, mealType: MealType): string {
  return `${plannedDate}|${mealType}`;
}

// The `date` column has no time or zone, so dates are formatted locally and
// never round-tripped through toISOString — that would shift the day for
// anyone west of UTC.
export function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * The seven days of a week, Sunday through Saturday.
 * `weekOffset` 0 is the current week, 1 is next week.
 */
export function getWeekDays(weekOffset: number, today: Date = new Date()): Date[] {
  const start = addDays(startOfWeek(today, { weekStartsOn: 0 }), weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
