// Pure, synchronous scoring/feedback logic for the home screen's "Wellness Score".
// Kept free of I/O and React so it's easy to unit test — index.tsx just feeds it
// the arrays/records it already pulls from the various data contexts.

import { subDays, format } from "date-fns";
import {
  CompletionsByDate,
  Habit,
  isHabitDone,
  isHabitOnDate,
} from "@/lib/habits/habits";
import type { CompletedWorkout, Workout } from "@/components/context/workoutsDataContext";
import type { Ingredient } from "@/lib/meals/meals";

// ---------------------------------------------------------------------------
// Shared scoring types
// ---------------------------------------------------------------------------

// A single input into the overall Wellness Score. `value` is null when there
// isn't enough data to say anything meaningful yet (e.g. no habits scheduled,
// no workouts ever logged) — computeWellnessScore excludes null components
// from the average instead of letting them drag the score toward 0.
export type WellnessComponent = {
  key: string;
  label: string;
  value: number | null; // 0-1
  detail: string;
};

// Averages whatever components have data and scales to 0-100. Returns null
// only when every component is null (brand new user, nothing tracked yet).
export function computeWellnessScore(
  components: WellnessComponent[],
): number | null {
  const scored = components
    .map((c) => c.value)
    .filter((v): v is number => v !== null);
  if (!scored.length) return null;
  const avg = scored.reduce((sum, v) => sum + v, 0) / scored.length;
  return Math.round(avg * 100);
}

// ---------------------------------------------------------------------------
// Habit consistency
// ---------------------------------------------------------------------------

export type HabitConsistency = {
  habit: Habit;
  scheduledCount: number;
  completedCount: number;
  rate: number; // 0-1
};

export type HabitConsistencyStats = {
  rate: number | null; // overall rate across all habits, null if nothing was scheduled
  windowDays: number;
  perHabit: HabitConsistency[]; // only habits scheduled at least once in the window
  mostConsistent: HabitConsistency[];
  mostSkipped: HabitConsistency[];
};

// Looks back `windowDays` (including today) and, for each habit, counts how
// many of its scheduled occurrences were actually completed.
export function getHabitConsistencyStats(
  habitArray: Habit[],
  habitCompletions: CompletionsByDate,
  today: string,
  windowDays = 7,
): HabitConsistencyStats {
  const todayDate = new Date(`${today}T00:00:00`);
  const window = Array.from({ length: windowDays }, (_, i) =>
    format(subDays(todayDate, i), "yyyy-MM-dd"),
  );

  const perHabit: HabitConsistency[] = habitArray
    .map((habit) => {
      const scheduledDates = window.filter((date) => isHabitOnDate(habit, date));
      const completedCount = scheduledDates.filter((date) =>
        isHabitDone(habit.id, date, habitCompletions),
      ).length;
      return {
        habit,
        scheduledCount: scheduledDates.length,
        completedCount,
        rate: scheduledDates.length > 0 ? completedCount / scheduledDates.length : 0,
      };
    })
    .filter((h) => h.scheduledCount > 0);

  const totalScheduled = perHabit.reduce((sum, h) => sum + h.scheduledCount, 0);
  const totalCompleted = perHabit.reduce((sum, h) => sum + h.completedCount, 0);
  const rate = totalScheduled > 0 ? totalCompleted / totalScheduled : null;

  const sortedByRate = [...perHabit].sort((a, b) => b.rate - a.rate);
  const mostConsistent = sortedByRate.filter((h) => h.rate >= 0.8).slice(0, 2);
  const mostSkipped = [...perHabit]
    .filter((h) => h.rate < 0.5)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 2);

  return { rate, windowDays, perHabit, mostConsistent, mostSkipped };
}

// ---------------------------------------------------------------------------
// Workout category balance
// ---------------------------------------------------------------------------

export type WorkoutCategoryCount = {
  category: string;
  count: number;
};

export type WorkoutCategoryStats = {
  weeklyRate: number | null; // completed this week vs weeklyTarget, capped at 1
  workoutsThisWeek: number;
  weeklyTarget: number;
  prioritized: WorkoutCategoryCount[]; // most-completed categories
  lesserUsed: WorkoutCategoryCount[]; // categories in the catalog you rarely/never touch
};

// Completed workouts only carry id/name/duration, not a category, so we join
// back to the workout catalog (by id, falling back to name) to recover `target`.
function resolveCategory(
  completed: CompletedWorkout,
  categoryById: Map<string, string>,
  categoryByName: Map<string, string>,
): string {
  return (
    categoryById.get(completed.id) ??
    categoryByName.get(completed.name) ??
    "Other"
  );
}

export function getWorkoutCategoryStats(
  workoutList: Workout[],
  completedWorkouts: CompletedWorkout[],
  workoutsThisWeek: number,
  weeklyTarget = 4,
): WorkoutCategoryStats {
  const categoryById = new Map(workoutList.map((w) => [w.id, w.target]));
  const categoryByName = new Map(workoutList.map((w) => [w.name, w.target]));

  const counts = new Map<string, number>();
  for (const completed of completedWorkouts) {
    const category = resolveCategory(completed, categoryById, categoryByName);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  const allCategories = new Set<string>([
    ...workoutList.map((w) => w.target),
    ...counts.keys(),
  ]);

  const ranked: WorkoutCategoryCount[] = [...allCategories]
    .map((category) => ({ category, count: counts.get(category) ?? 0 }))
    .sort((a, b) => b.count - a.count);

  const prioritized = ranked.filter((c) => c.count > 0).slice(0, 3);
  const lesserUsed = [...ranked]
    .sort((a, b) => a.count - b.count)
    .filter((c) => c.count < (prioritized[prioritized.length - 1]?.count ?? 1))
    .slice(0, 3);

  return {
    weeklyRate: completedWorkouts.length > 0 ? Math.min(workoutsThisWeek / weeklyTarget, 1) : null,
    workoutsThisWeek,
    weeklyTarget,
    prioritized,
    lesserUsed,
  };
}

// ---------------------------------------------------------------------------
// Ingredient / nutrient gap heuristic
// ---------------------------------------------------------------------------

// Ingredients only carry a name + broad category (protein, vegetable, fruit,
// dairy, ...) in this app's schema — no per-ingredient nutrient data. This is
// a heuristic: it maps each category to the vitamins/nutrients it typically
// provides so we can flag categories that are thin or missing from the
// fridge, rather than claiming precise nutrient tracking.
const CATEGORY_NUTRIENTS: Record<string, string[]> = {
  protein: ["Vitamin B12", "Iron", "Zinc"],
  vegetable: ["Vitamin A", "Vitamin C", "Vitamin K", "Fiber"],
  produce: ["Vitamin A", "Vitamin C", "Vitamin K", "Fiber"],
  fruit: ["Vitamin C", "Potassium", "Fiber"],
  grain: ["B Vitamins", "Fiber"],
  grains: ["B Vitamins", "Fiber"],
  dairy: ["Calcium", "Vitamin D"],
};

export type IngredientCategoryCount = {
  category: string;
  count: number;
  exampleNames: string[];
};

export type NutrientGapStats = {
  coverage: number | null; // fraction of tracked nutrient categories represented in the fridge
  commonlyStocked: IngredientCategoryCount[];
  possiblyMissing: string[]; // vitamin/nutrient names with no supporting category in the fridge
};

export function getNutrientGapStats(
  ingredients: Ingredient[],
  fridgeIds: ReadonlySet<string>,
): NutrientGapStats {
  const byCategory = new Map<string, Ingredient[]>();
  for (const ingredient of ingredients) {
    if (!fridgeIds.has(ingredient.id)) continue;
    const category = ingredient.category?.trim() || "other";
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category)!.push(ingredient);
  }

  const commonlyStocked: IngredientCategoryCount[] = [...byCategory.entries()]
    .map(([category, items]) => ({
      category,
      count: items.length,
      exampleNames: items.slice(0, 3).map((i) => i.name),
    }))
    .sort((a, b) => b.count - a.count);

  const trackedCategories = Object.keys(CATEGORY_NUTRIENTS);
  const coveredCategories = trackedCategories.filter((c) => (byCategory.get(c)?.length ?? 0) > 0);

  const coveredNutrients = new Set(
    coveredCategories.flatMap((c) => CATEGORY_NUTRIENTS[c]),
  );
  const allTrackedNutrients = new Set(
    trackedCategories.flatMap((c) => CATEGORY_NUTRIENTS[c]),
  );
  const possiblyMissing = [...allTrackedNutrients].filter(
    (n) => !coveredNutrients.has(n),
  );

  const coverage =
    trackedCategories.length > 0
      ? coveredCategories.length / trackedCategories.length
      : null;

  return { coverage, commonlyStocked, possiblyMissing };
}
