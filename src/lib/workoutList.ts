/**
 * Helpers for the workouts list and history: filtering, "last done",
 * equipment, and the history summary. Pure functions over data the contexts
 * already hold.
 *
 * A separate file from lib/workouts.ts on purpose: that one is being reworked
 * on tb-update-workout-timer-page, and a new file can't conflict with it.
 */

import {
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarWeeks,
  startOfWeek,
  subWeeks,
} from "date-fns";

import type {
  CompletedWorkout,
  Workout,
} from "@/components/context/workoutsDataContext";

import { getWorkoutsWithTag } from "./workouts";

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** "full body" -> "Full body", the same casing the goal-tag chips use. */
export function sentenceCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export type PlanSource = "all" | "mine" | "built-in";

export type WorkoutFilters = {
  /** "all", or one of the plans' goal tags. */
  tag: string;
  source: PlanSource;
  /** Normalized (lowercase); null means any. */
  difficulty: string | null;
  target: string | null;
};

export const NO_FILTERS: WorkoutFilters = {
  tag: "all",
  source: "all",
  difficulty: null,
  target: null,
};

export function hasActiveFilters(filters: WorkoutFilters): boolean {
  return (
    filters.tag !== "all" ||
    filters.source !== "all" ||
    filters.difficulty !== null ||
    filters.target !== null
  );
}

/**
 * Seeded plans have no author; a user's own plans carry their id. Difficulty
 * and target compare case-insensitively, since they're free text in the
 * database and "Beginner" and "beginner" mean the same thing.
 */
export function filterWorkouts(
  workouts: Workout[],
  filters: WorkoutFilters,
  userId: string | undefined,
): Workout[] {
  return getWorkoutsWithTag(workouts, filters.tag).filter((workout) => {
    if (filters.source === "mine" && (!userId || workout.created_by !== userId)) {
      return false;
    }
    if (filters.source === "built-in" && workout.created_by) return false;
    if (filters.difficulty && normalize(workout.difficulty) !== filters.difficulty) {
      return false;
    }
    if (filters.target && normalize(workout.target) !== filters.target) {
      return false;
    }
    return true;
  });
}

// Ordering for difficulty, which has a natural order alphabetical would break
// ("advanced" before "beginner"). Unlisted values sort after these.
const DIFFICULTY_ORDER = [
  "beginner",
  "easy",
  "intermediate",
  "medium",
  "advanced",
  "hard",
];

/**
 * The values actually present across the plans, so the filter menus only
 * ever offer choices that match something.
 */
export function filterOptions(
  workouts: Workout[],
  field: "difficulty" | "target",
): string[] {
  const values = [
    ...new Set(workouts.map((workout) => normalize(workout[field])).filter(Boolean)),
  ];

  if (field === "difficulty") {
    const rank = (value: string) => {
      const index = DIFFICULTY_ORDER.indexOf(value);
      return index === -1 ? DIFFICULTY_ORDER.length : index;
    };
    return values.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }

  return values.sort((a, b) => a.localeCompare(b));
}

// ---------------------------------------------------------------------------
// Last done
// ---------------------------------------------------------------------------

/**
 * Most recent completion per plan, as a timestamp. Sessions whose plan was
 * since deleted have no plan id and are skipped.
 */
export function lastDoneByPlan(
  completed: CompletedWorkout[],
): Map<string, number> {
  const latest = new Map<string, number>();

  for (const session of completed) {
    if (!session.workout_plan_id) continue;
    const at = new Date(session.completed_at).getTime();
    if (!Number.isFinite(at)) continue;

    const id = String(session.workout_plan_id);
    if (at > (latest.get(id) ?? -Infinity)) latest.set(id, at);
  }

  return latest;
}

/**
 * "Done today", "Done 3 days ago", "Done 2 weeks ago". Calendar days, so a
 * workout at 11pm last night reads as yesterday, not as "0 days ago".
 */
export function formatLastDone(at: number, now: Date = new Date()): string {
  const days = differenceInCalendarDays(now, at);

  if (days <= 0) return "Done today";
  if (days === 1) return "Done yesterday";
  if (days < 7) return `Done ${days} days ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `Done ${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }

  const months = Math.max(1, differenceInCalendarMonths(now, at));
  return `Done ${months} month${months === 1 ? "" : "s"} ago`;
}

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------

// Values meaning "nothing to bring". Equipment is free text in the database,
// so this is matched loosely.
const NO_EQUIPMENT = new Set([
  "none",
  "bodyweight",
  "body weight",
  "body-weight",
  "no equipment",
]);

const MAX_EQUIPMENT_SHOWN = 3;

/**
 * One plan's equipment as a short line for its card, or null when there's
 * nothing known to say. An empty list means no exercise recorded any
 * equipment — unknown, which is not the same as "none needed".
 */
export function formatEquipment(
  items: readonly string[] | undefined,
): string | null {
  if (!items || items.length === 0) return null;

  const needed = [
    ...new Set(items.map(normalize).filter((item) => item && !NO_EQUIPMENT.has(item))),
  ];
  if (needed.length === 0) return "No equipment needed";

  const shown = needed.slice(0, MAX_EQUIPMENT_SHOWN).map(sentenceCase);
  const more = needed.length - shown.length;
  return more > 0 ? `${shown.join(", ")} +${more} more` : shown.join(", ");
}

// ---------------------------------------------------------------------------
// History summary
// ---------------------------------------------------------------------------
// The first three are moved unchanged from the home tab, so Home and History
// count streaks and weeks the same way. Note the streak only counts if there
// is a workout today: before the first one of the day it reads 0.

export function getWorkoutStreak(completedWorkouts: CompletedWorkout[]) {
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

export function getWorkoutsThisWeek(completedWorkouts: CompletedWorkout[]) {
  const now = new Date();
  const startOfWeek = new Date(now);

  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  return completedWorkouts.filter(
    (workout) => new Date(workout.completed_at) >= startOfWeek,
  ).length;
}

export function hasWorkoutToday(completedWorkouts: CompletedWorkout[]) {
  const today = new Date().toDateString();

  return completedWorkouts.some(
    (workout) => new Date(workout.completed_at).toDateString() === today,
  );
}

export function getTotalMinutes(completedWorkouts: CompletedWorkout[]): number {
  return completedWorkouts.reduce(
    (sum, workout) => sum + (Number(workout.duration_min) || 0),
    0,
  );
}

/**
 * The plan done most often, ties going to the one done most recently.
 * Sessions from deleted plans are left out: "Deleted plan" winning would tell
 * the user nothing.
 */
export function getMostDonePlan(
  completedWorkouts: CompletedWorkout[],
): { name: string; count: number } | null {
  const tally = new Map<string, { name: string; count: number; latest: number }>();

  for (const workout of completedWorkouts) {
    if (!workout.workout_plan_id) continue;
    const id = String(workout.workout_plan_id);
    const at = new Date(workout.completed_at).getTime();
    const entry = tally.get(id);

    if (entry) {
      entry.count += 1;
      entry.latest = Math.max(entry.latest, at);
    } else {
      tally.set(id, { name: workout.name, count: 1, latest: at });
    }
  }

  let best: { name: string; count: number; latest: number } | null = null;
  for (const entry of tally.values()) {
    if (
      !best ||
      entry.count > best.count ||
      (entry.count === best.count && entry.latest > best.latest)
    ) {
      best = entry;
    }
  }

  return best ? { name: best.name, count: best.count } : null;
}

/** "45 min", "1 h", "12 h 30 min". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** "12/15 sets", or null for sessions saved before sets were recorded. */
export function formatSetsDone(workout: CompletedWorkout): string | null {
  if (workout.sets_done === null || workout.sets_total === null) return null;
  return `${workout.sets_done}/${workout.sets_total} ${workout.sets_total === 1 ? "set" : "sets"}`;
}

/**
 * One history line: "Chest, back, arms · 12/15 sets · 45 min". The type and
 * sets drop out when unknown (deleted plan, or an older session).
 */
export function describeSession(workout: CompletedWorkout): string {
  return [workout.workout_type, formatSetsDone(workout), formatDuration(workout.duration_min)]
    .filter((part): part is string => part !== null)
    .join(" · ");
}

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

export type WeekCount = { weekStart: Date; count: number };

/**
 * Finished sessions per week for the last `weeks` weeks, oldest first, the
 * last being this week. Weeks start on Sunday, like "this week" everywhere
 * else in the app.
 */
export function workoutsPerWeek(
  completedWorkouts: readonly CompletedWorkout[],
  weeks = 8,
  now: Date = new Date(),
): WeekCount[] {
  const thisWeek = startOfWeek(now);
  const counts: WeekCount[] = Array.from({ length: weeks }, (_, index) => ({
    weekStart: subWeeks(thisWeek, weeks - 1 - index),
    count: 0,
  }));

  for (const workout of completedWorkouts) {
    const at = new Date(workout.completed_at);
    if (Number.isNaN(at.getTime())) continue;
    const weeksAgo = differenceInCalendarWeeks(now, at);
    if (weeksAgo >= 0 && weeksAgo < weeks) counts[weeks - 1 - weeksAgo].count += 1;
  }

  return counts;
}
