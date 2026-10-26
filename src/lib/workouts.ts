import { getDay, parseISO } from "date-fns";
import type {
  PlanWorkoutSelection,
  Workout,
} from "@/components/context/workoutsDataContext";

// One exercise inside a plan, joined from workout_plan_workouts + workouts.
export type PlanExercise = {
  workoutId: string;
  name: string;
  instructions: string | null;
  muscleGroup: string | null;
  equipment: string | null;
  sets: number;
  reps: number;
  // Set on timed exercises (cardio, holds): how long each set lasts. Reps is
  // 0 on these.
  durationSec: number | null;
  position: number;
};

// How far through an exercise the user is. Kept separate from PlanExercise so
// the plan definition and the user's progress against it stay distinct.
export type ExerciseProgress = {
  sets: number;
  reps: number;
  durationSec: number | null;
  weightKg: number | null;
  setsRemaining: number;
  completed: boolean;
};

// ---------------------------------------------------------------------------
// Plan editors: how much of each exercise
// ---------------------------------------------------------------------------

// Reps per set, or a set length in minutes or seconds. Minutes suit cardio,
// seconds suit holds like a plank.
export type ExerciseAmountUnit = "reps" | "min" | "sec";

export const DEFAULT_SETS = 3;
// What a blank field falls back to, and what the field starts at when the
// user switches to that unit.
export const DEFAULT_AMOUNT: Record<ExerciseAmountUnit, number> = {
  reps: 10,
  min: 5,
  sec: 30,
};

// One exercise's fields in a plan editor, kept as text so a half-typed field
// doesn't become NaN.
export type ExerciseAmountDraft = {
  sets: string;
  unit: ExerciseAmountUnit;
  amount: string;
};

export function newExerciseDraft(): ExerciseAmountDraft {
  return {
    sets: String(DEFAULT_SETS),
    unit: "reps",
    amount: String(DEFAULT_AMOUNT.reps),
  };
}

/** A saved exercise back into editor fields, in the unit it reads best in. */
export function draftFromPlanExercise(
  exercise: Pick<PlanExercise, "sets" | "reps" | "durationSec">,
): ExerciseAmountDraft {
  const sets = String(exercise.sets);
  if (exercise.durationSec === null) {
    return { sets, unit: "reps", amount: String(exercise.reps) };
  }
  return exercise.durationSec % 60 === 0
    ? { sets, unit: "min", amount: String(exercise.durationSec / 60) }
    : { sets, unit: "sec", amount: String(exercise.durationSec) };
}

/**
 * Editor fields into what gets saved. Blank or zero fields fall back to the
 * defaults rather than writing 0.
 */
export function selectionFromDraft(
  workoutId: string,
  draft: ExerciseAmountDraft,
): PlanWorkoutSelection {
  const positive = (text: string, fallback: number) => {
    const value = Number(text);
    return Number.isInteger(value) && value > 0 ? value : fallback;
  };
  const sets = positive(draft.sets, DEFAULT_SETS);
  const amount = positive(draft.amount, DEFAULT_AMOUNT[draft.unit]);

  if (draft.unit === "reps") {
    return { workout_id: workoutId, sets, reps: amount, duration_seconds: null };
  }
  return {
    workout_id: workoutId,
    sets,
    reps: null,
    duration_seconds: draft.unit === "min" ? amount * 60 : amount,
  };
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * "45 sec", "30 min", "1 min 30 sec". `spoken` spells the units out for
 * screen readers: "1 minute 30 seconds".
 */
export function formatExerciseDuration(
  seconds: number,
  { spoken = false }: { spoken?: boolean } = {},
): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const min = spoken ? plural(minutes, "minute") : `${minutes} min`;
  const sec = spoken ? plural(rest, "second") : `${rest} sec`;
  if (minutes === 0) return sec;
  return rest === 0 ? min : `${min} ${sec}`;
}

/**
 * What an exercise asks for: "3 sets × 10 reps · 20 kg", "3 sets × 45 sec",
 * or just "30 min" for a single timed set. `spoken` gives the screen-reader
 * version: "3 sets of 10 reps at 20 kilograms".
 */
export function formatExerciseTarget(
  target: Pick<ExerciseProgress, "sets" | "reps" | "durationSec" | "weightKg">,
  { spoken = false }: { spoken?: boolean } = {},
): string {
  const { sets, reps, durationSec, weightKg } = target;

  if (durationSec !== null) {
    const each = formatExerciseDuration(durationSec, { spoken });
    if (sets === 1) return each;
    return spoken ? `${plural(sets, "set")} of ${each}` : `${plural(sets, "set")} × ${each}`;
  }

  const base = spoken
    ? `${plural(sets, "set")} of ${plural(reps, "rep")}`
    : `${plural(sets, "set")} × ${plural(reps, "rep")}`;
  if (weightKg === null) return base;
  return spoken ? `${base} at ${weightKg} kilograms` : `${base} · ${weightKg} kg`;
}

// `workouts: []` was an empty-tuple type (typo for `Workout[]`), which broke every real call site.
export function getWorkoutsWithTag(
  workouts: Workout[],
  tag: string,
): Workout[] {
  if (tag === "all") return workouts;
  else
    return workouts.filter(
      (workout) => workout.goal_tags?.includes(tag) ?? false,
    );
}

// Favorited workouts float to the top, everything else keeps its existing
// order. Copies before sorting because getWorkoutsWithTag returns the context's
// own array when the filter is "all" — sorting in place would mutate state.
export function sortFavoritesFirst(
  workouts: Workout[],
  favoriteIds: Set<string>,
): Workout[] {
  return [...workouts].sort((a, b) => {
    const aFav = favoriteIds.has(String(a.id)) ? 1 : 0;
    const bFav = favoriteIds.has(String(b.id)) ? 1 : 0;
    return bFav - aFav;
  });
}
