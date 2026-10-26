import { useState, useEffect, useRef, createContext, useContext } from "react";
import { track } from "@/lib/metrics";
import { getPlanExercises, setWorkoutComplete } from "@/lib/supabaseFunctions";
import { useUserContext } from "./userContext";
import { useWorkoutsData } from "./workoutsDataContext";
import type { Workout } from "./workoutsDataContext";
import type { ExerciseProgress, PlanExercise } from "@/lib/workouts";

// Reports a finished session for the developer Performance screen. How it
// ended is read from the data, since Finish is the only way out of a session:
// every set logged, the planned time reached, or neither.
function recordWorkoutSession(
  elapsedMs: number,
  plannedMin: number,
  exercises: PlanExercise[],
  progress: ReadonlyMap<string, ExerciseProgress>,
) {
  let setsDone = 0;
  let setsTotal = 0;
  for (const exercise of exercises) {
    // Sets can be edited mid-session, so count against the session's target.
    const entry = progress.get(exercise.workoutId);
    const sets = entry?.sets ?? exercise.sets;
    const remaining = entry?.setsRemaining ?? sets;
    setsTotal += sets;
    setsDone += Math.min(sets, Math.max(0, sets - remaining));
  }

  const outcome =
    setsTotal > 0 && setsDone >= setsTotal
      ? "all_sets_done"
      : elapsedMs >= plannedMin * 60000
        ? "time_up"
        : "stopped_early";

  track("workout_session", {
    durationMs: elapsedMs,
    // Not an error signal: stopping early is a choice, not a failure, and
    // marking it as one would fill "Recent errors" with ordinary workouts.
    ok: true,
    props: {
      outcome,
      planned_min: plannedMin,
      sets_done: setsDone,
      sets_total: setsTotal,
      exercises: exercises.length,
    },
  });
}

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
  accumulatedTime: number; // elapsed milliseconds, excluding pauses
  status: "active" | "idle" | "paused" | "complete";
};

// Was previously `createContext(null)` with no generic, so every property access failed to type-check — giving it a real type fixes that.
type WorkoutSessionContextType = {
  workoutSession: WorkoutSession | null;
  // Per-exercise progress for the running session, keyed by workout id. Lives
  // here rather than in the timer screen so it survives navigating away, and
  // rather than in the database so a new session always starts clean.
  exerciseProgress: ReadonlyMap<string, ExerciseProgress>;
  exercises: PlanExercise[];
  exercisesLoading: boolean;
  exercisesError: string;
  reloadExercises: () => void;
  saving: boolean;
  saveError: string;
  setExerciseProgress: (workoutId: string, progress: ExerciseProgress) => void;
  // Seeds any exercise not yet tracked; existing entries are left alone so
  // this can run on every screen mount without wiping progress.
  seedExerciseProgress: (exercises: PlanExercise[]) => void;
  startSession: (workout: Workout, plannedDuration: number) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  completeSession: () => Promise<boolean>;
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
  const { user } = useUserContext();
  const { refreshCompletedWorkouts } = useWorkoutsData();
  const [exerciseList, setExerciseList] = useState<{
    planId: string;
    items: PlanExercise[];
    error: string;
  } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const savingRef = useRef(false);
  const planId = workoutSession?.workout.id;
  const exercises = exerciseList?.planId === planId ? exerciseList?.items ?? [] : [];

  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    getPlanExercises(planId, { throwOnError: true })
      .then((items) => {
        if (cancelled) return;
        seedExerciseProgress(items);
        setExerciseList({ planId, items, error: "" });
      })
      .catch(() => {
        if (!cancelled) {
          setExerciseList({ planId, items: [], error: "Couldn't load exercises. Try again." });
        }
      });
    return () => { cancelled = true; };
  }, [planId, reloadKey]);

  const setExerciseProgress = (workoutId: string, progress: ExerciseProgress) => {
    if (savingRef.current || workoutSession?.status === "complete") return;
    setExerciseProgressState((current) => new Map(current).set(workoutId, progress));
  };

  function seedExerciseProgress(
    exercises: PlanExercise[],
  ) {
    setExerciseProgressState((current) => {
      const next = new Map(current);
      let added = false;
      for (const exercise of exercises) {
        if (next.has(exercise.workoutId)) continue;
        next.set(exercise.workoutId, {
          sets: exercise.sets,
          reps: exercise.reps,
          durationSec: exercise.durationSec,
          weightKg: null,
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
    if (savingRef.current) return;
    // A new workout starts from scratch — this is the reason progress isn't
    // persisted per plan.
    setExerciseProgressState(new Map());
    setExerciseList(null);
    setSaveError("");
    setReloadKey((key) => key + 1);
    setWorkoutSession({
      workout: {
        id: workout.id,
        name: workout.name,
        difficulty: workout.difficulty,
        target: workout.target,
        duration_min: plannedDuration,
      },
      plannedDuration: plannedDuration,
      startedAt: null,
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
    if (savingRef.current) return;
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

  const completeSession = async () => {
    if (!workoutSession || workoutSession.status === "complete" || savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    const elapsed = getElapsedTime();
    // Freeze the exact duration being saved. A failed save leaves the workout
    // paused and retryable, with its exercise progress intact.
    setWorkoutSession((session) => session ? {
      ...session, accumulatedTime: elapsed, startedAt: null,
      pausedAt: Date.now(), status: "paused",
    } : session);
    try {
      await setWorkoutComplete(
        user, workoutSession.workout, Math.max(1, Math.ceil(elapsed / 60000)),
      );
      setWorkoutSession((session) => session ? {
        ...session, status: "complete", startedAt: null, pausedAt: null,
      } : session);
      refreshCompletedWorkouts();
      recordWorkoutSession(
        elapsed,
        workoutSession.plannedDuration,
        exercises,
        exerciseProgress,
      );
      return true;
    } catch {
      setSaveError("Couldn't save your workout. Your session is paused; try finishing again.");
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const clearSession = () => {
    if (savingRef.current) return;
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
    exercises,
    exercisesLoading: Boolean(planId && exerciseList?.planId !== planId),
    exercisesError: exerciseList?.planId === planId ? exerciseList?.error ?? "" : "",
    reloadExercises: () => {
      setExerciseList(null);
      setReloadKey((key) => key + 1);
    },
    saving,
    saveError,
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
