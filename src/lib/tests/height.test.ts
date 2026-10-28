import { estimateCalorieGoal } from "@/lib/calorieGoal";
import { buildHeightValue, formatHeight, splitHeight } from "@/lib/height";

describe("height", () => {
  it("reads 5' 10\" back as 10 inches, not 1", () => {
    const stored = buildHeightValue("5", "10");
    expect(stored).toBe(5.1); // the number 5.10 is 5.1
    expect(splitHeight(5.1)).toEqual({ feet: 5, inches: 10 });
    expect(formatHeight(5.1)).toBe(`5' 10"`);
  });

  it("keeps 5' 1\" and 5' 10\" apart", () => {
    expect(buildHeightValue("5", "1")).toBe(5.01);
    expect(formatHeight(5.01)).toBe(`5' 1"`);
  });

  it("round-trips every height from 3' 0\" to 7' 11\"", () => {
    for (let feet = 3; feet <= 7; feet++) {
      for (let inches = 0; inches <= 11; inches++) {
        const stored = buildHeightValue(String(feet), String(inches));
        expect(stored).not.toBeNull();
        expect(splitHeight(stored ?? 0)).toEqual({ feet, inches });
      }
    }
  });

  it("treats blank inches as 0 and clamps them to 0–11", () => {
    expect(buildHeightValue("6", "")).toBe(6);
    expect(formatHeight(6)).toBe(`6' 0"`);
    expect(buildHeightValue("5", "14")).toBe(5.11);
  });

  it("has no height without feet", () => {
    expect(buildHeightValue("", "10")).toBeNull();
    expect(buildHeightValue("abc", "10")).toBeNull();
  });

  it("gives the calorie goal 70 inches for 5' 10\"", () => {
    // Same person at 5' 10" vs 5' 1": 9 inches is 22.86 cm, or ~143 kcal/day
    // of BMR, times the activity multiplier -> clearly different goals.
    const tall = estimateCalorieGoal({ heightFeet: 5.1, weightLbs: 170, sex: true, age: 21 });
    const short = estimateCalorieGoal({ heightFeet: 5.01, weightLbs: 170, sex: true, age: 21 });
    expect(tall).toBeGreaterThan(short);
  });
});
