/**
 * Personal records: the best a user has done on each exercise, worked out
 * from the results saved with their finished sessions. Pure functions;
 * loading and saving live in supabaseFunctions.
 */

import { formatWeight, type WeightUnit } from "./units";
import {
  formatExerciseDuration,
  type ExerciseProgress,
  type PlanExercise,
} from "./workouts";

type FormatOptions = { spoken?: boolean; unit?: WeightUnit };

// One exercise as done in one finished session. Only exercises with at least
// one set logged are saved.
export type ExerciseResult = {
  workoutId: string;
  setsDone: number;
  // Per set. Null on timed exercises.
  reps: number | null;
  // Null when no weight was entered.
  weightKg: number | null;
  // Per set, on timed exercises only.
  durationSec: number | null;
};

// A result as loaded back from an earlier session: which one, and when.
export type SavedExerciseResult = ExerciseResult & { sessionId: string; savedAt: number };

// A counted best: the heaviest weight, ties going to more reps. No weight
// counts as 0 kg, so any weighted set beats a bodyweight one.
export type LiftRecord = { weightKg: number | null; reps: number };

// Kept per kind, since an exercise can be timed in one plan and counted in
// another (a plank held, or done as reps).
export type ExerciseRecords = {
  lift: LiftRecord | null;
  longestSec: number | null;
};

function liftOf(result: { reps: number | null; weightKg: number | null }): LiftRecord | null {
  if (result.reps === null || result.reps <= 0) return null;
  return {
    weightKg: result.weightKg !== null && result.weightKg > 0 ? result.weightKg : null,
    reps: result.reps,
  };
}

// Weights this close count as the same: it's the rounding of a weight typed
// in pounds (shown to 0.1 lb, about 0.045 kg), not a heavier lift. Without it,
// re-entering a 60 kg record as the 132.3 lb it's shown as would be a "PR".
const SAME_WEIGHT_KG = 0.05;

/** Positive when `a` is the better lift. */
export function compareLifts(a: LiftRecord, b: LiftRecord): number {
  const weight = (a.weightKg ?? 0) - (b.weightKg ?? 0);
  return Math.abs(weight) < SAME_WEIGHT_KG ? a.reps - b.reps : weight;
}

/** The best result per exercise, keyed by workout id. */
export function personalRecords(
  results: readonly ExerciseResult[],
): Map<string, ExerciseRecords> {
  const records = new Map<string, ExerciseRecords>();

  for (const result of results) {
    if (result.setsDone < 1) continue;
    const entry = records.get(result.workoutId) ?? { lift: null, longestSec: null };

    if (result.durationSec !== null && result.durationSec > 0) {
      entry.longestSec = Math.max(entry.longestSec ?? 0, result.durationSec);
    } else {
      const lift = liftOf(result);
      if (lift && (!entry.lift || compareLifts(lift, entry.lift) > 0)) entry.lift = lift;
    }
    records.set(result.workoutId, entry);
  }

  return records;
}

/**
 * The weight last used on each exercise: from the most recent session where
 * one was entered, so a session done without a weight doesn't erase it.
 * Timed exercises have none.
 */
export function lastWeights(
  results: readonly SavedExerciseResult[],
): Map<string, number> {
  const latest = new Map<string, { weightKg: number; savedAt: number }>();

  for (const result of results) {
    if (result.durationSec !== null || result.weightKg === null || result.weightKg <= 0) {
      continue;
    }
    const current = latest.get(result.workoutId);
    if (!current || result.savedAt > current.savedAt) {
      latest.set(result.workoutId, { weightKg: result.weightKg, savedAt: result.savedAt });
    }
  }

  return new Map([...latest].map(([workoutId, { weightKg }]) => [workoutId, weightKg]));
}

/**
 * What to save from a session: each exercise with at least one set logged,
 * as it was done (after any adjustments made during the session). A counted
 * exercise with no rep count (an old plan row whose reps weren't a number)
 * has nothing to record, so it's left out.
 */
export function sessionResults(
  exercises: readonly PlanExercise[],
  progress: ReadonlyMap<string, ExerciseProgress>,
): ExerciseResult[] {
  return exercises.flatMap((exercise) => {
    const entry = progress.get(exercise.workoutId);
    if (!entry) return [];
    const setsDone = Math.min(entry.sets, Math.max(0, entry.sets - entry.setsRemaining));
    if (setsDone < 1) return [];

    const timed = entry.durationSec !== null;
    if (!timed && entry.reps < 1) return [];
    return [{
      workoutId: exercise.workoutId,
      setsDone,
      reps: timed ? null : entry.reps,
      weightKg: timed ? null : entry.weightKg,
      durationSec: entry.durationSec,
    }];
  });
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

function formatLift(lift: LiftRecord, { spoken = false, unit = "kg" }: FormatOptions): string {
  const reps = plural(lift.reps, "rep");
  if (lift.weightKg === null) return reps;
  const weight = formatWeight(lift.weightKg, unit, { spoken });
  return spoken ? `${weight} for ${reps}` : `${weight} × ${reps}`;
}

/**
 * The record that applies to this exercise as it's being done now (timed or
 * counted), formatted: "60 kg × 8 reps", "15 reps", "1 min 30 sec". Null when
 * there's no record of that kind yet.
 */
export function formatRecord(
  progress: Pick<ExerciseProgress, "durationSec">,
  records: ExerciseRecords | undefined,
  options: FormatOptions = {},
): string | null {
  if (!records) return null;
  if (progress.durationSec !== null) {
    return records.longestSec === null
      ? null
      : formatExerciseDuration(records.longestSec, { spoken: options.spoken });
  }
  return records.lift === null ? null : formatLift(records.lift, options);
}

/**
 * What this session did on an exercise, in the same form as a record: "45 kg
 * × 6 reps", "12 reps", "1 min". Null when there's nothing recordable (a
 * counted exercise with no rep count).
 */
export function formatAttempt(
  progress: Pick<ExerciseProgress, "reps" | "weightKg" | "durationSec">,
  options: FormatOptions = {},
): string | null {
  if (progress.durationSec !== null) {
    return formatExerciseDuration(progress.durationSec, { spoken: options.spoken });
  }
  const lift = liftOf(progress);
  return lift === null ? null : formatLift(lift, options);
}

/**
 * Whether this session has beaten the exercise's previous record, once a set
 * is logged. Needs a previous record of the same kind: a first attempt isn't
 * flagged, or every new exercise would be.
 */
export function beatsRecord(
  progress: ExerciseProgress,
  records: ExerciseRecords | undefined,
): boolean {
  if (!records || progress.sets - progress.setsRemaining < 1) return false;

  if (progress.durationSec !== null) {
    return records.longestSec !== null && progress.durationSec > records.longestSec;
  }
  const lift = liftOf(progress);
  return lift !== null && records.lift !== null && compareLifts(lift, records.lift) > 0;
}
