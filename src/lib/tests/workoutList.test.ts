import type {
  CompletedWorkout,
  Workout,
} from "@/components/context/workoutsDataContext";
import {
  NO_FILTERS,
  filterOptions,
  filterWorkouts,
  formatDuration,
  formatEquipment,
  formatLastDone,
  getMostDonePlan,
  getTotalMinutes,
  getWorkoutStreak,
  getWorkoutsThisWeek,
  hasActiveFilters,
  lastDoneByPlan,
} from "@/lib/workoutList";

// Local-time dates throughout, so these pass in any time zone — CI runs in
// UTC, the app runs wherever the phone is.
const at = (day: number, hour = 12) => new Date(2026, 9, day, hour, 0, 0);

const USER = "user-1";

function plan(overrides: Partial<Workout> & { id: string }): Workout {
  return {
    name: `Plan ${overrides.id}`,
    difficulty: "beginner",
    target: "full body",
    duration_min: 30,
    goal_tags: [],
    created_by: null,
    ...overrides,
  };
}

function session(
  id: string,
  planId: string | null,
  when: Date,
  minutes = 30,
  name = `Plan ${planId}`,
): CompletedWorkout {
  return {
    id,
    name,
    duration_min: minutes,
    completed_at: when.toISOString(),
    workout_plan_id: planId,
  };
}

describe("filterWorkouts", () => {
  const plans = [
    plan({ id: "a", difficulty: "Beginner", target: "Legs", goal_tags: ["muscle"] }),
    plan({ id: "b", difficulty: "advanced", target: "full body", goal_tags: ["endurance"] }),
    plan({ id: "c", difficulty: "beginner", target: "legs", created_by: USER }),
    plan({ id: "d", difficulty: "intermediate", target: "Arms", created_by: "someone-else" }),
  ];
  const ids = (list: Workout[]) => list.map((w) => w.id);

  it("returns everything with no filters", () => {
    expect(ids(filterWorkouts(plans, NO_FILTERS, USER))).toEqual(["a", "b", "c", "d"]);
  });

  it("filters by goal tag", () => {
    expect(ids(filterWorkouts(plans, { ...NO_FILTERS, tag: "muscle" }, USER))).toEqual(["a"]);
  });

  it("'mine' keeps only the signed-in user's plans", () => {
    expect(ids(filterWorkouts(plans, { ...NO_FILTERS, source: "mine" }, USER))).toEqual(["c"]);
  });

  it("'mine' with nobody signed in matches nothing rather than everything", () => {
    expect(filterWorkouts(plans, { ...NO_FILTERS, source: "mine" }, undefined)).toEqual([]);
  });

  it("'built-in' keeps only seeded plans", () => {
    expect(ids(filterWorkouts(plans, { ...NO_FILTERS, source: "built-in" }, USER))).toEqual(["a", "b"]);
  });

  it("matches difficulty and target regardless of case", () => {
    expect(
      ids(filterWorkouts(plans, { ...NO_FILTERS, difficulty: "beginner", target: "legs" }, USER)),
    ).toEqual(["a", "c"]);
  });

  it("combines every filter", () => {
    expect(
      ids(
        filterWorkouts(
          plans,
          { tag: "all", source: "mine", difficulty: "beginner", target: "legs" },
          USER,
        ),
      ),
    ).toEqual(["c"]);
  });
});

describe("filterOptions", () => {
  const plans = [
    plan({ id: "1", difficulty: "Advanced", target: "Legs" }),
    plan({ id: "2", difficulty: "beginner", target: "arms" }),
    plan({ id: "3", difficulty: "BEGINNER", target: "" }),
    plan({ id: "4", difficulty: "elite", target: "legs" }),
    plan({ id: "5", difficulty: "intermediate", target: "Core" }),
  ];

  it("orders difficulty naturally, not alphabetically, with unknown values last", () => {
    expect(filterOptions(plans, "difficulty")).toEqual([
      "beginner",
      "intermediate",
      "advanced",
      "elite",
    ]);
  });

  it("de-duplicates case-insensitively and drops blanks", () => {
    expect(filterOptions(plans, "target")).toEqual(["arms", "core", "legs"]);
  });
});

describe("hasActiveFilters", () => {
  it("is false only when nothing is set", () => {
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...NO_FILTERS, target: "legs" })).toBe(true);
    expect(hasActiveFilters({ ...NO_FILTERS, source: "mine" })).toBe(true);
  });
});

describe("lastDoneByPlan", () => {
  it("keeps the latest completion per plan and skips deleted plans", () => {
    const latest = lastDoneByPlan([
      session("1", "a", at(10)),
      session("2", "a", at(18)),
      session("3", "a", at(14)),
      session("4", "b", at(12)),
      session("5", null, at(20)),
    ]);
    expect(latest.get("a")).toBe(at(18).getTime());
    expect(latest.get("b")).toBe(at(12).getTime());
    expect(latest.size).toBe(2);
  });
});

describe("formatLastDone", () => {
  const now = at(21, 9);

  it.each([
    [at(21, 7), "Done today"],
    [at(20, 23), "Done yesterday"], // late last night is still yesterday
    [at(18), "Done 3 days ago"],
    [at(14), "Done 1 week ago"],
    [at(1), "Done 2 weeks ago"],
    [new Date(2026, 7, 21, 12), "Done 2 months ago"],
  ])("%s -> %s", (when, label) => {
    expect(formatLastDone(when.getTime(), now)).toBe(label);
  });
});

describe("formatEquipment", () => {
  it("says nothing when nothing is known", () => {
    expect(formatEquipment(undefined)).toBeNull();
    expect(formatEquipment([])).toBeNull();
  });

  it("recognises bodyweight-only plans", () => {
    expect(formatEquipment(["Bodyweight", "none", "body weight"])).toBe("No equipment needed");
  });

  it("drops bodyweight entries alongside real equipment, and de-duplicates", () => {
    expect(formatEquipment(["dumbbell", "Bodyweight", "Dumbbell", "bench"])).toBe(
      "Dumbbell, Bench",
    );
  });

  it("shows three and counts the rest", () => {
    expect(formatEquipment(["barbell", "bench", "rack", "cable", "band"])).toBe(
      "Barbell, Bench, Rack +2 more",
    );
  });
});

describe("history summary", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("totals minutes", () => {
    expect(getTotalMinutes([session("1", "a", at(1), 30), session("2", "b", at(2), 45)])).toBe(75);
  });

  it("formats durations", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(750)).toBe("12 h 30 min");
  });

  it("finds the most-done plan, ties going to the most recent", () => {
    const done = [
      session("1", "a", at(1), 30, "Push day"),
      session("2", "b", at(2), 30, "Pull day"),
      session("3", "a", at(3), 30, "Push day"),
      session("4", "b", at(9), 30, "Pull day"),
      session("5", null, at(10), 30, "Deleted plan"),
      session("6", null, at(11), 30, "Deleted plan"),
      session("7", null, at(12), 30, "Deleted plan"),
    ];
    // a and b both have 2; b was done more recently. Deleted plans, despite
    // having 3, never win.
    expect(getMostDonePlan(done)).toEqual({ name: "Pull day", count: 2 });
  });

  it("has no most-done plan with no history", () => {
    expect(getMostDonePlan([])).toBeNull();
  });

  it("counts consecutive days ending today", () => {
    jest.useFakeTimers().setSystemTime(at(21, 18));
    const done = [
      session("1", "a", at(21, 8)),
      session("2", "a", at(20)),
      session("3", "a", at(19)),
      session("4", "a", at(17)), // gap on the 18th ends the streak
    ];
    expect(getWorkoutStreak(done)).toBe(3);
  });

  it("reads 0 before today's first workout, as on the home tab", () => {
    jest.useFakeTimers().setSystemTime(at(21, 18));
    expect(getWorkoutStreak([session("1", "a", at(20)), session("2", "a", at(19))])).toBe(0);
  });

  it("counts this week from Sunday", () => {
    // Oct 21 2026 is a Wednesday, so the week began Sunday the 18th.
    jest.useFakeTimers().setSystemTime(at(21, 18));
    const done = [
      session("1", "a", at(21)),
      session("2", "a", at(18, 0)),
      session("3", "a", at(17, 23)), // Saturday: last week
    ];
    expect(getWorkoutsThisWeek(done)).toBe(2);
  });
});
