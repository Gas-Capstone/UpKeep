import { supabase } from "./supabaseClient";
import type { Weekday } from "./habits/habits";
import type { ScheduledWorkout, WorkoutSchedule } from "./workoutSchedule";
import type { PlanWorkoutSelection } from "@/components/context/workoutsDataContext";
import type { ExerciseResult, SavedExerciseResult } from "./personalRecords";
import type { PlanOverride } from "./planOverrides";
import type { SessionTotals } from "./sessionSummary";
import type { PlanExercise } from "./workouts";

type UserRef = { id: string };
type WorkoutRef = { id: string };
type HabitInput = { title: string; time: string; weekdays: Weekday[] };

// Seeded plans have a null created_by and are visible to everyone; user-made
// plans are only visible to their author.
export async function getWorkouts(user: UserRef) {
  const { data, error } = await supabase
    .from("workout_plans")
    .select("*")
    .or(`created_by.is.null,created_by.eq.${user.id}`);
  if (error) console.log("Error fetching workouts from database: ", error);
  return data;
}

/* --------------
    WORKOUT PLAN CREATION
------------- */
// The `workouts` table holds the individual exercises a plan is built from —
// distinct from `workout_plans`, which is what the workouts page displays.
export async function getAvailableWorkouts() {
  const { data, error } = await supabase
    .from("workouts")
    .select("id, name, muscle_group, equipment, instructions")
    .order("name", { ascending: true });
  if (error) console.log("Error fetching available workouts: ", error);
  return data;
}

export async function createWorkoutPlan(
  user: UserRef,
  plan: {
    name: string;
    difficulty: string;
    target: string;
    duration_min: number;
  },
  selections: PlanWorkoutSelection[],
) {
  const { data, error } = await supabase
    .from("workout_plans")
    .insert({
      name: plan.name,
      difficulty: plan.difficulty,
      target: plan.target,
      duration_min: plan.duration_min,
      created_by: user.id,
    })
    .select()
    .single();
  if (error) {
    console.log("Error creating workout plan: ", error);
    return null;
  }

  if (selections.length > 0) {
    // `position` preserves the order the user arranged the workouts in,
    // since row order coming back from Postgres isn't guaranteed.
    const rows = selections.map((selection, index) => ({
      workout_plan_id: data.id,
      workout_id: selection.workout_id,
      sets: selection.sets,
      reps: selection.reps,
      duration_seconds: selection.duration_seconds,
      position: index,
    }));
    const { error: linkError } = await supabase
      .from("workout_plan_workouts")
      .insert(rows);
    if (linkError) {
      console.log("Error adding workouts to plan: ", linkError);
      // There's no transaction across these two inserts, so undo the plan
      // rather than leaving a nameless empty plan stranded in the list.
      await supabase.from("workout_plans").delete().eq("id", data.id);
      return null;
    }
  }

  return data;
}

// Returns the new session's id, so its exercise results can be saved with it.
export async function setWorkoutComplete(
  user: UserRef | null | undefined,
  workout: WorkoutRef,
  durationMin: number,
  totals?: SessionTotals,
): Promise<string> {
  if (!user?.id) throw new Error("Sign in to save a workout.");

  // The column is workout_plan_id, not workout_id — it was renamed alongside
  // workouts -> workout_plans, and this insert was missed at the time.
  const session = {
    user_id: user.id,
    workout_plan_id: workout.id,
    duration_min: durationMin,
  };
  const insert = (row: object) =>
    supabase.from("workout_sessions").insert(row).select("id").single();

  let { data, error } = await insert(
    totals
      ? {
          ...session,
          planned_min: totals.plannedMin,
          sets_done: totals.setsDone,
          sets_total: totals.setsTotal,
          exercises_done: totals.exercisesDone,
          exercises_total: totals.exercisesTotal,
        }
      : session,
  );
  // PGRST204: a column the database doesn't have yet. Until the history
  // migration runs, save the workout without its totals rather than not at
  // all.
  if (error?.code === "PGRST204" && totals) {
    ({ data, error } = await insert(session));
  }
  if (error) throw error;
  if (!data) throw new Error("The workout was saved but its id didn't come back.");
  return String(data.id);
}

export async function getCompletedWorkouts(user: UserRef) {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(
      `
            id,
            duration_min,
            completed_at,
            workout_plan_id,
            sets_done,
            sets_total,
            workout_plans ( name, target )
        `,
    )
    .eq("user_id", user.id)
    .order("completed_at", { ascending: false });
  if (error) console.log("Error fetching completed workouts: ", error);

  return (data ?? []).map((session) => {
    // A to-one embed: one plan, or null once the plan has been deleted.
    const plan = session.workout_plans as unknown as {
      name: string;
      target: string | null;
    } | null;
    return {
      id: session.id,
      duration_min: session.duration_min,
      completed_at: session.completed_at,
      // Lets a scheduled workout count as done when its plan was logged that day.
      workout_plan_id: (session.workout_plan_id as string | null) ?? null,
      // workout_plan_id is ON DELETE SET NULL, so a session outlives the plan it
      // was logged against and the embed comes back null. The workout still
      // happened — keep the row, just say what's missing.
      name: plan?.name ?? "Deleted plan",
      workout_type: plan?.target?.trim() || null,
      sets_done: (session.sets_done as number | null) ?? null,
      sets_total: (session.sets_total as number | null) ?? null,
    };
  });
}

/* --------------
    PLAN EDITING
------------- */
/**
 * Points a plan at a photo the user uploaded. RLS restricts updates to the
 * author, so a seeded plan is rejected by the database rather than here.
 */
export async function setWorkoutPlanImage(planId: string, imageUrl: string) {
  const { error } = await supabase
    .from("workout_plans")
    .update({ image_url: imageUrl })
    .eq("id", planId);

  if (error) throw error;
}

export async function updateWorkoutPlan(
    planId: string,
    plan: { name: string; difficulty: string; target: string; duration_min: number },
) {
    const { error } = await supabase
        .from("workout_plans")
        .update({
            name: plan.name,
            difficulty: plan.difficulty,
            target: plan.target,
            duration_min: plan.duration_min,
        })
        .eq("id", planId)
    if (error) {
        console.log("Error updating workout plan: ", error)
        return false
    }
    return true
}

/**
 * Replaces a plan's exercise list wholesale. Simpler and less error-prone than
 * diffing adds/removes/reorders, and the lists are small enough that the extra
 * write costs nothing.
 */
export async function replacePlanExercises(
    planId: string,
    selections: PlanWorkoutSelection[],
) {
    const { error: deleteError } = await supabase
        .from("workout_plan_workouts")
        .delete()
        .eq("workout_plan_id", planId)
    if (deleteError) {
        console.log("Error clearing plan exercises: ", deleteError)
        return false
    }

    if (selections.length === 0) return true

    const rows = selections.map((selection, index) => ({
        workout_plan_id: planId,
        workout_id: selection.workout_id,
        sets: selection.sets,
        reps: selection.reps,
        duration_seconds: selection.duration_seconds,
        position: index,
    }))
    const { error: insertError } = await supabase
        .from("workout_plan_workouts")
        .insert(rows)
    if (insertError) {
        console.log("Error saving plan exercises: ", insertError)
        return false
    }
    return true
}

// Rows in workout_plan_workouts, favorites and meal/session references cascade
// from the plan's own foreign keys, so only the plan row is deleted here.
export async function deleteWorkoutPlan(planId: string) {
    const { error } = await supabase
        .from("workout_plans")
        .delete()
        .eq("id", planId)
    if (error) {
        console.log("Error deleting workout plan: ", error)
        return false
    }
    return true
}

/* --------------
    PLAN EXERCISES
------------- */
// The exercises that make up a plan, in the order they were arranged.
type PlanExerciseRow = {
  workout_id: string;
  sets: number | null;
  // A text column: whole numbers as written by the app.
  reps: string | null;
  duration_seconds: number | null;
  position: number | null;
  workouts: {
    name: string | null;
    instructions: string | null;
    muscle_group: string | null;
    equipment: string | null;
  } | null;
};

export async function getPlanExercises(
  workoutPlanId: string,
  options?: { throwOnError?: boolean },
): Promise<PlanExercise[]> {
  const { data, error } = await supabase
    .from("workout_plan_workouts")
    .select("workout_id, sets, reps, duration_seconds, position, workouts ( name, instructions, muscle_group, equipment )")
    .eq("workout_plan_id", workoutPlanId)
    .order("position", { ascending: true })
    .returns<PlanExerciseRow[]>();
  if (error) {
    console.log("Error fetching plan exercises: ", error);
    if (options?.throwOnError) throw error;
    return [];
  }
  return (data ?? []).map((row) => {
    // Anything that isn't a whole number (or is missing, as on timed rows)
    // reads as 0 rather than reaching the screen as text.
    const reps = Number(row.reps);
    return {
      workoutId: String(row.workout_id),
      name: row.workouts?.name ?? "Unknown exercise",
      instructions: row.workouts?.instructions ?? null,
      muscleGroup: row.workouts?.muscle_group ?? null,
      equipment: row.workouts?.equipment ?? null,
      sets: row.sets ?? 0,
      reps: Number.isInteger(reps) && reps > 0 ? reps : 0,
      durationSec: row.duration_seconds,
      position: row.position ?? 0,
    };
  });
}

/* --------------
    FAVORITE WORKOUTS
------------- */
// favorite_workouts is a join table keyed on (user_id, workout_plan_id) — no
// surrogate id column. Note the FK is workout_plan_id here, while
// workout_sessions uses workout_id for the same table.
export async function getFavoriteWorkouts(user: UserRef) {
  const { data, error } = await supabase
    .from("favorite_workouts")
    .select("workout_plan_id")
    .eq("user_id", user.id);
  if (error) console.log("Error fetching favorite workouts: ", error);
  return (data ?? []).map((row) => String(row.workout_plan_id));
}

export async function addFavoriteWorkout(user: UserRef, workoutId: string) {
  const { error } = await supabase
    .from("favorite_workouts")
    .insert({ user_id: user.id, workout_plan_id: workoutId });
  if (error) {
    console.log("Error favoriting workout: ", error);
    return false;
  }
  return true;
}

export async function removeFavoriteWorkout(user: UserRef, workoutId: string) {
  const { error } = await supabase
    .from("favorite_workouts")
    .delete()
    .eq("user_id", user.id)
    .eq("workout_plan_id", workoutId);
  if (error) {
    console.log("Error unfavoriting workout: ", error);
    return false;
  }
  return true;
}

/* --------------
    HABITS
------------- */
export async function getHabitsByUser(user: UserRef) {
  const { data, error } = await supabase
    .from("habits")
    .select("*")
    .eq("user_id", user.id)
    .order("time", { ascending: false });
  if (error) console.log("Error fetching habits from database: ", error);
  return data;
}

export async function deleteHabit(user: UserRef, habitId: string) {
  const { data, error } = await supabase
    .from("habits")
    .delete()
    .eq("user_id", user.id)
    .eq("id", habitId);
  if (error) {
    console.log("Error deleting habit: ", error);
    return false;
  }
  return true;
}

export async function getCompletedHabitsByUser(user: UserRef) {
  const { data, error } = await supabase
    .from("habit_completions")
    .select("*")
    .eq("user_id", user.id);
  if (error)
    console.log("Error fetching completed habits from database: ", error);
  return data;
}

export async function createHabit(user: UserRef, habit: HabitInput) {
  const { data, error } = await supabase
    .from("habits")
    .insert({
      user_id: user.id,
      title: habit.title,
      time: habit.time,
      weekdays: habit.weekdays,
    })
    .select()
    .single();
  if (error) {
    console.log("Error creating habit: ", error);
    // Thrown so the add-habit form can show it instead of closing silently.
    throw new Error("Couldn't save that habit. Please try again.");
  }
  return data;
}

export async function completeHabit(
  user: UserRef,
  habitId: string,
  completedOn: string,
) {
  const { error } = await supabase.from("habit_completions").insert({
    user_id: user.id,
    habit_id: habitId,
    completed_on: completedOn,
  });
  if (error) {
    console.log("Error completing habit: ", error);
    return false;
  }
  return true;
}

export async function uncompleteHabit(
  user: UserRef,
  habitId: string,
  completedOn: string,
) {
  const { error } = await supabase
    .from("habit_completions")
    .delete()
    .eq("user_id", user.id)
    .eq("habit_id", habitId)
    .eq("completed_on", completedOn);
  if (error) {
    console.log("Error uncompleting habit: ", error);
    return false;
  }
  return true;
}

/* --------------
    APP TOUR
------------- */
// Whether this account has already been shown the first-time tour. Returns
// true when the check fails, so a missing column or network error skips the
// tour instead of showing it on every visit.
export async function hasSeenTour(user: UserRef) {
  const { data, error } = await supabase
    .from("profiles")
    .select("tour_seen_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    console.log("Error checking tour status: ", error);
    return true;
  }
  return data?.tour_seen_at != null;
}

export async function markTourSeen(user: UserRef) {
  const { error } = await supabase
    .from("profiles")
    .update({ tour_seen_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) console.log("Error saving tour status: ", error);
}

/* --------------
    APP FEEDBACK
------------- */
/**
 * Saves a survey response. `stars` is 0.5–5 in half steps and is stored
 * doubled (1–10) so half stars stay whole numbers.
 */
export async function submitFeedback(
  user: UserRef,
  stars: number,
  review: string,
): Promise<void> {
  const trimmed = review.trim();
  const { error } = await supabase.from("app_feedback").insert({
    user_id: user.id,
    rating: Math.round(stars * 2),
    review: trimmed === "" ? null : trimmed,
  });
  if (error) {
    console.log("Error submitting feedback: ", error);
    throw new Error("Couldn't send your feedback. Please try again.");
  }
}

/* --------------
    WORKOUT SCHEDULE
------------- */
type ScheduledWorkoutRow = {
  id: string;
  workout_plan_id: string;
  scheduled_time: string;
  weekdays: Weekday[] | null;
  planned_date: string | null;
};

const SCHEDULED_WORKOUT_COLUMNS =
  "id, workout_plan_id, scheduled_time, weekdays, planned_date";

function toScheduledWorkout(row: ScheduledWorkoutRow): ScheduledWorkout {
  return {
    id: row.id,
    workoutPlanId: row.workout_plan_id,
    time: row.scheduled_time,
    weekdays: row.weekdays,
    plannedDate: row.planned_date,
  };
}

/** All of a user's scheduled workouts; pick a day with getScheduledWorkoutsForDate(). */
export async function getScheduledWorkouts(
  user: UserRef,
): Promise<ScheduledWorkout[]> {
  const { data, error } = await supabase
    .from("workout_schedule_entries")
    .select(SCHEDULED_WORKOUT_COLUMNS)
    .eq("user_id", user.id)
    .returns<ScheduledWorkoutRow[]>();
  if (error) throw error;
  return data.map(toScheduledWorkout);
}

export async function createScheduledWorkout(
  user: UserRef,
  workoutPlanId: string,
  schedule: WorkoutSchedule,
): Promise<ScheduledWorkout> {
  const { data, error } = await supabase
    .from("workout_schedule_entries")
    .insert({
      user_id: user.id,
      workout_plan_id: workoutPlanId,
      scheduled_time: schedule.time,
      weekdays: schedule.weekdays,
      planned_date: schedule.plannedDate,
    })
    .select(SCHEDULED_WORKOUT_COLUMNS)
    .single<ScheduledWorkoutRow>();
  if (error) throw error;
  return toScheduledWorkout(data);
}

export async function deleteScheduledWorkout(entryId: string): Promise<void> {
  const { error } = await supabase
    .from("workout_schedule_entries")
    .delete()
    .eq("id", entryId);
  if (error) throw error;
}

/** Manual check-offs as { entry_id, completed_on } rows, like habit_completions. */
export async function getWorkoutScheduleCompletions(
  user: UserRef,
): Promise<{ entry_id: string; completed_on: string }[]> {
  const { data, error } = await supabase
    .from("workout_schedule_completions")
    .select("entry_id, completed_on")
    .eq("user_id", user.id);
  if (error) throw error;
  return data ?? [];
}

export async function completeScheduledWorkout(
  user: UserRef,
  entryId: string,
  date: string,
): Promise<void> {
  const { error } = await supabase
    .from("workout_schedule_completions")
    .insert({ user_id: user.id, entry_id: entryId, completed_on: date });
  if (error) throw error;
}

export async function uncompleteScheduledWorkout(
  entryId: string,
  date: string,
): Promise<void> {
  const { error } = await supabase
    .from("workout_schedule_completions")
    .delete()
    .eq("entry_id", entryId)
    .eq("completed_on", date);
  if (error) throw error;
}

/* --------------
    WORKOUT LIST: EQUIPMENT
------------- */
// Appended at the end of the file on purpose: getPlanExercises above is being
// reworked on tb-update-workout-timer-page, and keeping clear of it lets the
// two branches merge without a conflict here.

type PlanEquipmentRow = {
  workout_plan_id: string;
  // A many-to-one embed comes back as one object, but PostgREST returns an
  // array when it can't tell the relationship's direction — handle both.
  workouts: { equipment: string | null } | { equipment: string | null }[] | null;
};

/**
 * The equipment each plan's exercises call for, keyed by plan id. One query
 * for every plan on the list rather than one per card.
 *
 * Exercises with no equipment recorded are left out, so an empty list means
 * "unknown", not "none needed". Failure returns an empty map: this feeds an
 * optional line on each card and should never take the list down with it.
 */
export async function getPlanEquipment(
  planIds: string[],
): Promise<Map<string, string[]>> {
  const equipment = new Map<string, string[]>();
  if (planIds.length === 0) return equipment;

  const { data, error } = await supabase
    .from("workout_plan_workouts")
    .select("workout_plan_id, workouts ( equipment )")
    .in("workout_plan_id", planIds)
    .returns<PlanEquipmentRow[]>();

  if (error) {
    console.log("Error fetching plan equipment: ", error);
    return equipment;
  }

  for (const row of data ?? []) {
    const joined = Array.isArray(row.workouts)
      ? row.workouts
      : row.workouts
        ? [row.workouts]
        : [];
    const planId = String(row.workout_plan_id);

    for (const { equipment: item } of joined) {
      if (!item) continue;
      const list = equipment.get(planId) ?? [];
      list.push(item);
      equipment.set(planId, list);
    }
  }

  return equipment;
}

/* --------------
    EXERCISE RESULTS (personal records)
------------- */
type ExerciseResultRow = {
  workout_id: string;
  sets_done: number;
  reps: number | null;
  // numeric(6, 2): can arrive as a string, so it's converted below.
  weight_kg: number | string | null;
  duration_seconds: number | null;
  created_at: string;
  session_id: string;
};

/**
 * The user's saved results for these exercises, from every session they've
 * finished. Capped by the API's row limit (1000 by default), which is far
 * more than a plan's exercises collect in a semester.
 */
export async function getExerciseResults(
  user: UserRef,
  workoutIds: string[],
): Promise<SavedExerciseResult[]> {
  if (workoutIds.length === 0) return [];
  const { data, error } = await supabase
    .from("workout_exercise_results")
    .select("workout_id, sets_done, reps, weight_kg, duration_seconds, created_at, session_id")
    .eq("user_id", user.id)
    .in("workout_id", workoutIds)
    .returns<ExerciseResultRow[]>();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    workoutId: String(row.workout_id),
    setsDone: row.sets_done,
    reps: row.reps,
    weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
    durationSec: row.duration_seconds,
    savedAt: Date.parse(row.created_at),
    sessionId: String(row.session_id),
  }));
}

/** Saves what was done on each exercise in a finished session. */
export async function saveExerciseResults(
  sessionId: string,
  results: ExerciseResult[],
): Promise<void> {
  if (results.length === 0) return;
  const { error } = await supabase.from("workout_exercise_results").insert(
    results.map((result) => ({
      session_id: sessionId,
      workout_id: result.workoutId,
      sets_done: result.setsDone,
      reps: result.reps,
      weight_kg: result.weightKg,
      duration_seconds: result.durationSec,
    })),
  );
  if (error) throw error;
}

/* --------------
    SESSION HISTORY
------------- */
type SessionTotalsRow = {
  planned_min: number | null;
  sets_done: number | null;
  sets_total: number | null;
  exercises_done: number | null;
  exercises_total: number | null;
};

type SessionResultRow = ExerciseResultRow & { workouts: { name: string | null } | null };

/**
 * A finished session's saved totals (null if it was saved before those were
 * recorded) and its exercise results, each with the exercise's name.
 */
export async function getSessionDetails(sessionId: string): Promise<{
  totals: SessionTotals | null;
  results: (SavedExerciseResult & { name: string })[];
}> {
  const [session, results] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("planned_min, sets_done, sets_total, exercises_done, exercises_total")
      .eq("id", sessionId)
      .single<SessionTotalsRow>(),
    supabase
      .from("workout_exercise_results")
      .select("workout_id, sets_done, reps, weight_kg, duration_seconds, created_at, session_id, workouts ( name )")
      .eq("session_id", sessionId)
      .returns<SessionResultRow[]>(),
  ]);
  if (session.error) throw session.error;
  if (results.error) throw results.error;

  const row = session.data;
  const totals =
    row.sets_done !== null &&
    row.sets_total !== null &&
    row.exercises_done !== null &&
    row.exercises_total !== null
      ? {
          plannedMin: row.planned_min,
          setsDone: row.sets_done,
          setsTotal: row.sets_total,
          exercisesDone: row.exercises_done,
          exercisesTotal: row.exercises_total,
        }
      : null;

  return {
    totals,
    results: (results.data ?? []).map((result) => ({
      workoutId: String(result.workout_id),
      name: result.workouts?.name ?? "Unknown exercise",
      setsDone: result.sets_done,
      reps: result.reps,
      weightKg: result.weight_kg === null ? null : Number(result.weight_kg),
      durationSec: result.duration_seconds,
      savedAt: Date.parse(result.created_at),
      sessionId: String(result.session_id),
    })),
  };
}

// Its exercise results go with it (on delete cascade).
export async function deleteWorkoutSession(sessionId: string): Promise<void> {
  const { error } = await supabase.from("workout_sessions").delete().eq("id", sessionId);
  if (error) throw error;
}

/* --------------
    REMEMBERED SETS AND REPS (built-in plans)
------------- */
type PlanOverrideRow = {
  workout_id: string;
  sets: number;
  reps: number | null;
  duration_seconds: number | null;
};

/** The user's remembered sets and reps on a built-in plan, by workout id. */
export async function getPlanOverrides(
  user: UserRef,
  planId: string,
): Promise<Map<string, PlanOverride>> {
  const { data, error } = await supabase
    .from("workout_plan_overrides")
    .select("workout_id, sets, reps, duration_seconds")
    .eq("user_id", user.id)
    .eq("workout_plan_id", planId)
    .returns<PlanOverrideRow[]>();
  if (error) throw error;
  return new Map(
    (data ?? []).map((row) => [
      String(row.workout_id),
      { sets: row.sets, reps: row.reps, durationSec: row.duration_seconds },
    ]),
  );
}

/**
 * Remembers changed exercises and forgets ones back at the plan's values.
 * Only for built-in plans: the database refuses overrides on a user's own.
 */
export async function savePlanOverrides(
  user: UserRef,
  planId: string,
  changes: { save: ReadonlyMap<string, PlanOverride>; clear: readonly string[] },
): Promise<void> {
  if (changes.save.size > 0) {
    const { error } = await supabase.from("workout_plan_overrides").upsert(
      [...changes.save].map(([workoutId, override]) => ({
        user_id: user.id,
        workout_plan_id: planId,
        workout_id: workoutId,
        sets: override.sets,
        reps: override.reps,
        duration_seconds: override.durationSec,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "user_id,workout_plan_id,workout_id" },
    );
    if (error) throw error;
  }

  if (changes.clear.length > 0) {
    const { error } = await supabase
      .from("workout_plan_overrides")
      .delete()
      .eq("user_id", user.id)
      .eq("workout_plan_id", planId)
      .in("workout_id", [...changes.clear]);
    if (error) throw error;
  }
}
