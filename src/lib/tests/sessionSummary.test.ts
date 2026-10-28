import type { CompletedWorkout } from "@/components/context/workoutsDataContext";
import type { ExerciseRecords, SavedExerciseResult } from "@/lib/personalRecords";
import {
  buildHistorySummary,
  buildSessionSummary,
  describeNewRecord,
  sessionTotals,
} from "@/lib/sessionSummary";
import type { ExerciseProgress, PlanExercise } from "@/lib/workouts";

// Local time, as in workoutList.test.ts: Wednesday Oct 21 2026, 6pm.
const NOW = new Date(2026, 9, 21, 18, 0, 0);

const exercise = (workoutId: string, sets = 3): PlanExercise => ({
  workoutId,
  name: `Exercise ${workoutId}`,
  instructions: null,
  muscleGroup: null,
  equipment: null,
  sets,
  reps: 10,
  durationSec: null,
  position: 0,
});

const progress = (overrides: Partial<ExerciseProgress>): ExerciseProgress => ({
  sets: 3,
  reps: 10,
  durationSec: null,
  weightKg: null,
  setsRemaining: 0,
  completed: true,
  ...overrides,
});

const past = (id: string, day: number): CompletedWorkout => ({
  id,
  name: "Earlier",
  duration_min: 30,
  completed_at: new Date(2026, 9, day, 9).toISOString(),
  workout_plan_id: "p",
});

const EXERCISES = [exercise("a"), exercise("b"), exercise("c")];

function build(
  progressMap: Map<string, ExerciseProgress>,
  records: Map<string, ExerciseRecords> = new Map(),
  history: CompletedWorkout[] = [],
  exercises = EXERCISES,
) {
  return buildSessionSummary({
    planName: "Push day",
    elapsedMs: 31.2 * 60000,
    totals: sessionTotals(exercises, progressMap, 45),
    exercises,
    progress: progressMap,
    records,
    history,
  });
}

describe("sessionTotals", () => {
  it("counts sets and exercises against the session's own targets", () => {
    const totals = sessionTotals(
      EXERCISES,
      new Map([
        ["a", progress({ setsRemaining: 0 })],
        ["b", progress({ sets: 5, setsRemaining: 3 })], // sets raised mid-session
        ["c", progress({ setsRemaining: 3 })], // never started
      ]),
      45,
    );
    expect(totals).toEqual({
      plannedMin: 45,
      setsDone: 5,
      setsTotal: 11,
      exercisesDone: 2,
      exercisesTotal: 3,
    });
  });
});

describe("buildSessionSummary", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("rounds the time up as it's saved and carries the totals", () => {
    const summary = build(new Map([["a", progress({})]]));
    expect(summary.minutes).toBe(32);
    expect(summary.plannedMin).toBe(45);
    expect(summary.planName).toBe("Push day");
    expect(summary.sets).toEqual({ done: 3, total: 9 });
    expect(summary.exercises).toEqual({ done: 1, total: 3 });
  });

  it("adds up weight lifted from weighted, counted sets only", () => {
    const summary = build(
      new Map([
        ["a", progress({ weightKg: 60, reps: 8, setsRemaining: 0 })], // 3 × 8 × 60
        ["b", progress({ weightKg: 20.5, reps: 10, setsRemaining: 1 })], // 2 × 10 × 20.5
        ["c", progress({ durationSec: 45, reps: 0, weightKg: 10 })], // timed: no volume
      ]),
    );
    expect(summary.volumeKg).toBe(1440 + 410);
  });

  it("lists new records with what they beat, and counts first records", () => {
    const summary = build(
      new Map([
        ["a", progress({ weightKg: 65, reps: 6 })],
        ["b", progress({ weightKg: 40, reps: 10 })],
        ["c", progress({ durationSec: 60, reps: 0 })],
      ]),
      new Map<string, ExerciseRecords>([
        ["a", { lift: { weightKg: 60, reps: 6 }, longestSec: null }], // beaten
        ["b", { lift: { weightKg: 50, reps: 5 }, longestSec: null }], // not beaten
        // c: no record yet -> a first record
      ]),
    );
    expect(summary.newRecords).toEqual([
      {
        workoutId: "a",
        name: "Exercise a",
        attempt: { reps: 6, weightKg: 65, durationSec: null },
        previous: { lift: { weightKg: 60, reps: 6 }, longestSec: null },
      },
    ]);
    expect(summary.firstRecords).toBe(1);

    // Shown in whichever unit is chosen when the summary is opened.
    expect(describeNewRecord(summary.newRecords[0], "kg")).toEqual({
      result: "65 kg × 6 reps",
      previous: "60 kg × 6 reps",
      spoken: "Exercise a: 65 kilograms for 6 reps, beating your previous best of 60 kilograms for 6 reps",
    });
    expect(describeNewRecord(summary.newRecords[0], "lb")).toMatchObject({
      result: "143.3 lb × 6 reps",
      previous: "132.3 lb × 6 reps",
    });
  });

  it("doesn't count an exercise with no sets logged as a first record", () => {
    const summary = build(new Map([["a", progress({ setsRemaining: 3 })]]));
    expect(summary.firstRecords).toBe(0);
    expect(summary.newRecords).toEqual([]);
  });

  it("counts this session in the streak and the week", () => {
    // Earlier sessions yesterday and the day before; nothing yet today.
    const summary = build(new Map(), new Map(), [past("1", 20), past("2", 19), past("3", 15)]);
    // The week began Sunday the 18th: the 19th, 20th and this session.
    expect(summary.streak).toEqual({ days: 3, thisWeek: 3 });
  });

  it("handles a plan with no exercises", () => {
    const summary = build(new Map(), new Map(), [], []);
    expect(summary).toMatchObject({
      exercises: { done: 0, total: 0 },
      sets: { done: 0, total: 0 },
      streak: { days: 1, thisWeek: 1 },
    });
  });
});

describe("buildHistorySummary", () => {
  // Results as loaded back: which session, and when they were saved.
  const saved = (
    sessionId: string,
    savedAt: number,
    overrides: Partial<SavedExerciseResult>,
  ): SavedExerciseResult & { name: string } => ({
    workoutId: "bench",
    name: "Bench",
    setsDone: 3,
    reps: 6,
    weightKg: 60,
    durationSec: null,
    sessionId,
    savedAt,
    ...overrides,
  });

  const totals = {
    plannedMin: 45,
    setsDone: 16,
    setsTotal: 18,
    exercisesDone: 5,
    exercisesTotal: 6,
  };

  it("shows the saved totals and the weight lifted from its results", () => {
    const thisSession = [saved("s2", 200, { weightKg: 65 })];
    const summary = buildHistorySummary({
      planName: "Push day",
      minutes: 32,
      totals,
      sessionId: "s2",
      sessionResults: thisSession,
      allResults: thisSession,
    });
    expect(summary).toMatchObject({
      planName: "Push day",
      minutes: 32,
      plannedMin: 45,
      sets: { done: 16, total: 18 },
      exercises: { done: 5, total: 6 },
      volumeKg: 3 * 6 * 65,
      streak: null,
    });
  });

  it("judges records only against sessions saved before it", () => {
    const s1 = saved("s1", 100, { weightKg: 60 });
    const s2 = saved("s2", 200, { weightKg: 65 });
    const s3 = saved("s3", 300, { weightKg: 70 }); // later: must not count
    const summary = buildHistorySummary({
      planName: "Push day",
      minutes: 32,
      totals,
      sessionId: "s2",
      sessionResults: [s2],
      allResults: [s1, s2, s3],
    });
    expect(summary.newRecords).toHaveLength(1);
    expect(summary.newRecords[0].previous.lift).toEqual({ weightKg: 60, reps: 6 });
  });

  it("stops calling it a record beaten once the earlier session is deleted", () => {
    // s1 was deleted, so its results are gone: s2 becomes a first record.
    const s2 = saved("s2", 200, { weightKg: 65 });
    const summary = buildHistorySummary({
      planName: "Push day",
      minutes: 32,
      totals,
      sessionId: "s2",
      sessionResults: [s2],
      allResults: [s2],
    });
    expect(summary.newRecords).toEqual([]);
    expect(summary.firstRecords).toBe(1);
  });

  it("says what it can for sessions saved before totals were recorded", () => {
    const summary = buildHistorySummary({
      planName: "Leg day",
      minutes: 50,
      totals: null,
      sessionId: "old",
      sessionResults: [],
      allResults: [],
    });
    expect(summary).toMatchObject({
      minutes: 50,
      plannedMin: null,
      sets: null,
      exercises: null,
      volumeKg: 0,
      newRecords: [],
      firstRecords: 0,
    });
  });
});
