/**
 * Performance metrics: an in-memory buffer of events, flushed in batches to
 * the app_events table (supabase/performance-metrics.sql).
 *
 * This file must not import the Supabase client. The client imports
 * timedFetch from here to time every request, so importing it back would be a
 * cycle — the client is handed over at startup instead, through startMetrics.
 *
 * Only ids, durations and outcome codes are recorded. Never message text,
 * ingredient or habit names, query parameters, or storage object names.
 */

import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { AppState, Platform } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";

type MetricValue = string | number | boolean | null | string[];
export type MetricProps = Record<string, MetricValue>;

type MetricFields = {
  durationMs?: number | null;
  ok?: boolean | null;
  props?: MetricProps;
};

// Matches the app_events columns, so a batch inserts as-is. user_id is left
// to the column default, auth.uid(), which is also what the RLS policy checks.
type QueuedEvent = {
  created_at: string;
  name: string;
  duration_ms: number | null;
  ok: boolean | null;
  platform: string;
  app_version: string | null;
  update_id: string;
  props: MetricProps;
};

const FLUSH_INTERVAL_MS = 30_000;
// Oldest events are dropped past this, so a long stretch offline or signed
// out cannot grow the buffer without bound.
const MAX_BUFFER = 200;
const MAX_BATCH = 100;
const EVENTS_PATH = "/rest/v1/app_events";

const APP_VERSION = Constants.expoConfig?.version ?? null;
// 'dev' under Metro, so development traffic can be told apart from real use;
// 'embedded' when running the bundle shipped inside the build itself.
const UPDATE_ID = __DEV__ ? "dev" : (Updates.updateId ?? "embedded");

let buffer: QueuedEvent[] = [];
let client: SupabaseClient | null = null;
let flushing = false;

/** Record one event. Cheap and synchronous — nothing touches the network here. */
export function track(name: string, fields: MetricFields = {}) {
  buffer.push({
    created_at: new Date().toISOString(),
    name,
    duration_ms:
      fields.durationMs == null ? null : Math.max(0, Math.round(fields.durationMs)),
    ok: fields.ok ?? null,
    platform: Platform.OS,
    app_version: APP_VERSION,
    update_id: UPDATE_ID,
    props: fields.props ?? {},
  });

  if (buffer.length > MAX_BUFFER) {
    buffer = buffer.slice(buffer.length - MAX_BUFFER);
  }
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
// Everything up to and including the bucket name. Object keys after it carry
// user ids and file names, which are not ours to record.
const STORAGE_BUCKET =
  /^\/storage\/v1\/object\/(?:(?:public|sign|authenticated)\/)?[^/]+/;

/**
 * A request URL reduced to something safe to store and useful to group by:
 * no host, no query string (PostgREST filters like user_id=eq.<uuid> live
 * there), no storage object names, and any stray uuid collapsed to :id.
 *
 * Parsed by hand rather than with URL, whose React Native implementation has
 * historically been incomplete.
 */
export function normalizePath(url: string): string {
  const path =
    url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, "").split(/[?#]/)[0] || "/";

  const bucket = path.match(STORAGE_BUCKET);
  if (bucket) return bucket[0];

  return path.replace(UUID, ":id");
}

// Everything fetch may be handed. The DOM typings accept a URL object; React
// Native's own fetch declaration only takes string | Request, so the two
// disagree and both have to be handled.
type FetchInput = string | Request | URL;

function requestUrl(input: FetchInput): string {
  if (typeof input === "string") return input;
  if ("href" in input) return input.href;
  return input.url;
}

/** Narrows to what React Native's fetch accepts, turning a URL into its string. */
function asRequestInfo(input: FetchInput): string | Request {
  return typeof input === "string" || "url" in input ? input : input.href;
}

function recordRequest(
  url: string,
  method: string,
  status: number,
  durationMs: number,
) {
  const path = normalizePath(url);

  // The flush itself goes through this same fetch. Timing it would mean every
  // flush queues another event, forever.
  if (path.startsWith(EVENTS_PATH)) return;

  track("supabase_request", {
    durationMs,
    // 0 means the request never got a response at all.
    ok: status >= 200 && status < 400,
    props: { method, path, status },
  });
}

/**
 * Drop-in replacement for fetch, given to the Supabase client so that every
 * request it makes — REST, storage, auth — is timed in one place, without
 * touching any query.
 */
export const timedFetch: typeof fetch = async (input, init) => {
  const url = requestUrl(input);
  const method = (init?.method ?? "GET").toUpperCase();
  const started = Date.now();

  try {
    const response = await fetch(asRequestInfo(input), init);
    recordRequest(url, method, response.status, Date.now() - started);
    return response;
  } catch (error) {
    recordRequest(url, method, 0, Date.now() - started);
    throw error;
  }
};

/** Send whatever is buffered now, rather than waiting for the next interval. */
export async function flushMetrics(): Promise<void> {
  if (!client || flushing || buffer.length === 0) return;
  flushing = true;

  try {
    // Inserts need a signed-in user: the RLS policy compares user_id with
    // auth.uid(). Signed out, keep the buffer for later.
    const { data } = await client.auth.getSession();
    if (!data.session) return;

    const batch = buffer.slice(0, MAX_BATCH);
    // Never chain .select() here. Users hold INSERT but not SELECT on
    // app_events, and .select() turns this into INSERT ... RETURNING, which
    // needs SELECT: every batch would be refused and then dropped below.
    const { error } = await client.from("app_events").insert(batch);

    // Dropped whether or not it succeeded: a batch the database rejected will
    // be rejected again, and retrying it every interval only grows the
    // backlog behind it.
    buffer = buffer.slice(batch.length);

    if (error && __DEV__) {
      console.warn("Metrics flush rejected", error.message);
    }
  } catch {
    // Offline. The buffer is kept for the next attempt, bounded by MAX_BUFFER.
  } finally {
    flushing = false;
  }
}

/**
 * Begin flushing on an interval and whenever the app leaves the foreground —
 * the last chance before the OS may kill it. Events are recorded from the
 * moment the app loads; this only controls when they are sent.
 *
 * Returns a cleanup function.
 */
export function startMetrics(supabaseClient: SupabaseClient): () => void {
  client = supabaseClient;

  const timer = setInterval(() => {
    void flushMetrics();
  }, FLUSH_INTERVAL_MS);

  const subscription = AppState.addEventListener("change", (state) => {
    if (state !== "active") void flushMetrics();
  });

  return () => {
    clearInterval(timer);
    subscription.remove();
  };
}
