// Pure logic for taking a cooked recipe's ingredients out of the fridge. No
// I/O — CookingScreen's "Update your fridge" step builds the uses from the
// user's choices, and mealsDataContext.saveFridge() writes the result.

import type { FridgeEntry } from "./meals";

/** How much of one fridge item was used, in that fridge item's own unit. */
export type FridgeUse = {
  ingredientId: string;
  amount: number;
};

// "Cups" and "cup " are the same unit; anything else ("cup" vs "oz") is not.
// There's no conversion table, so differing units are never compared by value.
// ponytail: plural-stripping only, add real unit conversion if users mix units.
function normalizeUnit(unit: string | null | undefined): string {
  const value = (unit ?? "").trim().toLowerCase();
  return value.length > 2 && value.endsWith("s") ? value.slice(0, -1) : value;
}

export function sameUnit(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return normalizeUnit(a) === normalizeUnit(b);
}

/**
 * The amount to suggest for a fridge item, as text for the amount box: the
 * recipe's own amount when it's in the same unit as the fridge, otherwise
 * blank so nothing is subtracted until the user types an amount.
 */
export function suggestedAmount(
  needed: { quantity: number | null; unit: string | null },
  entry: FridgeEntry | undefined,
): string {
  if (!entry || needed.quantity === null) return "";
  if (!sameUnit(needed.unit, entry.unit)) return "";
  return String(needed.quantity);
}

function roundToHundredths(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The fridge after subtracting each use. Items that reach zero (or less) are
 * removed rather than kept at zero. Uses of items not in the fridge, and
 * non-positive amounts, are ignored. Several uses of the same item add up —
 * two recipe lines can both be swapped onto one fridge item.
 */
export function applyFridgeUses(
  fridge: ReadonlyMap<string, FridgeEntry>,
  uses: FridgeUse[],
): Map<string, FridgeEntry> {
  const next = new Map(fridge);
  for (const use of uses) {
    const entry = next.get(use.ingredientId);
    if (!entry || !Number.isFinite(use.amount) || use.amount <= 0) continue;

    const remaining = roundToHundredths(entry.quantity - use.amount);
    if (remaining <= 0) next.delete(use.ingredientId);
    else next.set(use.ingredientId, { ...entry, quantity: remaining });
  }
  return next;
}
