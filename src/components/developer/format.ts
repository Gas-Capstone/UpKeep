/** Number formatting shared by the Performance screen and its charts. */

export function formatMs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

export function formatPct(pct: number | null): string {
  if (pct == null) return "—";
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

/** 1,284 · 12.9K · 3.4M */
export function formatCount(n: number): string {
  if (n < 10_000) return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

export function plural(n: number, word: string): string {
  return `${formatCount(n)} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Below this many samples, a p95 or a percentage is too noisy to act on:
 * one slow request out of five is the whole "95th percentile". Shown, but
 * flagged rather than presented as solid.
 */
export const FEW_SAMPLES = 20;
