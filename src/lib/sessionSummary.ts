/**
 * Workout session summaries: the one shown right after finishing, and the
 * same view reopened later from History.
 */

import type { CompletedWorkout } from "@/components/context/workoutsDataContext";

import {
  beatsRecord,
  formatAttempt,
  formatRecord,
  personalRecords,
  type ExerciseRecords,
  type ExerciseResult,
  type SavedExerciseResult,
} from "./personalRecords";
import type { WeightUnit } from "./units";
import { getWorkoutStreak, getWorkoutsThisWeek } from "./workoutList";
import type { ExerciseProgress, PlanExercise } from "./workouts";

export type NewRecord = {
  workoutId: string;
  name: string;
  // What this session did, and the record it beat. Kept as numbers and
  // formatted when shown, in whichever weight unit is chosen then.
  attempt: Pick<ExerciseProgress, "reps" | "weightKg" | "durationSec">;
  previous: ExerciseRecords;
};

// What a session is measured against, saved with it so History can show it.
export type SessionTotals = {
  plannedMin: number | null;
  setsDone: number;
  setsTotal: number;
  exercisesDone: number;
  exercisesTotal: number;
};

type Count = { done: number; total: number };

export type SessionSummary = {
  planName: string;
  // As saved: elapsed time rounded up to the minute.
  minutes: number;
  // Null when no duration was planned or on older sessions without totals.
  plannedMin: number | null;
  sets: Count | null;
  // Exercises with at least one set logged, of those in the plan.
  exercises: Count | null;
  // Sets × reps × weight, over exercises with a weight entered.
  volumeKg: number;
  newRecords: NewRecord[];
  // Exercises done with no earlier record to compare against: a baseline to
  // beat next time.
  firstRecords: number;
  // Only right after finishing: where the streak and week stand, counting
  // this session.
  streak: { days: number; thisWeek: number } | null;
};

// One exercise as a session did it, checked against the records from before.
type Attempt = { workoutId: string; name: string; progress: ExerciseProgress };

function compareToRecords(
  attempts: readonly Attempt[],
  records: ReadonlyMap<string, ExerciseRecords>,
): { newRecords: NewRecord[]; firstRecords: number } {
  const newRecords: NewRecord[] = [];
  let firstRecords = 0;

  for (const { workoutId, name, progress } of attempts) {
    const record = records.get(workoutId);
    const result = formatAttempt(progress);
    const previous = formatRecord(progress, record);
    if (record && beatsRecord(progress, record) && result !== null && previous !== null) {
      newRecords.push({
        workoutId,
        name,
        attempt: { reps: progress.reps, weightKg: progress.weightKg, durationSec: progress.durationSec },
        previous: record,
      });
    } else if (previous === null && result !== null) {
      firstRecords += 1;
    }
  }

  return { newRecords, firstRecords };
}

function volumeOf(progress: ExerciseProgress, setsDone: number): number {
  return progress.durationSec === null &&
    progress.weightKg !== null &&
    progress.weightKg > 0 &&
    progress.reps > 0
    ? setsDone * progress.reps * progress.weightKg
    : 0;
}

/** The totals for a session, as they're saved with it. */
export function sessionTotals(
  exercises: readonly PlanExercise[],
  progress: ReadonlyMap<string, ExerciseProgress>,
  plannedMin: number | null,
): SessionTotals {
  let setsDone = 0;
  let setsTotal = 0;
  let exercisesDone = 0;

  for (const exercise of exercises) {
    const entry = progress.get(exercise.workoutId);
    // Sets can be edited mid-session, so count against the session's target.
    const sets = entry?.sets ?? exercise.sets;
    const remaining = entry?.setsRemaining ?? sets;
    const done = Math.min(sets, Math.max(0, sets - remaining));
    setsTotal += sets;
    setsDone += done;
    if (done > 0) exercisesDone += 1;
  }

  return { plannedMin, setsDone, setsTotal, exercisesDone, exercisesTotal: exercises.length };
}

/** The summary shown right after a session is saved. */
export function buildSessionSummary({
  planName,
  elapsedMs,
  totals,
  exercises,
  progress,
  records,
  history,
}: {
  planName: string;
  elapsedMs: number;
  totals: SessionTotals;
  exercises: readonly PlanExercise[];
  progress: ReadonlyMap<string, ExerciseProgress>;
  records: ReadonlyMap<string, ExerciseRecords>;
  // Sessions saved before this one. The list refreshes after a save, but the
  // summary shouldn't wait for that, so this session is counted on top.
  history: readonly CompletedWorkout[];
}): SessionSummary {
  const minutes = Math.max(1, Math.ceil(elapsedMs / 60000));
  let volumeKg = 0;
  const attempts: Attempt[] = [];

  for (const exercise of exercises) {
    const entry = progress.get(exercise.workoutId);
    if (!entry) continue;
    const done = Math.min(entry.sets, Math.max(0, entry.sets - entry.setsRemaining));
    if (done < 1) continue;
    volumeKg += volumeOf(entry, done);
    attempts.push({ workoutId: exercise.workoutId, name: exercise.name, progress: entry });
  }

  const withThisSession: CompletedWorkout[] = [
    ...history,
    {
      id: "this-session",
      name: planName,
      duration_min: minutes,
      completed_at: new Date().toISOString(),
      workout_plan_id: null,
      workout_type: null,
      sets_done: totals.setsDone,
      sets_total: totals.setsTotal,
    },
  ];

  return {
    planName,
    minutes,
    plannedMin: totals.plannedMin,
    sets: { done: totals.setsDone, total: totals.setsTotal },
    exercises: { done: totals.exercisesDone, total: totals.exercisesTotal },
    volumeKg: Math.round(volumeKg),
    ...compareToRecords(attempts, records),
    streak: {
      days: getWorkoutStreak(withThisSession),
      thisWeek: getWorkoutsThisWeek(withThisSession),
    },
  };
}

/**
 * A finished session's summary, reopened from History. Its records are
 * worked out again from the results saved before it, so a session deleted
 * since no longer counts as a record that this one did or didn't beat.
 */
export function buildHistorySummary({
  planName,
  minutes,
  totals,
  sessionId,
  sessionResults,
  allResults,
}: {
  planName: string;
  minutes: number;
  // Null on sessions saved before totals were recorded.
  totals: SessionTotals | null;
  sessionId: string;
  // This session's results, with each exercise's name.
  sessionResults: readonly (SavedExerciseResult & { name: string })[];
  // Every saved result for the same exercises, from any session.
  allResults: readonly SavedExerciseResult[];
}): SessionSummary {
  const savedAt = Math.min(...sessionResults.map((result) => result.savedAt));
  const earlier = allResults.filter(
    (result) => result.sessionId !== sessionId && result.savedAt < savedAt,
  );

  let volumeKg = 0;
  const attempts: Attempt[] = sessionResults.map((result) => {
    const progress: ExerciseProgress = {
      sets: result.setsDone,
      reps: result.reps ?? 0,
      durationSec: result.durationSec,
      weightKg: result.weightKg,
      setsRemaining: 0,
      completed: true,
    };
    volumeKg += volumeOf(progress, result.setsDone);
    return { workoutId: result.workoutId, name: result.name, progress };
  });

  return {
    planName,
    minutes,
    plannedMin: totals?.plannedMin ?? null,
    sets: totals ? { done: totals.setsDone, total: totals.setsTotal } : null,
    exercises: totals ? { done: totals.exercisesDone, total: totals.exercisesTotal } : null,
    volumeKg: Math.round(volumeKg),
    ...compareToRecords(attempts, personalRecords(earlier)),
    streak: null,
  };
}

/**
 * A new record as shown: "45 kg × 6 reps", the "40 kg × 6 reps" it beat, and
 * a sentence for screen readers.
 */
export function describeNewRecord(
  record: NewRecord,
  unit: WeightUnit,
): { result: string; previous: string; spoken: string } {
  const result = formatAttempt(record.attempt, { unit }) ?? "";
  const previous = formatRecord(record.attempt, record.previous, { unit }) ?? "";
  const resultSpoken = formatAttempt(record.attempt, { unit, spoken: true }) ?? "";
  const previousSpoken = formatRecord(record.attempt, record.previous, { unit, spoken: true }) ?? "";
  return {
    result,
    previous,
    spoken: `${record.name}: ${resultSpoken}, beating your previous best of ${previousSpoken}`,
  };
}

// ---------------------------------------------------------------------------
// Per-exercise breakdown, for a session's row in History
// ---------------------------------------------------------------------------

export type SessionExercise = {
  workoutId: string;
  name: string;
  setsDone: number;
  // Sets the plan has for it now. Null when the exercise is no longer in the
  // plan, or the plan was deleted.
  setsTotal: number | null;
  // What each set was: reps and weight, or a time. Null when no set was logged.
  result: Pick<ExerciseProgress, "reps" | "weightKg" | "durationSec"> | null;
};

/**
 * Every exercise in the plan, in plan order, with what this session did for
 * it — 0 sets for the ones it skipped. Only exercises with a set logged are
 * saved, so an exercise since removed from the plan is still listed, after
 * the rest.
 */
export function buildSessionExercises(
  plan: readonly PlanExercise[],
  results: readonly (ExerciseResult & { name: string })[],
): SessionExercise[] {
  const byWorkout = new Map(results.map((result) => [result.workoutId, result]));
  const fromResult = (result: ExerciseResult) => ({
    reps: result.reps ?? 0,
    weightKg: result.weightKg,
    durationSec: result.durationSec,
  });

  const planned: SessionExercise[] = plan.map((exercise) => {
    const result = byWorkout.get(exercise.workoutId);
    return {
      workoutId: exercise.workoutId,
      name: exercise.name,
      setsDone: result?.setsDone ?? 0,
      setsTotal: exercise.sets,
      result: result ? fromResult(result) : null,
    };
  });

  const inPlan = new Set(plan.map((exercise) => exercise.workoutId));
  const extra: SessionExercise[] = results
    .filter((result) => !inPlan.has(result.workoutId))
    .map((result) => ({
      workoutId: result.workoutId,
      name: result.name,
      setsDone: result.setsDone,
      setsTotal: null,
      result: fromResult(result),
    }));

  return [...planned, ...extra];
}

/** "2 of 4 sets · 40 kg × 6 reps", "3 sets · 45 sec", or "Skipped". */
export function describeSessionExercise(
  exercise: SessionExercise,
  unit: WeightUnit,
): string {
  if (exercise.setsDone === 0) return "Skipped";
  const total = exercise.setsTotal ?? exercise.setsDone;
  const sets =
    exercise.setsTotal === null
      ? `${exercise.setsDone} ${exercise.setsDone === 1 ? "set" : "sets"}`
      : `${exercise.setsDone} of ${total} ${total === 1 ? "set" : "sets"}`;
  const each = exercise.result ? formatAttempt(exercise.result, { unit }) : null;
  return each ? `${sets} · ${each}` : sets;
}
