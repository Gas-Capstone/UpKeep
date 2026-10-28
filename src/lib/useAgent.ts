/**
 * useAgent — talks to the Upkeep agent server running on the home machine.
 *
 * The signed-in user's JWT goes with every request; the server passes it
 * straight to Supabase, so RLS decides what the agent can touch. The app
 * never needs to know what the agent is allowed to do.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { track, type MetricProps } from './metrics';
import { supabase } from './supabaseClient';   // your existing client

// Set EXPO_PUBLIC_AGENT_URL in .env to override this — pointing at a LAN
// address for local work, for instance (http://10.0.2.2:8000 on the Android
// emulator). The fallback is the Cloudflare tunnel, which is where the server
// actually answers: uvicorn binds to loopback only, so a LAN address reaches
// nothing unless it is deliberately rebound.
const AGENT_URL =
  process.env.EXPO_PUBLIC_AGENT_URL ?? 'https://agent.upkeep.day';

// The home machine may be asleep or offline. Fail fast rather than leaving a
// spinner up forever — but not so fast that a slow turn looks like an outage.
// A cold model plus the tunnel hop can take well over 30s on the first
// request of a session.
const TIMEOUT_MS = 60000;

export type AgentTurn = {
  role: 'user' | 'agent';
  text: string;
  options?: string[];        // present when the agent asked a question
};

/** What the server needs back to finish a call it paused to ask about. */
type Resume = { tool: string; args: Record<string, unknown>; field: string };

/**
 * Called after a turn in which the agent actually wrote something. The app's
 * data contexts load once when they mount, so without this the fridge, meal
 * plan and workout lists keep showing pre-agent state until a restart.
 */
type UseAgentOptions = {
  onActionsCompleted?: () => void;
};

/** Tool names from a response's `completed` list, for the metrics. */
function toolNames(completed: unknown): string[] {
  if (!Array.isArray(completed)) return [];
  return completed
    .map((entry) =>
      entry && typeof entry === 'object' && 'tool' in entry
        ? String(entry.tool)
        : '',
    )
    .filter(Boolean);
}

/**
 * The server's own phase timings. The phone can only see the total, so this
 * is what separates "the model was slow" from "the tunnel was slow".
 */
function serverTiming(timing: unknown): MetricProps {
  if (!timing || typeof timing !== 'object') return {};
  const fields = timing as Record<string, unknown>;
  const out: MetricProps = {};
  for (const key of ['auth_ms', 'model_ms', 'tool_ms', 'server_ms']) {
    if (typeof fields[key] === 'number') out[key] = fields[key];
  }
  return out;
}

export function useAgent({ onActionsCompleted }: UseAgentOptions = {}) {
  const [turns, setTurns] = useState<AgentTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);

  // Kept in a ref so `send` doesn't need it as a dependency — the callback
  // closes over context functions that change identity on every render.
  const onCompleted = useRef(onActionsCompleted);
  // Updated in an effect rather than during render: React Compiler treats a
  // render-phase ref write as a side effect and the lint rule rejects it.
  useEffect(() => {
    onCompleted.current = onActionsCompleted;
  }, [onActionsCompleted]);

  // What the model is shown as context. Kept in a ref because `send` has no
  // dependencies — reading `turns` from its closure would always give the
  // first render's empty array. Written in an effect, not during render.
  const history = useRef<AgentTurn[]>([]);
  useEffect(() => {
    history.current = turns;
  }, [turns]);

  // Set when the agent asks something. The next message the user sends is
  // the ANSWER, so it rides along with this and resumes the paused call
  // instead of being re-routed by the model (which never saw the question).
  const pending = useRef<Resume | null>(null);

  const send = useCallback(async (message: string) => {
    setTurns(t => [...t, { role: 'user', text: message }]);
    setBusy(true);
    setOffline(false);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    // Settled by whichever branch ends the turn, and recorded once in
    // `finally`. The defaults describe a request that never got an answer.
    const started = Date.now();
    let outcome = 'network_error';
    let ok = false;
    let httpStatus = 0;
    let resumed = false;
    let tools: string[] = [];
    let timing: MetricProps = {};

    try {
      const { data } = await supabase.auth.getSession();
      const jwt = data.session?.access_token;

      if (!jwt) {
        outcome = 'signed_out';
        setTurns(t => [...t, { role: 'agent', text: 'Please sign in again.' }]);
        return;
      }

      // Consume the pending question, if any — one answer per question.
      const resume = pending.current;
      pending.current = null;
      resumed = resume !== null;

      const res = await fetch(`${AGENT_URL}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // history is the conversation BEFORE this message — the state update
        // above has not committed yet, which is exactly what the server wants.
        // Without it the model sees one line in isolation, so "add them to my
        // fridge" has no referent and "them" goes through as an ingredient.
        body: JSON.stringify({
          message,
          jwt,
          resume,
          history: history.current.map((turn) => ({
            role: turn.role,
            text: turn.text,
          })),
        }),
        signal: controller.signal,
      });

      // Recorded before parsing: when the tunnel or server is down,
      // Cloudflare answers with an HTML error page that fails to parse, and
      // this status (530 vs 502) is the only clue to which half is down.
      httpStatus = res.status;

      const json = await res.json();
      timing = serverTiming(json.timing);

      if (!json.ok) {
        outcome = typeof json.error === 'string' ? json.error : 'error';
        // no_tool_call, bad_arguments, execution_failed — all land here.
        // Keep the user-facing copy generic; the detail is for your logs.
        console.warn('agent error', json);
        setTurns(t => [...t, {
          role: 'agent',
          text: "I couldn't do that one. Try rephrasing?",
        }]);
        return;
      }

      ok = true;
      outcome = json.needs_clarification ? 'needs_clarification' : 'ok';
      tools = toolNames(json.completed);

      // Another question may follow ("what kind of milk?" -> "how much?").
      if (json.needs_clarification) {
        pending.current = json.resume ?? null;
      }

      // Only when something was actually written — a clarification on its own
      // changes nothing, and answer_wellness_question / decline touch no data.
      if (json.completed?.length) {
        onCompleted.current?.();
      }

      setTurns(t => [...t, {
        role: 'agent',
        text: json.reply,
        options: json.needs_clarification ? json.options : undefined,
      }]);

    } catch {
      // Timeout, machine asleep, wrong IP, firewall.
      outcome = controller.signal.aborted
        ? 'timeout'
        : httpStatus
          ? `http_${httpStatus}`
          : 'network_error';
      pending.current = null;
      setOffline(true);
      setTurns(t => [...t, {
        role: 'agent',
        text: 'The assistant is unavailable right now.',
      }]);
    } finally {
      clearTimeout(timer);
      setBusy(false);
      // Never the message itself — only what happened and how long it took.
      track('agent_turn', {
        durationMs: Date.now() - started,
        ok,
        props: { outcome, resumed, tools, http_status: httpStatus, ...timing },
      });
    }
  }, []);

  /**
   * The user tapped a clarification chip. Same path as typing the answer —
   * the pending resume envelope is what makes it land on the right tool.
   */
  const choose = useCallback((option: string) => send(option), [send]);

  return { turns, busy, offline, send, choose };
}