import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Workout } from "./workoutsDataContext";
import type { ExerciseProgress } from "@/lib/workouts";

type WorkoutSession = {
  workout: {
    id: string;
    name: string;
    difficulty: string;
    target: string;
    duration_min: number;
  };
  plannedDuration: number;
  startedAt: number | null;
  pausedAt: number | null;
  accumulatedTime: number; // time left on timer at pause
  status: "active" | "idle" | "paused" | "complete";
};

// Was previously `createContext(null)` with no generic, so every property access failed to type-check — giving it a real type fixes that.
type WorkoutSessionContextType = {
  workoutSession: WorkoutSession | null;
  // Per-exercise progress for the running session, keyed by workout id. Lives
  // here rather than in the timer screen so it survives navigating away, and
  // rather than in the database so a new session always starts clean.
  exerciseProgress: ReadonlyMap<string, ExerciseProgress>;
  setExerciseProgress: (workoutId: string, progress: ExerciseProgress) => void;
  // Seeds any exercise not yet tracked; existing entries are left alone so
  // this can run on every screen mount without wiping progress.
  seedExerciseProgress: (exercises: { workoutId: string; sets: number }[]) => void;
  startSession: (workout: Workout, plannedDuration: number) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  completeSession: () => void;
  clearSession: () => void;
  getElapsedTime: () => number;
};

const workoutSessionContext = createContext<WorkoutSessionContextType | null>(
  null,
);

const WorkoutSessionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [workoutSession, setWorkoutSession] = useState<WorkoutSession | null>(
    null,
  );
  const [exerciseProgress, setExerciseProgressState] = useState<
    ReadonlyMap<string, ExerciseProgress>
  >(new Map());

  const setExerciseProgress = (workoutId: string, progress: ExerciseProgress) => {
    setExerciseProgressState((current) => new Map(current).set(workoutId, progress));
  };

  const seedExerciseProgress = (
    exercises: { workoutId: string; sets: number }[],
  ) => {
    setExerciseProgressState((current) => {
      const next = new Map(current);
      let added = false;
      for (const exercise of exercises) {
        if (next.has(exercise.workoutId)) continue;
        next.set(exercise.workoutId, {
          setsRemaining: exercise.sets,
          completed: false,
        });
        added = true;
      }
      // Returning the same reference when nothing changed keeps this from
      // looping against effects that depend on the map.
      return added ? next : current;
    });
  };

  const startSession = (workout: Workout, plannedDuration: number) => {
    // A new workout starts from scratch — this is the reason progress isn't
    // persisted per plan.
    setExerciseProgressState(new Map());
    setWorkoutSession({
      workout: {
        id: workout.id,
        name: workout.name,
        difficulty: workout.difficulty,
        target: workout.target,
        duration_min: plannedDuration,
      },
      plannedDuration: plannedDuration,
      startedAt: Date.now(),
      pausedAt: null,
      accumulatedTime: 0,
      status: "idle",
    });
  };

  const pauseSession = () => {
    setWorkoutSession((prevSession) => {
      if (
        !prevSession ||
        prevSession.status !== "active" ||
        prevSession.startedAt == null
      )
        return prevSession;
      return {
        ...prevSession,
        pausedAt: Date.now(),
        accumulatedTime:
          prevSession.accumulatedTime + (Date.now() - prevSession.startedAt),
        startedAt: null,
        status: "paused",
      };
    });
  };

  const resumeSession = () => {
    setWorkoutSession((session) => {
      if (
        !session ||
        (session.status !== "paused" && session.status !== "idle")
      )
        return session;
      return {
        ...session,
        startedAt: Date.now(),
        pausedAt: null,
        status: "active",
      };
    });
  };

  const completeSession = () => {
    setWorkoutSession((session) => {
      if (!session) return session;
      return {
        ...session,
        status: "complete",
        startedAt: null,
        pausedAt: null,
      };
    });
  };

  const clearSession = () => {
    setWorkoutSession(null);
    setExerciseProgressState(new Map());
  };

  const getElapsedTime = () => {
    // returns elapsed time in milliseconds
    if (!workoutSession) return 0;
    if (
      workoutSession.status === "active" &&
      workoutSession.startedAt != null
    ) {
      return (
        workoutSession.accumulatedTime + (Date.now() - workoutSession.startedAt)
      );
    }
    return workoutSession.accumulatedTime;
  };

  const contextValue: WorkoutSessionContextType = {
    workoutSession,
    exerciseProgress,
    setExerciseProgress,
    seedExerciseProgress,
    startSession,
    completeSession,
    clearSession,
    pauseSession,
    resumeSession,
    getElapsedTime,
  };

  return (
    <workoutSessionContext.Provider value={contextValue}>
      {children}
    </workoutSessionContext.Provider>
  );
};

// Use this instead of `useContext(workoutSessionContext)` — throws a clear error if <WorkoutSessionProvider> isn't mounted.
export function useWorkoutSessionContext() {
  const ctx = useContext(workoutSessionContext);
  if (!ctx) {
    throw new Error(
      "useWorkoutSessionContext must be used within a <WorkoutSessionProvider>",
    );
  }
  return ctx;
}

export { workoutSessionContext, WorkoutSessionProvider };
