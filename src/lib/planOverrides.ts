/**
 * Sets and reps (or set length) a user changed on a built-in plan,
 * remembered for their next session of it. Pure functions; loading and
 * saving live in supabaseFunctions.
 */

import type { ExerciseProgress, PlanExercise } from "./workouts";

// Exactly one of reps and durationSec is set, matching how the plan counts
// the exercise.
export type PlanOverride = {
  sets: number;
  reps: number | null;
  durationSec: number | null;
};

const isTimed = (value: { durationSec: number | null }) => value.durationSec !== null;

/**
 * Where an exercise starts in a new session: the plan's sets and reps, or the
 * user's remembered ones. An override only applies while it matches how the
 * plan counts the exercise, so a plan changed from reps to timed since then
 * starts from the plan.
 */
export function startingProgress(
  exercise: PlanExercise,
  override?: PlanOverride,
): ExerciseProgress {
  const use = override && isTimed(override) === isTimed(exercise) ? override : undefined;
  const sets = use?.sets ?? exercise.sets;
  return {
    sets,
    reps: use?.reps ?? exercise.reps,
    durationSec: use ? use.durationSec : exercise.durationSec,
    weightKg: null,
    setsRemaining: sets,
    completed: false,
  };
}

/** Whether an exercise is being done differently from the plan. */
export function differsFromPlan(exercise: PlanExercise, progress: ExerciseProgress): boolean {
  if (progress.sets !== exercise.sets) return true;
  return isTimed(progress)
    ? progress.durationSec !== exercise.durationSec
    : progress.reps !== exercise.reps;
}

/**
 * What to remember after a session of a built-in plan: each exercise done
 * differently from the plan, and each one back at the plan's values, whose
 * old override should go.
 */
export function overrideChanges(
  exercises: readonly PlanExercise[],
  progress: ReadonlyMap<string, ExerciseProgress>,
): { save: Map<string, PlanOverride>; clear: string[] } {
  const save = new Map<string, PlanOverride>();
  const clear: string[] = [];

  for (const exercise of exercises) {
    const entry = progress.get(exercise.workoutId);
    if (!entry) continue;

    if (!differsFromPlan(exercise, entry)) {
      clear.push(exercise.workoutId);
    } else if (isTimed(entry)) {
      save.set(exercise.workoutId, { sets: entry.sets, reps: null, durationSec: entry.durationSec });
    } else if (entry.reps >= 1) {
      // A counted exercise with no rep count (an old plan row whose reps
      // weren't a number) has nothing worth remembering.
      save.set(exercise.workoutId, { sets: entry.sets, reps: entry.reps, durationSec: null });
    }
  }

  return { save, clear };
}
