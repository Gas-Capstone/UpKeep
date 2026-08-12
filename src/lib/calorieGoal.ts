// Estimates a daily calorie goal (TDEE) from basic biometrics using the
// Mifflin-St Jeor equation.
// "Lightly active" (light exercise 1-3 days/week) — a reasonable
// middle-of-the-road default until real activity-level tracking exists.
const ACTIVITY_MULTIPLIER = 1.375;

export type CalorieGoalInput = {
  heightFeet: number; // e.g. 5.11 means 5'11" (feet.inches, not decimal feet)
  weightLbs: number;
  sex: boolean; // true = male, false = female, per the profiles table
  age: number;
};

function heightFeetInchesToCm(heightFeet: number): number {
  const feet = Math.floor(heightFeet);
  const inches = Math.round((heightFeet - feet) * 100);
  const totalInches = feet * 12 + inches;
  return totalInches * 2.54;
}

function lbsToKg(lbs: number): number {
  return lbs * 0.453592;
}

// Returns an estimated daily calorie goal in kcal, rounded to the nearest 10.
export function estimateCalorieGoal({
  heightFeet,
  weightLbs,
  sex,
  age,
}: CalorieGoalInput): number {
  const heightCm = heightFeetInchesToCm(heightFeet);
  const weightKg = lbsToKg(weightLbs);

  const bmr = sex
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  const tdee = bmr * ACTIVITY_MULTIPLIER;
  return Math.round(tdee / 10) * 10;
}
