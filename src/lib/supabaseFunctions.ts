import { supabase } from "./supabaseClient";
import type { Weekday } from "./habits/habits";
import type { ScheduledWorkout, WorkoutSchedule } from "./workoutSchedule";

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
    .select("id, name, muscle_group, equipment")
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
  selections: { workout_id: string; sets: number; reps: number }[],
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

export async function setWorkoutComplete(
  user: UserRef | null | undefined,
  workout: WorkoutRef,
  durationMin: number,
) {
  if (!user?.id) return;

  // The column is workout_plan_id, not workout_id — it was renamed alongside
  // workouts -> workout_plans, and this insert was missed at the time.
  const { data, error } = await supabase.from("workout_sessions").insert({
    user_id: user.id,
    workout_plan_id: workout.id,
    duration_min: durationMin,
  });
  if (error) console.log("Error setting workout as complete: ", error);
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
            workout_plans ( name )
        `,
    )
    .eq("user_id", user.id)
    .order("completed_at", { ascending: false });
  if (error) console.log("Error fetching completed workouts: ", error);

  return (data ?? []).map((session) => ({
    id: session.id,
    duration_min: session.duration_min,
    completed_at: session.completed_at,
    // Lets a scheduled workout count as done when its plan was logged that day.
    workout_plan_id: (session.workout_plan_id as string | null) ?? null,
    // workout_plan_id is ON DELETE SET NULL, so a session outlives the plan it
    // was logged against and the embed comes back null. The workout still
    // happened — keep the row, just say what's missing.
    name: (session.workout_plans as any)?.name ?? "Deleted plan",
  }));
}

/* --------------
    PLAN EDITING
------------- */
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
    selections: { workout_id: string; sets: number; reps: number }[],
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
export async function getPlanExercises(workoutPlanId: string) {
  const { data, error } = await supabase
    .from("workout_plan_workouts")
    .select("workout_id, sets, reps, position, workouts ( name )")
    .eq("workout_plan_id", workoutPlanId)
    .order("position", { ascending: true });
  if (error) {
    console.log("Error fetching plan exercises: ", error);
    return [];
  }
  return (data ?? []).map((row: any) => ({
    workoutId: String(row.workout_id),
    name: row.workouts?.name ?? "Unknown exercise",
    sets: row.sets ?? 0,
    reps: row.reps ?? 0,
    position: row.position ?? 0,
  }));
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
