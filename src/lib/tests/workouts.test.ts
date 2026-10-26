import {
  draftFromPlanExercise,
  formatExerciseDuration,
  formatExerciseTarget,
  newExerciseDraft,
  selectionFromDraft,
} from "@/lib/workouts";

describe("plan editor drafts", () => {
  it("starts a new exercise at 3 sets of 10 reps", () => {
    expect(newExerciseDraft()).toEqual({ sets: "3", unit: "reps", amount: "10" });
  });

  it("saves reps as reps", () => {
    expect(selectionFromDraft("w1", { sets: "4", unit: "reps", amount: "8" })).toEqual({
      workout_id: "w1",
      sets: 4,
      reps: 8,
      duration_seconds: null,
    });
  });

  it("saves minutes and seconds as a duration with no reps", () => {
    expect(selectionFromDraft("w1", { sets: "1", unit: "min", amount: "30" })).toEqual({
      workout_id: "w1",
      sets: 1,
      reps: null,
      duration_seconds: 1800,
    });
    expect(selectionFromDraft("w1", { sets: "3", unit: "sec", amount: "45" })).toEqual({
      workout_id: "w1",
      sets: 3,
      reps: null,
      duration_seconds: 45,
    });
  });

  it("falls back to the defaults for blank or zero fields", () => {
    expect(selectionFromDraft("w1", { sets: "", unit: "reps", amount: "0" })).toMatchObject({
      sets: 3,
      reps: 10,
    });
    expect(selectionFromDraft("w1", { sets: "0", unit: "min", amount: "" })).toMatchObject({
      sets: 3,
      duration_seconds: 5 * 60,
    });
    expect(selectionFromDraft("w1", { sets: "2", unit: "sec", amount: "" })).toMatchObject({
      duration_seconds: 30,
    });
  });

  it("loads a saved exercise in the unit it reads best in", () => {
    expect(draftFromPlanExercise({ sets: 3, reps: 12, durationSec: null })).toEqual({
      sets: "3",
      unit: "reps",
      amount: "12",
    });
    expect(draftFromPlanExercise({ sets: 1, reps: 0, durationSec: 1800 })).toEqual({
      sets: "1",
      unit: "min",
      amount: "30",
    });
    expect(draftFromPlanExercise({ sets: 3, reps: 0, durationSec: 45 })).toEqual({
      sets: "3",
      unit: "sec",
      amount: "45",
    });
  });

  it("round-trips: what loads is what saves", () => {
    for (const durationSec of [45, 90, 300, 1800]) {
      const draft = draftFromPlanExercise({ sets: 2, reps: 0, durationSec });
      expect(selectionFromDraft("w1", draft).duration_seconds).toBe(durationSec);
    }
  });
});

describe("formatExerciseDuration", () => {
  it.each([
    [45, "45 sec", "45 seconds"],
    [60, "1 min", "1 minute"],
    [90, "1 min 30 sec", "1 minute 30 seconds"],
    [1800, "30 min", "30 minutes"],
    [61, "1 min 1 sec", "1 minute 1 second"],
  ])("%i seconds -> %s / %s", (seconds, shown, spoken) => {
    expect(formatExerciseDuration(seconds)).toBe(shown);
    expect(formatExerciseDuration(seconds, { spoken: true })).toBe(spoken);
  });
});

describe("formatExerciseTarget", () => {
  const reps = { sets: 3, reps: 10, durationSec: null, weightKg: null };

  it("shows sets and reps", () => {
    expect(formatExerciseTarget(reps)).toBe("3 sets × 10 reps");
    expect(formatExerciseTarget(reps, { spoken: true })).toBe("3 sets of 10 reps");
  });

  it("adds the weight when there is one", () => {
    const weighted = { ...reps, weightKg: 20 };
    expect(formatExerciseTarget(weighted)).toBe("3 sets × 10 reps · 20 kg");
    expect(formatExerciseTarget(weighted, { spoken: true })).toBe(
      "3 sets of 10 reps at 20 kilograms",
    );
  });

  it("uses the singular for one", () => {
    expect(formatExerciseTarget({ ...reps, sets: 1, reps: 1 })).toBe("1 set × 1 rep");
  });

  it("shows a timed exercise's duration instead of reps", () => {
    const plank = { sets: 3, reps: 0, durationSec: 45, weightKg: null };
    expect(formatExerciseTarget(plank)).toBe("3 sets × 45 sec");
    expect(formatExerciseTarget(plank, { spoken: true })).toBe("3 sets of 45 seconds");
  });

  it("shows a single timed set as just its length", () => {
    const jog = { sets: 1, reps: 0, durationSec: 30 * 60, weightKg: null };
    expect(formatExerciseTarget(jog)).toBe("30 min");
    expect(formatExerciseTarget(jog, { spoken: true })).toBe("30 minutes");
  });
});
