import { getDay, parseISO } from "date-fns";
import type { Workout } from "@/components/context/workoutsDataContext";

// One exercise inside a plan, joined from workout_plan_workouts + workouts.
export type PlanExercise = {
  workoutId: string;
  name: string;
  sets: number;
  reps: number;
  position: number;
};

// How far through an exercise the user is. Kept separate from PlanExercise so
// the plan definition and the user's progress against it stay distinct.
export type ExerciseProgress = {
  setsRemaining: number;
  completed: boolean;
};

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
