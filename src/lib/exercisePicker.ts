import type { PlanWorkout } from "@/components/context/workoutsDataContext";

const normalize = (value: string) => value.trim().toLocaleLowerCase();

export function exerciseFilterOptions(
  exercises: PlanWorkout[],
  field: "muscle_group" | "equipment",
): string[] {
  const options = new Map<string, string>();
  for (const exercise of exercises) {
    const value = exercise[field]?.trim();
    if (value) options.set(normalize(value), value);
  }
  return [...options.values()].sort((a, b) => a.localeCompare(b));
}

export function filterExercises(
  exercises: PlanWorkout[],
  filters: { query: string; muscle: string; equipment: string },
): PlanWorkout[] {
  const terms = normalize(filters.query).split(/\s+/).filter(Boolean);
  if (!terms.length && !filters.muscle && !filters.equipment) return exercises;

  return exercises.filter((exercise) => {
    if (filters.muscle && normalize(exercise.muscle_group ?? "") !== normalize(filters.muscle)) return false;
    if (filters.equipment && normalize(exercise.equipment ?? "") !== normalize(filters.equipment)) return false;
    const text = normalize([exercise.name, exercise.muscle_group, exercise.equipment].filter(Boolean).join(" "));
    return terms.every((term) => text.includes(term));
  });
}
