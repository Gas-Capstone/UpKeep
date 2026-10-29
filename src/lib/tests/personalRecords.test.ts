import {
  beatsRecord,
  formatRecord,
  lastWeights,
  personalRecords,
  sessionResults,
  type ExerciseResult,
  type SavedExerciseResult,
} from "@/lib/personalRecords";
import type { ExerciseProgress, PlanExercise } from "@/lib/workouts";

const result = (overrides: Partial<ExerciseResult>): ExerciseResult => ({
  workoutId: "bench",
  setsDone: 3,
  reps: 10,
  weightKg: null,
  durationSec: null,
  ...overrides,
});

const progress = (overrides: Partial<ExerciseProgress>): ExerciseProgress => ({
  sets: 3,
  reps: 10,
  durationSec: null,
  weightKg: null,
  setsRemaining: 2, // one set logged
  completed: false,
  ...overrides,
});

describe("personalRecords", () => {
  it("keeps the heaviest weight, ties going to more reps", () => {
    const records = personalRecords([
      result({ weightKg: 60, reps: 8 }),
      result({ weightKg: 70, reps: 3 }),
      result({ weightKg: 70, reps: 5 }),
      result({ weightKg: 65, reps: 12 }),
    ]);
    expect(records.get("bench")?.lift).toEqual({ weightKg: 70, reps: 5 });
  });

  it("ranks any weighted set above bodyweight, and 0 kg as bodyweight", () => {
    const records = personalRecords([
      result({ workoutId: "pullup", reps: 20 }),
      result({ workoutId: "pullup", weightKg: 5, reps: 3 }),
      result({ workoutId: "dip", weightKg: 0, reps: 15 }),
    ]);
    expect(records.get("pullup")?.lift).toEqual({ weightKg: 5, reps: 3 });
    expect(records.get("dip")?.lift).toEqual({ weightKg: null, reps: 15 });
  });

  it("keeps timed and counted bests apart", () => {
    const records = personalRecords([
      result({ workoutId: "plank", reps: null, durationSec: 45 }),
      result({ workoutId: "plank", reps: null, durationSec: 90 }),
      result({ workoutId: "plank", reps: 12 }),
    ]);
    expect(records.get("plank")).toEqual({
      longestSec: 90,
      lift: { weightKg: null, reps: 12 },
    });
  });

  it("treats weights within a pound's rounding as the same weight", () => {
    // 132.3 lb, typed back in after a 60 kg record was shown in pounds.
    const records = personalRecords([
      result({ weightKg: 60, reps: 8 }),
      result({ weightKg: 60.01, reps: 6 }),
    ]);
    expect(records.get("bench")?.lift).toEqual({ weightKg: 60, reps: 8 });
  });

  it("ignores results with no sets done", () => {
    expect(personalRecords([result({ setsDone: 0, weightKg: 200 })]).size).toBe(0);
  });
});

describe("sessionResults", () => {
  const exercise = (workoutId: string): PlanExercise => ({
    workoutId,
    name: workoutId,
    instructions: null,
    muscleGroup: null,
    equipment: null,
    sets: 3,
    reps: 10,
    durationSec: null,
    position: 0,
  });

  it("saves only exercises with a set logged, as adjusted in the session", () => {
    const map = new Map<string, ExerciseProgress>([
      ["bench", progress({ weightKg: 60, reps: 8, setsRemaining: 0 })],
      ["row", progress({ setsRemaining: 3 })], // nothing logged
      ["plank", progress({ durationSec: 45, reps: 0, weightKg: 5, setsRemaining: 1 })],
    ]);
    expect(
      sessionResults([exercise("bench"), exercise("row"), exercise("plank"), exercise("gone")], map),
    ).toEqual([
      { workoutId: "bench", setsDone: 3, reps: 8, weightKg: 60, durationSec: null },
      { workoutId: "plank", setsDone: 2, reps: null, weightKg: null, durationSec: 45 },
    ]);
  });

  it("leaves out a counted exercise with no rep count", () => {
    const map = new Map([["bench", progress({ reps: 0, setsRemaining: 0 })]]);
    expect(sessionResults([exercise("bench")], map)).toEqual([]);
  });
});

describe("formatRecord", () => {
  const records = { lift: { weightKg: 60, reps: 8 }, longestSec: 90 };

  it("shows the record for how the exercise is being done", () => {
    expect(formatRecord({ durationSec: null }, records)).toBe("60 kg × 8 reps");
    expect(formatRecord({ durationSec: 45 }, records)).toBe("1 min 30 sec");
    expect(formatRecord({ durationSec: null }, records, { spoken: true })).toBe(
      "60 kilograms for 8 reps",
    );
  });

  it("shows weights in pounds when asked", () => {
    expect(formatRecord({ durationSec: null }, records, { unit: "lb" })).toBe("132.3 lb × 8 reps");
    expect(formatRecord({ durationSec: null }, records, { unit: "lb", spoken: true })).toBe(
      "132.3 pounds for 8 reps",
    );
  });

  it("shows bodyweight records as reps alone", () => {
    expect(formatRecord({ durationSec: null }, { lift: { weightKg: null, reps: 1 }, longestSec: null })).toBe("1 rep");
  });

  it("is null when there's no record of that kind", () => {
    expect(formatRecord({ durationSec: null }, undefined)).toBeNull();
    expect(formatRecord({ durationSec: 30 }, { lift: { weightKg: 60, reps: 8 }, longestSec: null })).toBeNull();
  });
});

describe("beatsRecord", () => {
  const records = { lift: { weightKg: 60, reps: 8 }, longestSec: 45 };

  it("needs a set logged first", () => {
    expect(beatsRecord(progress({ weightKg: 100, setsRemaining: 3 }), records)).toBe(false);
  });

  it("beats on more weight, or more reps at the same weight", () => {
    expect(beatsRecord(progress({ weightKg: 62.5, reps: 1 }), records)).toBe(true);
    expect(beatsRecord(progress({ weightKg: 60, reps: 9 }), records)).toBe(true);
    expect(beatsRecord(progress({ weightKg: 60, reps: 8 }), records)).toBe(false);
    expect(beatsRecord(progress({ weightKg: 55, reps: 20 }), records)).toBe(false);
  });

  it("doesn't call re-entering the record in pounds a new record", () => {
    // 60 kg shows as 132.3 lb, which goes back in as 60.01 kg.
    expect(beatsRecord(progress({ weightKg: 60.01, reps: 8 }), records)).toBe(false);
    // One more pound is.
    expect(beatsRecord(progress({ weightKg: 60.46, reps: 8 }), records)).toBe(true);
  });

  it("beats a timed record only with a longer set", () => {
    expect(beatsRecord(progress({ durationSec: 60, reps: 0 }), records)).toBe(true);
    expect(beatsRecord(progress({ durationSec: 45, reps: 0 }), records)).toBe(false);
  });

  it("doesn't flag a first attempt", () => {
    expect(beatsRecord(progress({ weightKg: 60 }), undefined)).toBe(false);
    expect(beatsRecord(progress({ durationSec: 30, reps: 0 }), { lift: null, longestSec: null })).toBe(false);
  });
});

describe("lastWeights", () => {
  const saved = (savedAt: number, overrides: Partial<ExerciseResult>): SavedExerciseResult => ({
    ...result(overrides),
    sessionId: `s${savedAt}`,
    savedAt,
  });

  it("takes the most recent weight per exercise, whatever order they load in", () => {
    const weights = lastWeights([
      saved(3, { workoutId: "bench", weightKg: 62.5 }),
      saved(1, { workoutId: "bench", weightKg: 70 }),
      saved(2, { workoutId: "row", weightKg: 50 }),
    ]);
    expect(weights).toEqual(new Map([["bench", 62.5], ["row", 50]]));
  });

  it("skips sessions done without a weight, so they don't erase it", () => {
    const weights = lastWeights([
      saved(1, { weightKg: 60 }),
      saved(2, { weightKg: null }),
      saved(3, { weightKg: 0 }),
    ]);
    expect(weights.get("bench")).toBe(60);
  });

  it("has nothing for timed exercises or ones never weighted", () => {
    const weights = lastWeights([
      saved(1, { workoutId: "plank", reps: null, durationSec: 45, weightKg: 10 }),
      saved(2, { workoutId: "pullup", weightKg: null }),
    ]);
    expect(weights.size).toBe(0);
  });
});
