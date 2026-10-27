/**
 * Weight units. Weights are always stored in kilograms; pounds are only how
 * they're shown and typed, converted at the edges.
 */

export type WeightUnit = "kg" | "lb";

// Exact, by definition.
export const KG_PER_LB = 0.45359237;

// What the database accepts (weight_kg numeric(6, 2) <= 9999).
export const MAX_WEIGHT_KG = 9999;

/**
 * A stored weight as shown: kilograms as stored (to 0.01), pounds to 0.1,
 * which is finer than any plate and hides the conversion's noise.
 */
export function displayWeight(kg: number, unit: WeightUnit): number {
  return unit === "kg"
    ? Math.round(kg * 100) / 100
    : Math.round((kg / KG_PER_LB) * 10) / 10;
}

/**
 * A typed weight in kilograms, rounded to the 0.01 kg the database keeps, so
 * typing the same number again always gives the same stored value.
 */
export function toKg(value: number, unit: WeightUnit): number {
  const kg = unit === "kg" ? value : value * KG_PER_LB;
  return Math.round(kg * 100) / 100;
}

/** The heaviest weight that can be entered, in the unit it's typed in. */
export function maxWeight(unit: WeightUnit): number {
  return unit === "kg" ? MAX_WEIGHT_KG : Math.floor(MAX_WEIGHT_KG / KG_PER_LB);
}

/** "60 kg", "132.3 lb". `spoken`: "60 kilograms", "132.3 pounds". */
export function formatWeight(
  kg: number,
  unit: WeightUnit,
  { spoken = false }: { spoken?: boolean } = {},
): string {
  const value = displayWeight(kg, unit);
  if (!spoken) return `${value} ${unit}`;
  const word = unit === "kg" ? "kilogram" : "pound";
  return `${value} ${word}${value === 1 ? "" : "s"}`;
}

/** 2430 -> "2,430". Done by hand so it doesn't depend on Intl support. */
export function formatThousands(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
