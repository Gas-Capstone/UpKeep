import { useState, useEffect, useRef, createContext, useContext } from "react";
import { track } from "@/lib/metrics";
import {
  lastWeights,
  personalRecords as toPersonalRecords,
  sessionResults,
  type ExerciseRecords,
} from "@/lib/personalRecords";
import {
  overrideChanges,
  startingProgress,
  type PlanOverride,
} from "@/lib/planOverrides";
import {
  getExerciseResults,
  getPlanExercises,
  getPlanOverrides,
  saveExerciseResults,
  savePlanOverrides,
  setWorkoutComplete,
} from "@/lib/supabaseFunctions";
import {
  buildSessionSummary,
  sessionTotals,
  type SessionSummary,
  type SessionTotals,
} from "@/lib/sessionSummary";
import { useUserContext } from "./userContext";
import { useWorkoutsData } from "./workoutsDataContext";
import type { Workout } from "./workoutsDataContext";
import type { ExerciseProgress, PlanExercise } from "@/lib/workouts";

const NO_RECORDS: ReadonlyMap<string, ExerciseRecords> = new Map();
const NO_OVERRIDES: ReadonlyMap<string, PlanOverride> = new Map();

// Reports a finished session for the developer Performance screen. How it
// ended is read from the data, since Finish is the only way out of a session:
// every set logged, the planned time reached, or neither.
// The set counts are the ones saved with the session, so the two can't differ.
function recordWorkoutSession(elapsedMs: number, totals: SessionTotals) {
  const { setsDone, setsTotal, plannedMin } = totals;
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
      exercises: totals.exercisesTotal,
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
    // Built-in plans remember sets and reps the user changes; their own plans
    // are changed by editing them.
    builtIn: boolean;
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
  // The user's best on each of the session's exercises from earlier
  // sessions, keyed by workout id. Empty until loaded, and if it can't be:
  // records are extra, so the session never waits on them.
  personalRecords: ReadonlyMap<string, ExerciseRecords>;
  // How the last finished session went, for the summary shown after it.
  // Null until a session is saved, and again once a new one starts.
  sessionSummary: SessionSummary | null;
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
  const { completedWorkouts, refreshCompletedWorkouts } = useWorkoutsData();
  const [exerciseList, setExerciseList] = useState<{
    planId: string;
    items: PlanExercise[];
    error: string;
  } | null>(null);
  const [recordList, setRecordList] = useState<{
    planId: string;
    records: ReadonlyMap<string, ExerciseRecords>;
  } | null>(null);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const savingRef = useRef(false);
  const planId = workoutSession?.workout.id;
  const builtIn = workoutSession?.workout.builtIn ?? false;
  const userId = user?.id;
  const exercises = exerciseList?.planId === planId ? exerciseList?.items ?? [] : [];
  const records = recordList && recordList.planId === planId ? recordList.records : NO_RECORDS;

  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    // Loaded alongside the exercises so each one starts at the user's
    // remembered sets and reps. Extra, like records: if they can't load, the
    // session starts from the plan.
    const overridesLoad: Promise<ReadonlyMap<string, PlanOverride>> =
      builtIn && userId
        ? getPlanOverrides({ id: userId }, planId).catch((error) => {
            console.log("Error loading remembered sets and reps: ", error);
            return NO_OVERRIDES;
          })
        : Promise.resolve(NO_OVERRIDES);
    Promise.all([getPlanExercises(planId, { throwOnError: true }), overridesLoad])
      .then(([items, overrides]) => {
        if (cancelled) return;
        seedExerciseProgress(items, overrides);
        setExerciseList({ planId, items, error: "" });
        if (!userId) return;
        getExerciseResults({ id: userId }, items.map((item) => item.workoutId))
          .then((results) => {
            if (cancelled) return;
            setRecordList({ planId, records: toPersonalRecords(results) });

            // Start each exercise at the weight last used on it, so it isn't
            // typed in again every session. Only where nothing's been done
            // yet: a weight the user already set, or sets already logged at
            // no weight, are left as they are.
            const weights = lastWeights(results);
            if (weights.size === 0) return;
            setExerciseProgressState((current) => {
              let changed = false;
              const next = new Map(current);
              for (const [workoutId, entry] of current) {
                const weightKg = weights.get(workoutId);
                const untouched =
                  entry.weightKg === null &&
                  entry.durationSec === null &&
                  entry.setsRemaining === entry.sets;
                if (weightKg !== undefined && untouched) {
                  next.set(workoutId, { ...entry, weightKg });
                  changed = true;
                }
              }
              return changed ? next : current;
            });
          })
          .catch((error) => console.log("Error loading personal records: ", error));
      })
      .catch(() => {
        if (!cancelled) {
          setExerciseList({ planId, items: [], error: "Couldn't load exercises. Try again." });
        }
      });
    return () => { cancelled = true; };
  }, [planId, reloadKey, userId, builtIn]);

  const setExerciseProgress = (workoutId: string, progress: ExerciseProgress) => {
    if (savingRef.current || workoutSession?.status === "complete") return;
    setExerciseProgressState((current) => new Map(current).set(workoutId, progress));
  };

  function seedExerciseProgress(
    exercises: PlanExercise[],
    overrides: ReadonlyMap<string, PlanOverride> = NO_OVERRIDES,
  ) {
    setExerciseProgressState((current) => {
      const next = new Map(current);
      let added = false;
      for (const exercise of exercises) {
        if (next.has(exercise.workoutId)) continue;
        next.set(exercise.workoutId, startingProgress(exercise, overrides.get(exercise.workoutId)));
        added = true;
      }
      // Returning the same reference when nothing changed keeps this from
      // looping against effects that depend on the map.
      return added ? next : current;
    });
  };

  const startSession = (workout: Workout, plannedDuration: number) => {
    if (savingRef.current) return;
    // Progress starts fresh every session. What carries over is the weight
    // last used and, on built-in plans, any sets and reps the user changed.
    setExerciseProgressState(new Map());
    setExerciseList(null);
    // Reloaded with the exercises, so records from before the last session
    // never show against this one.
    setRecordList(null);
    setSessionSummary(null);
    setSaveError("");
    setReloadKey((key) => key + 1);
    setWorkoutSession({
      workout: {
        id: workout.id,
        name: workout.name,
        difficulty: workout.difficulty,
        target: workout.target,
        duration_min: plannedDuration,
        builtIn: workout.created_by == null,
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
      // Saved with the session so History can reopen its summary.
      const totals = sessionTotals(exercises, exerciseProgress, workoutSession.plannedDuration);
      const sessionId = await setWorkoutComplete(
        user, workoutSession.workout, Math.max(1, Math.ceil(elapsed / 60000)), totals,
      );
      // Saved after the session and allowed to fail: losing one session's
      // records beats asking the user to finish again and saving it twice.
      try {
        await saveExerciseResults(sessionId, sessionResults(exercises, exerciseProgress));
      } catch (error) {
        console.log("Error saving exercise results: ", error);
      }
      // Sets and reps changed on a built-in plan, for the user's next session
      // of it. Also allowed to fail, for the same reason.
      if (workoutSession.workout.builtIn && userId) {
        try {
          await savePlanOverrides(
            { id: userId },
            workoutSession.workout.id,
            overrideChanges(exercises, exerciseProgress),
          );
        } catch (error) {
          console.log("Error saving remembered sets and reps: ", error);
        }
      }
      // Built before the history refreshes; the summary counts this session
      // on top of what was there.
      const summary = buildSessionSummary({
        planName: workoutSession.workout.name,
        elapsedMs: elapsed,
        totals,
        exercises,
        progress: exerciseProgress,
        records,
        history: completedWorkouts,
      });
      setSessionSummary(summary);
      setWorkoutSession((session) => session ? {
        ...session, status: "complete", startedAt: null, pausedAt: null,
      } : session);
      refreshCompletedWorkouts();
      recordWorkoutSession(elapsed, totals);
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
    setSessionSummary(null);
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
    personalRecords: records,
    sessionSummary,
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
