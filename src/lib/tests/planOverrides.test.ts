import {
  differsFromPlan,
  overrideChanges,
  startingProgress,
} from "@/lib/planOverrides";
import type { ExerciseProgress, PlanExercise } from "@/lib/workouts";

const counted: PlanExercise = {
  workoutId: "bench",
  name: "Bench",
  instructions: null,
  muscleGroup: null,
  equipment: null,
  sets: 3,
  reps: 10,
  durationSec: null,
  position: 1,
};
const timed: PlanExercise = { ...counted, workoutId: "plank", name: "Plank", reps: 0, durationSec: 45 };

describe("startingProgress", () => {
  it("starts from the plan with no override", () => {
    expect(startingProgress(counted)).toEqual({
      sets: 3,
      reps: 10,
      durationSec: null,
      weightKg: null,
      setsRemaining: 3,
      completed: false,
    });
  });

  it("starts from the remembered sets and reps", () => {
    expect(startingProgress(counted, { sets: 5, reps: 5, durationSec: null })).toMatchObject({
      sets: 5,
      reps: 5,
      setsRemaining: 5,
    });
    expect(startingProgress(timed, { sets: 2, reps: null, durationSec: 60 })).toMatchObject({
      sets: 2,
      durationSec: 60,
      setsRemaining: 2,
    });
  });

  it("ignores an override that no longer matches how the plan counts it", () => {
    // Remembered as reps, but the plan now times this exercise.
    expect(startingProgress(timed, { sets: 5, reps: 12, durationSec: null })).toMatchObject({
      sets: 3,
      durationSec: 45,
    });
  });
});

describe("overrideChanges", () => {
  const entry = (overrides: Partial<ExerciseProgress>): ExerciseProgress => ({
    ...startingProgress(counted),
    ...overrides,
  });

  it("saves what differs from the plan and clears what's back to it", () => {
    const changes = overrideChanges(
      [counted, timed, { ...counted, workoutId: "row" }],
      new Map([
        ["bench", entry({ sets: 4, reps: 8 })],
        ["plank", { ...startingProgress(timed), durationSec: 60 }],
        ["row", entry({})], // as planned
      ]),
    );
    expect(changes.save).toEqual(
      new Map([
        ["bench", { sets: 4, reps: 8, durationSec: null }],
        ["plank", { sets: 3, reps: null, durationSec: 60 }],
      ]),
    );
    expect(changes.clear).toEqual(["row"]);
  });

  it("keeps the weight out of it: that's remembered separately", () => {
    const changes = overrideChanges([counted], new Map([["bench", entry({ weightKg: 80 })]]));
    expect(changes.save.size).toBe(0);
    expect(changes.clear).toEqual(["bench"]);
  });

  it("skips a counted exercise with no rep count", () => {
    const changes = overrideChanges([counted], new Map([["bench", entry({ sets: 5, reps: 0 })]]));
    expect(changes.save.size).toBe(0);
    expect(changes.clear).toEqual([]);
  });

  it("leaves out exercises the session never tracked", () => {
    expect(overrideChanges([counted], new Map())).toEqual({ save: new Map(), clear: [] });
  });
});

describe("differsFromPlan", () => {
  it("compares sets and the amount, not the weight or progress", () => {
    const base = startingProgress(counted);
    expect(differsFromPlan(counted, base)).toBe(false);
    expect(differsFromPlan(counted, { ...base, weightKg: 50, setsRemaining: 1 })).toBe(false);
    expect(differsFromPlan(counted, { ...base, sets: 4 })).toBe(true);
    expect(differsFromPlan(counted, { ...base, reps: 12 })).toBe(true);
    expect(differsFromPlan(timed, { ...startingProgress(timed), durationSec: 30 })).toBe(true);
  });
});
