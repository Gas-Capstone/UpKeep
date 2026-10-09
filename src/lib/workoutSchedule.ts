// Pure scheduled-workout types and logic. No I/O — see supabaseFunctions.ts
// for the reads/writes that feed this.
//
// Scheduled workouts use the same schedule model as planned meals: a time of
// day, plus either weekdays to repeat on or a single date.

import { format } from "date-fns";

import type { CompletedWorkout } from "@/components/context/workoutsDataContext";
import {
  CompletionsByDate,
  Weekday,
  isHabitDone,
  isScheduledOnDate,
  timeToMinutes,
} from "@/lib/habits/habits";

export type ScheduledWorkout = {
  id: string;
  workoutPlanId: string;
  time: string;
  // Exactly one of these is set. weekdays repeats like a habit (empty means
  // every day); plannedDate is a one-off ISO date (yyyy-MM-dd).
  weekdays: Weekday[] | null;
  plannedDate: string | null;
};

/** How a new entry is scheduled — the editable part of a ScheduledWorkout. */
export type WorkoutSchedule = Pick<
  ScheduledWorkout,
  "time" | "weekdays" | "plannedDate"
>;

export function getScheduledWorkoutsForDate(
  entries: ScheduledWorkout[],
  date: string,
): ScheduledWorkout[] {
  return entries
    .filter((entry) => isScheduledOnDate(entry, date))
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}

/** "planId|yyyy-MM-dd" for every day a plan was logged as a workout session. */
export function getSessionDays(sessions: CompletedWorkout[]): Set<string> {
  return new Set(
    sessions
      .filter((session) => session.workout_plan_id !== null)
      .map(
        (session) =>
          `${session.workout_plan_id}|${format(new Date(session.completed_at), "yyyy-MM-dd")}`,
      ),
  );
}

/** Finished with the workout timer that day, so it counts without a tick. */
export function wasLoggedOn(
  entry: ScheduledWorkout,
  date: string,
  sessionDays: Set<string>,
): boolean {
  return sessionDays.has(`${entry.workoutPlanId}|${date}`);
}

export function isScheduledWorkoutDone(
  entry: ScheduledWorkout,
  date: string,
  completions: CompletionsByDate,
  sessionDays: Set<string>,
): boolean {
  return (
    wasLoggedOn(entry, date, sessionDays) ||
    isHabitDone(entry.id, date, completions)
  );
}
