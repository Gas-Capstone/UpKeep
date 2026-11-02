/**
 * Reads for the developer Performance screen. Writes live in metrics.ts.
 *
 * Both calls go through security-definer functions in
 * supabase/performance-metrics.sql: users cannot read app_events at all, and
 * these return aggregates only, to accounts listed in public.developers.
 */

import { flushMetrics } from "./metrics";
import { supabase } from "./supabaseClient";

export type EndpointLatency = {
  method: string;
  path: string;
  requests: number;
  p50_ms: number | null;
  p95_ms: number | null;
  max_ms: number | null;
  error_pct: number | null;
};

export type AgentOutcome = {
  outcome: string;
  turns: number;
  pct: number | null;
  avg_ms: number | null;
  p95_ms: number | null;
};

export type AgentPhase = {
  step: number;
  phase: string;
  turns: number;
  avg_ms: number | null;
  p95_ms: number | null;
};

export type DataLoad = {
  source: string;
  loads: number;
  p50_ms: number | null;
  p95_ms: number | null;
  error_pct: number | null;
  avg_rows: number | null;
};

export type WorkoutOutcome = {
  outcome: string;
  sessions: number;
  pct: number | null;
  avg_minutes: number | null;
  avg_planned_min: number | null;
  set_completion_pct: number | null;
};

export type NotificationOpen = {
  kind: string;
  opens: number;
};

// One hour or day of the timeline. Percentiles are null where nothing
// happened in it.
export type TimelineBucket = {
  // Local time without an offset ("2026-10-27T14:00:00"): read as the phone's.
  start: string;
  requests: number;
  request_p95_ms: number | null;
  request_error_pct: number | null;
  agent_turns: number;
  agent_ok_pct: number | null;
  agent_p95_ms: number | null;
  workouts: number;
};

export type RecentError = {
  created_at: string;
  name: string;
  detail: string | null;
  status: string | null;
};

/** Shape of get_performance_summary(). Percentiles are null over an empty window. */
export type PerformanceSummary = {
  window_hours: number;
  generated_at: string;
  requests: {
    count: number;
    p50_ms: number | null;
    p95_ms: number | null;
    error_pct: number | null;
    // Split by cause (a later version of the SQL): the server failing (5xx),
    // the app asking for something wrong (4xx), or no answer at all.
    server_error_pct?: number | null;
    client_error_pct?: number | null;
    network_error_pct?: number | null;
  };
  endpoints: EndpointLatency[];
  agent: {
    turns: number;
    ok_pct: number | null;
    p50_ms: number | null;
    p95_ms: number | null;
  };
  agent_outcomes: AgentOutcome[];
  agent_phases: AgentPhase[];
  image_errors: number;
  recent_errors: RecentError[];

  // Added in a later version of the SQL. Optional so the screen still renders
  // against a database where the script hasn't been re-run — those sections
  // simply don't appear.
  data_loads?: DataLoad[];
  workouts?: {
    sessions: number;
    avg_minutes: number | null;
    set_completion_pct: number | null;
    // Of sessions that report it: their exercise results and remembered
    // sets saved too. Null until one reports.
    details_saved_pct?: number | null;
  };
  workout_outcomes?: WorkoutOutcome[];
  notifications?: {
    syncs: number;
    p50_ms: number | null;
    p95_ms: number | null;
    error_pct: number | null;
    denied_pct: number | null;
    avg_built: number | null;
    avg_scheduled: number | null;
  };
  notification_opens?: NotificationOpen[];
  // Hourly for a day or two, daily beyond, in the phone's time zone.
  timeline?: { unit: "hour" | "day"; buckets: TimelineBucket[] };
};

/** The signed-in account is not in public.developers. */
export class NotDeveloperError extends Error {}

/**
 * Without generated database types, supabase-js cannot know this RPC returns a
 * single object rather than rows, and refuses to cast it. Checking the shape
 * at runtime is more honest than forcing a cast anyway: it comes from SQL,
 * and an out-of-date function should fail loudly here, not as undefined
 * fields deep in the screen.
 */
function isPerformanceSummary(value: unknown): value is PerformanceSummary {
  if (typeof value !== "object" || value === null) return false;
  return (
    "requests" in value &&
    "agent" in value &&
    "endpoints" in value &&
    Array.isArray(value.endpoints) &&
    "agent_outcomes" in value &&
    Array.isArray(value.agent_outcomes)
  );
}

// Postgres insufficient_privilege, raised by get_performance_summary().
const NOT_AUTHORIZED = "42501";
// PostgREST: no function takes these arguments. The database still has the
// summary from before it took a time zone.
const NO_SUCH_FUNCTION = "PGRST202";

/** The phone's time zone ("America/Chicago"), so the timeline's days are its days. */
function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export async function fetchPerformanceSummary(
  hours: number,
): Promise<PerformanceSummary> {
  // Send whatever is still buffered first, so the summary includes the
  // requests made on the way to opening this page rather than trailing them
  // by up to a flush interval.
  await flushMetrics();

  let { data, error } = await supabase.rpc("get_performance_summary", {
    p_hours: hours,
    p_tz: deviceTimeZone(),
  });
  // Until performance-metrics.sql is re-run, ask the way the old summary
  // understands: the screen still works, just without the timeline.
  if (error?.code === NO_SUCH_FUNCTION) {
    ({ data, error } = await supabase.rpc("get_performance_summary", {
      p_hours: hours,
    }));
  }

  if (error) {
    if (error.code === NOT_AUTHORIZED) {
      throw new NotDeveloperError("This account is not a developer.");
    }
    throw error;
  }

  const payload: unknown = data;
  if (!isPerformanceSummary(payload)) {
    throw new Error("The summary did not have the expected shape.");
  }
  return payload;
}

/**
 * Whether to show the Developer section in Settings. False on any failure —
 * including the SQL not having been run yet — since hiding a developer tool
 * is the safe default.
 */
export async function checkIsDeveloper(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_developer");
  const value: unknown = data;
  return !error && value === true;
}
