import { addDays, startOfDay } from "date-fns";

import { Habit, getHabitsForDate } from "@/lib/habits/habits";
import { MealPlanEntry, toDateKey } from "@/lib/meals/mealPlan";

export const SUMMARY_DAYS = 7;
export const DEFAULT_SUMMARY_HOUR = 8;
export const DEFAULT_SUMMARY_MINUTE = 0;
export const SUMMARY_TITLE = "Your day ahead";
export const EMPTY_SUMMARY_BODY = "Today: nothing planned yet.";

export type DailySummary = {
  dateKey: string;
  habits: number;
  meals: number;
};

export function getSummaryDays(today: Date = new Date()): Date[] {
  const start = startOfDay(today);
  return Array.from({ length: SUMMARY_DAYS }, (_, i) => addDays(start, i));
}

export function buildDailySummaries(
  days: Date[],
  habits: Habit[],
  mealEntries: MealPlanEntry[],
): DailySummary[] {
  const mealsByDate = new Map<string, number>();
  for (const entry of mealEntries) {
    mealsByDate.set(entry.plannedDate, (mealsByDate.get(entry.plannedDate) ?? 0) + 1);
  }

  return days.map((day) => {
    const dateKey = toDateKey(day);
    return {
      dateKey,
      habits: getHabitsForDate(habits, dateKey).length,
      meals: mealsByDate.get(dateKey) ?? 0,
    };
  });
}

function countLabel(count: number, word: string) {
  return `${count} ${count === 1 ? word : `${word}s`}`;
}

// null when there's nothing planned, so that day gets no notification
export function formatSummaryBody(summary: DailySummary): string | null {
  const parts: string[] = [];
  if (summary.habits > 0) parts.push(countLabel(summary.habits, "habit"));
  if (summary.meals > 0) parts.push(countLabel(summary.meals, "meal"));
  if (parts.length === 0) return null;
  return `Today: ${parts.join(" and ")} planned.`;
}
