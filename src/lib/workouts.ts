import { getDay, parseISO } from "date-fns";
import type { Workout } from "@/components/context/workoutsDataContext";

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
