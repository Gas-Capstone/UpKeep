/**
 * Profile height is stored as one number in feet.inches form: 5' 11" is
 * 5.11 and 5' 1" is 5.01.
 *
 * Always read it with arithmetic, never by splitting its text: 5' 10" is
 * stored as 5.10, which is the number 5.1, and the text "5.1" splits into
 * 1 inch instead of 10.
 */

/**
 * The stored value for what was typed in the feet and inches fields, or null
 * when no feet are given. Inches are clamped to 0–11; blank means 0.
 */
export function buildHeightValue(feetStr: string, inchesStr: string): number | null {
  const feet = Number(feetStr);
  if (!feetStr.trim() || !Number.isFinite(feet) || feet < 0) return null;

  const rawInches = Number(inchesStr);
  const inches = Number.isFinite(rawInches)
    ? Math.min(Math.max(Math.round(rawInches), 0), 11)
    : 0;

  return Math.round((Math.floor(feet) + inches / 100) * 100) / 100;
}

/** A stored height as whole feet and inches: 5.1 -> 5 feet 10 inches. */
export function splitHeight(height: number): { feet: number; inches: number } {
  const feet = Math.floor(height);
  return { feet, inches: Math.round((height - feet) * 100) };
}

/** 5.1 -> 5' 10". */
export function formatHeight(height: number): string {
  const { feet, inches } = splitHeight(height);
  return `${feet}' ${inches}"`;
}
