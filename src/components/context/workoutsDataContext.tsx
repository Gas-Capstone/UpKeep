import React, { createContext, useCallback, useContext, useState, useEffect } from "react";
import {
  addFavoriteWorkout,
  createWorkoutPlan,
  getAvailableWorkouts,
  getCompletedWorkouts,
  getFavoriteWorkouts,
  getWorkouts,
  removeFavoriteWorkout,
} from "@/lib/supabaseFunctions";
import { userContext } from "./userContext";

// Lifted out of WorkoutsPage's local useState so index.tsx can read the same data.

// A full workout definition (from getWorkouts()) — has difficulty/target and an optional tag list.
export type Workout = {
  id: string;
  name: string;
  difficulty: string;
  target: string;
  duration_min: number;
  goal_tags?: string[];
};

// A logged completion record (from getCompletedWorkouts()) — different shape than Workout, has required completed_at.
export type CompletedWorkout = {
  id: string;
  name: string;
  duration_min: number;
  completed_at: string;
};

// An individual exercise from the `workouts` table — the building blocks a
// plan is assembled from. Distinct from Workout above, which is a whole plan.
export type PlanWorkout = {
  id: string;
  name: string;
  muscle_group?: string;
  equipment?: string;
};

// One line of a plan being built: which exercise, and how many sets/reps.
export type PlanWorkoutSelection = {
  workout_id: string;
  sets: number;
  reps: number;
};

export type NewWorkoutPlan = {
  name: string;
  difficulty: string;
  target: string;
  duration_min: number;
};

export type WorkoutsDataContextType = {
  workoutList: Workout[];
  completedWorkouts: CompletedWorkout[];
  // Set of workout ids the current user has favorited, so a card can check
  // membership in O(1) rather than scanning an array per render.
  favoriteIds: Set<string>;
  // The individual exercises available to pick from when building a plan.
  availableWorkouts: PlanWorkout[];
  loading: boolean;
  refreshWorkouts: () => void;
  refreshCompletedWorkouts: () => void;
  refreshFavorites: () => void;
  toggleFavorite: (workoutId: string) => void;
  createPlan: (
    plan: NewWorkoutPlan,
    selections: PlanWorkoutSelection[],
  ) => Promise<boolean>;
};

export const workoutsDataContext =
  createContext<WorkoutsDataContextType | null>(null);

type WorkoutsDataProviderProps = {
  children: React.ReactNode;
};

export const WorkoutsDataProvider = ({
  children,
}: WorkoutsDataProviderProps) => {
  const { user } = useContext(userContext) ?? {};
  const [workoutList, setWorkoutList] = useState<Workout[]>([]);
  const [completedWorkouts, setCompletedWorkouts] = useState<
    CompletedWorkout[]
  >([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [availableWorkouts, setAvailableWorkouts] = useState<PlanWorkout[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshFavorites = useCallback(() => {
    if (!user?.id) return;
    getFavoriteWorkouts(user)
      .then((ids) => setFavoriteIds(new Set(ids)))
      .catch((error) => {
        console.log("Error fetching favorite workouts: ", error);
        setFavoriteIds(new Set());
      });
  }, [user?.id]);

  // Optimistic: flip the star immediately, then roll back if the write fails,
  // so the tap feels instant instead of waiting on a round trip.
  const toggleFavorite = useCallback(
    (workoutId: string) => {
      if (!user?.id) return;
      const wasFavorited = favoriteIds.has(workoutId);

      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFavorited) next.delete(workoutId);
        else next.add(workoutId);
        return next;
      });

      const write = wasFavorited
        ? removeFavoriteWorkout(user, workoutId)
        : addFavoriteWorkout(user, workoutId);

      write
        .then((ok) => {
          if (ok) return;
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            if (wasFavorited) next.add(workoutId);
            else next.delete(workoutId);
            return next;
          });
        })
        .catch((error) => {
          console.log("Error toggling favorite workout: ", error);
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            if (wasFavorited) next.add(workoutId);
            else next.delete(workoutId);
            return next;
          });
        });
    },
    [user?.id, favoriteIds],
  );

  const refreshAvailableWorkouts = useCallback(() => {
    getAvailableWorkouts()
      .then((data) => setAvailableWorkouts((data as PlanWorkout[]) ?? []))
      .catch((error) => {
        console.log("Error fetching available workouts: ", error);
        setAvailableWorkouts([]);
      });
  }, []);

  const refreshWorkouts = useCallback(() => {
    if (!user?.id) return;
    getWorkouts(user)
      .then((data) => setWorkoutList(data ?? []))
      .catch((error) => {
        console.log("Error fetching workouts: ", error);
        setWorkoutList([]);
      });
  }, [user?.id]);

  const refreshCompletedWorkouts = useCallback(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getCompletedWorkouts(user)
      .then((data) => setCompletedWorkouts(data ?? []))
      .catch((error) => {
        console.log("Error fetching completed workouts: ", error);
        setCompletedWorkouts([]);
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  // Refetches the plan list on success so the new plan shows up without the
  // caller needing to know how that list is loaded.
  const createPlan = useCallback(
    async (plan: NewWorkoutPlan, selections: PlanWorkoutSelection[]) => {
      if (!user?.id) return false;
      try {
        const created = await createWorkoutPlan(user, plan, selections);
        if (!created) return false;
        refreshWorkouts();
        return true;
      } catch (error) {
        console.log("Error creating workout plan: ", error);
        return false;
      }
    },
    [user?.id, refreshWorkouts],
  );

  useEffect(() => {
    if (!user?.id) return;
    refreshWorkouts();
    refreshCompletedWorkouts();
    refreshFavorites();
    refreshAvailableWorkouts();
  }, [
    user,
    refreshWorkouts,
    refreshCompletedWorkouts,
    refreshFavorites,
    refreshAvailableWorkouts,
  ]);

  const contextValue: WorkoutsDataContextType = {
    workoutList,
    completedWorkouts,
    favoriteIds,
    availableWorkouts,
    loading,
    refreshWorkouts,
    refreshCompletedWorkouts,
    refreshFavorites,
    toggleFavorite,
    createPlan,
  };

  return (
    <workoutsDataContext.Provider value={contextValue}>
      {children}
    </workoutsDataContext.Provider>
  );
};

// Use this instead of `useContext(workoutsDataContext)` — throws a clear error if <WorkoutsDataProvider> isn't mounted.
export function useWorkoutsData() {
  const ctx = useContext(workoutsDataContext);
  if (!ctx) {
    throw new Error(
      "useWorkoutsData must be used within a <WorkoutsDataProvider>",
    );
  }
  return ctx;
}
