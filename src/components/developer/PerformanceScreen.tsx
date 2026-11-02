/**
 * PerformanceScreen — developer-only view of the app's performance metrics.
 *
 * Reads aggregates from get_performance_summary(), which only answers for
 * accounts listed in public.developers. The Settings entry is hidden for
 * everyone else, but the database is what actually enforces it.
 *
 * Every value is printed beside its bar or line, so the graphics are a
 * reading aid and nothing depends on color alone. Figures resting on too few
 * samples to trust are drawn faded and say so. Agent outcomes carry their status with an
 * icon and a label rather than with the bar's fill: this app's success green
 * and its neutral gray are too close to tell apart side by side, even with
 * full color vision.
 */

import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { format } from "date-fns";
import {
  ActivityIndicator,
  Button,
  Card,
  Icon,
  IconButton,
  SegmentedButtons,
  Text,
} from "react-native-paper";

import { useThemeMode } from "@/components/context/ThemeContext";
import { Center } from "@/components/ui/center";
import { ScreenView } from "@/components/ui/ScreenView";
import { Colors, Radius, Spacing, TopBadgeInset } from "@/constants/theme";
import {
  NotDeveloperError,
  fetchPerformanceSummary,
  type PerformanceSummary,
} from "@/lib/performance";
import { FEW_SAMPLES, formatCount, formatMs, formatPct, plural } from "./format";
import { RangeBar, Sparkline, TrendChart, markColor } from "./PerformanceCharts";

const WINDOWS = [
  { hours: 24, label: "24h", phrase: "last 24 hours" },
  { hours: 168, label: "7 days", phrase: "last 7 days" },
  { hours: 720, label: "30 days", phrase: "last 30 days" },
];

type LoadError = "forbidden" | "failed";

type ThemeColors = (typeof Colors)["light"] | (typeof Colors)["dark"];

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function formatMinutes(minutes: number | null): string {
  return minutes == null ? "—" : `${minutes} min`;
}

/** " · few samples" when a figure rests on too little to trust. */
function fewNote(samples: number): string {
  return samples > 0 && samples < FEW_SAMPLES ? " · few samples, rough" : "";
}

// ---------------------------------------------------------------------------
// Agent outcomes
// ---------------------------------------------------------------------------

type OutcomeStatus = "good" | "neutral" | "bad";

const FAILURE_LABELS: Record<string, string> = {
  no_tool_call: "Replied without acting",
  bad_arguments: "Bad tool arguments",
  execution_failed: "Tool failed",
  unknown_tool: "Unknown tool",
  timeout: "Timed out",
  network_error: "Couldn't reach the server",
  signed_out: "Signed out",
  no_jwt: "No token sent",
  bad_jwt: "Token rejected",
};

const STATUS_ICON: Record<OutcomeStatus, string> = {
  good: "check-circle-outline",
  neutral: "help-circle-outline",
  bad: "alert-circle-outline",
};

function describeOutcome(outcome: string): {
  label: string;
  status: OutcomeStatus;
} {
  if (outcome === "ok") return { label: "Succeeded", status: "good" };
  if (outcome === "needs_clarification") {
    return { label: "Asked to clarify", status: "neutral" };
  }

  // Recorded when Cloudflare answers instead of the agent, which tells you
  // which half is down without reading a log.
  const http = outcome.match(/^http_(\d+)$/);
  if (http) {
    const code = http[1];
    const what =
      code === "530"
        ? "Tunnel down"
        : code === "502"
          ? "Agent server down"
          : "HTTP error";
    return { label: `${what} (${code})`, status: "bad" };
  }

  return { label: FAILURE_LABELS[outcome] ?? outcome, status: "bad" };
}

function statusColor(status: OutcomeStatus, colors: ThemeColors): string {
  if (status === "good") return colors.success;
  if (status === "neutral") return colors.textSecondary;
  return colors.danger;
}

const PHASE_LABELS: Record<string, string> = {
  auth: "Auth check",
  model: "Model",
  tools: "Tools",
  "network + tunnel": "Network + tunnel",
};

const SOURCE_LABELS: Record<string, string> = {
  meals_catalog: "Meals catalog",
  fridge: "Fridge",
  workout_plans: "Workout plans",
  workout_history: "Workout history",
  exercise_library: "Exercise library",
  habits: "Habits",
  workout_exercises: "A workout's exercises",
  personal_records: "Personal records",
};

// How a workout ended. Only finishing every set is shown as "good"; running
// out of time and stopping early are neutral rather than bad — ending a
// workout is the user's call, not a fault, so neither wears the danger color.
const WORKOUT_OUTCOMES: Record<
  string,
  { label: string; icon: string; status: OutcomeStatus }
> = {
  all_sets_done: { label: "Finished every set", icon: "check-circle-outline", status: "good" },
  time_up: { label: "Reached planned time", icon: "timer-outline", status: "neutral" },
  stopped_early: { label: "Stopped early", icon: "stop-circle-outline", status: "neutral" },
};

const REMINDER_KIND_LABELS: Record<string, string> = {
  "daily-summary": "Daily summary",
  habit: "Habit reminders",
  meal: "Meal reminders",
  other: "Other, e.g. a test",
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function PerformanceScreen() {
  const router = useRouter();
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  const [hours, setHours] = useState(168);
  // Bumped by the refresh button, so the same window can be fetched again.
  const [nonce, setNonce] = useState(0);
  const requestKey = `${hours}:${nonce}`;

  // The last good summary is kept while a new one loads, and shown faded,
  // rather than blanking the page on every refresh.
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [settled, setSettled] = useState<{
    key: string;
    error: LoadError | null;
  } | null>(null);

  useEffect(() => {
    let active = true;
    const key = `${hours}:${nonce}`;

    fetchPerformanceSummary(hours)
      .then((result) => {
        if (!active) return;
        setSummary(result);
        setSettled({ key, error: null });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setSettled({
          key,
          error: error instanceof NotDeveloperError ? "forbidden" : "failed",
        });
      });

    return () => {
      active = false;
    };
  }, [hours, nonce]);

  // Derived rather than stored: loading is simply "the latest request has
  // not answered yet".
  const loading = settled?.key !== requestKey;
  const error = loading ? null : (settled?.error ?? null);
  const windowPhrase =
    WINDOWS.find((w) => w.hours === hours)?.phrase ?? `last ${hours} hours`;

  return (
    <ScreenView
      header={
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <IconButton
              icon="arrow-left"
              size={24}
              style={{ margin: 0 }}
              onPress={() => router.back()}
              accessibilityLabel="Back"
            />
            <Text
              variant="titleLarge"
              style={{ color: colors.text, marginLeft: Spacing.two, flex: 1 }}
            >
              Performance
            </Text>
            <IconButton
              icon="refresh"
              size={22}
              style={{ margin: 0 }}
              disabled={loading}
              onPress={() => setNonce((n) => n + 1)}
              accessibilityLabel="Refresh"
            />
          </View>

          {/* One filter row, above everything it scopes. */}
          <SegmentedButtons
            value={String(hours)}
            onValueChange={(value) => setHours(Number(value))}
            buttons={WINDOWS.map((w) => ({
              value: String(w.hours),
              label: w.label,
            }))}
          />
        </View>
      }
    >
      {error === "forbidden" ? (
        <Notice
          icon="lock-outline"
          title="Developers only"
          body="This account isn't listed in public.developers, so the summary won't answer for it."
          colors={colors}
        />
      ) : !summary && loading ? (
        <Center style={{ paddingVertical: Spacing.five }}>
          <ActivityIndicator />
        </Center>
      ) : !summary ? (
        <Notice
          icon="cloud-alert-outline"
          title="Couldn't load metrics"
          body="Check that supabase/performance-metrics.sql has been run, then try again."
          colors={colors}
          action={{ label: "Try again", onPress: () => setNonce((n) => n + 1) }}
        />
      ) : (
        <View style={{ gap: Spacing.three, opacity: loading ? 0.5 : 1 }}>
          {error === "failed" && (
            <Text variant="bodySmall" style={{ color: colors.danger }}>
              Couldn&apos;t refresh — showing the last figures loaded.
            </Text>
          )}

          <Summary summary={summary} windowPhrase={windowPhrase} colors={colors} />
        </View>
      )}
    </ScreenView>
  );
}

function Summary({
  summary,
  windowPhrase,
  colors,
}: {
  summary: PerformanceSummary;
  windowPhrase: string;
  colors: ThemeColors;
}) {
  const { requests, agent } = summary;
  const workoutSessions = summary.workouts?.sessions ?? 0;
  const syncs = summary.notifications?.syncs ?? 0;
  const opens = summary.notification_opens ?? [];

  if (
    requests.count === 0 &&
    agent.turns === 0 &&
    (summary.data_loads ?? []).length === 0 &&
    workoutSessions === 0 &&
    syncs === 0 &&
    opens.length === 0
  ) {
    return (
      <Notice
        icon="chart-timeline-variant"
        title="Nothing recorded yet"
        body={`No events in the ${windowPhrase}. The app sends them every 30 seconds and when it goes to the background, so use it for a minute and refresh.`}
        colors={colors}
      />
    );
  }

  const slowest = Math.max(1, ...summary.endpoints.map((e) => e.p95_ms ?? 0));
  const buckets = summary.timeline?.buckets ?? [];
  const trend = (pick: (b: (typeof buckets)[number]) => number | null) =>
    buckets.length > 1 ? buckets.map(pick) : undefined;
  const failures = [
    { label: "Server errors (5xx)", pct: requests.server_error_pct, detail: "The database or API failed. Check Supabase." },
    { label: "App errors (4xx)", pct: requests.client_error_pct, detail: "The app asked for something wrong or wasn't allowed. Check the endpoint below." },
    { label: "No response", pct: requests.network_error_pct, detail: "Offline or dropped: usually the phone's connection, not the app." },
  ];
  const showFailures =
    (requests.error_pct ?? 0) > 0 && failures.some((f) => f.pct != null);
  const mostFailures = Math.max(0.1, ...failures.map((f) => f.pct ?? 0));
  const longestPhase = Math.max(1, ...summary.agent_phases.map((p) => p.avg_ms ?? 0));
  const dataLoads = summary.data_loads ?? [];
  const slowestLoad = Math.max(1, ...dataLoads.map((d) => d.p95_ms ?? 0));
  const mostOpens = Math.max(1, ...opens.map((o) => o.opens));
  const notifications = summary.notifications;

  return (
    <>
      <View style={styles.tiles}>
        <StatTile
          label="Request latency, p95"
          value={formatMs(requests.p95_ms)}
          detail={`p50 ${formatMs(requests.p50_ms)} · ${plural(requests.count, "request")}${fewNote(requests.count)}`}
          trend={trend((b) => b.request_p95_ms)}
          colors={colors}
        />
        <StatTile
          label="Request errors"
          value={formatPct(requests.error_pct)}
          detail={`${plural(requests.count, "request")}${fewNote(requests.count)}`}
          trend={trend((b) => b.request_error_pct)}
          colors={colors}
        />
        <StatTile
          label="Assistant success"
          value={formatPct(agent.ok_pct)}
          detail={`${plural(agent.turns, "turn")}${fewNote(agent.turns)}`}
          trend={trend((b) => b.agent_ok_pct)}
          colors={colors}
        />
        <StatTile
          label="Assistant latency, p95"
          value={formatMs(agent.p95_ms)}
          detail={`p50 ${formatMs(agent.p50_ms)}${fewNote(agent.turns)}`}
          trend={trend((b) => b.agent_p95_ms)}
          colors={colors}
        />
      </View>

      {summary.timeline && buckets.length > 1 && (
        <Section
          title="Over time"
          subtitle={`By ${summary.timeline.unit}, ${windowPhrase}, in your time zone. Tap a bar to read it.`}
          colors={colors}
        >
          <TrendChart unit={summary.timeline.unit} buckets={buckets} colors={colors} />
        </Section>
      )}

      {showFailures && (
        <Section
          title="Request failures"
          subtitle={`Share of all ${plural(requests.count, "request")}, by cause`}
          colors={colors}
        >
          {failures.map((failure, index) => (
            <BarRow
              key={failure.label}
              first={index === 0}
              title={failure.label}
              value={formatPct(failure.pct ?? null)}
              // Against the largest cause, for resolution: these are small
              // numbers, and the printed share is what's read.
              fraction={(failure.pct ?? 0) / mostFailures}
              detail={failure.detail}
              colors={colors}
            />
          ))}
        </Section>
      )}

      {summary.endpoints.length > 0 && (
        <Section
          title="Slowest endpoints"
          subtitle={`Typical (p50, hollow dot) to slow (p95, filled dot), ${windowPhrase}. A long line means usually fast but sometimes slow.`}
          colors={colors}
        >
          {summary.endpoints.map((endpoint, index) => (
            <BarRow
              key={`${endpoint.method} ${endpoint.path}`}
              first={index === 0}
              title={`${endpoint.method} ${endpoint.path}`}
              mono
              value={formatMs(endpoint.p95_ms)}
              graphic={
                <RangeBar
                  p50={endpoint.p50_ms}
                  p95={endpoint.p95_ms}
                  scale={slowest}
                  faded={endpoint.requests < FEW_SAMPLES}
                  colors={colors}
                />
              }
              detail={`p50 ${formatMs(endpoint.p50_ms)} · ${plural(endpoint.requests, "request")} · ${formatPct(endpoint.error_pct)} errors${fewNote(endpoint.requests)}`}
              colors={colors}
            />
          ))}
        </Section>
      )}

      {dataLoads.length > 0 && (
        <Section
          title="Data loading"
          subtitle={`How long each screen's data takes to arrive, 95th percentile, ${windowPhrase}`}
          colors={colors}
          footnote="The whole wait you see. Its requests run in parallel, so this is roughly the slowest of them — the endpoints above show each one on its own."
        >
          {dataLoads.map((load, index) => (
            <BarRow
              key={load.source}
              first={index === 0}
              title={SOURCE_LABELS[load.source] ?? load.source}
              value={formatMs(load.p95_ms)}
              fraction={(load.p95_ms ?? 0) / slowestLoad}
              uncertain={load.loads < FEW_SAMPLES}
              detail={`${plural(load.loads, "load")} · p50 ${formatMs(load.p50_ms)}${
                load.avg_rows != null ? ` · ~${formatCount(load.avg_rows)} rows` : ""
              } · ${formatPct(load.error_pct)} failed${fewNote(load.loads)}`}
              colors={colors}
            />
          ))}
        </Section>
      )}

      {summary.agent_outcomes.length > 0 && (
        <Section
          title="Assistant outcomes"
          subtitle={`Share of ${plural(agent.turns, "turn")}`}
          colors={colors}
        >
          {summary.agent_outcomes.map((row, index) => {
            const { label, status } = describeOutcome(row.outcome);
            return (
              <BarRow
                key={row.outcome}
                first={index === 0}
                leadingIcon={STATUS_ICON[status]}
                leadingColor={statusColor(status, colors)}
                title={label}
                value={formatPct(row.pct)}
                // Against 100%, not the largest row: these are shares of a
                // whole, so a full-width bar should mean everything.
                fraction={(row.pct ?? 0) / 100}
                detail={`${plural(row.turns, "turn")} · avg ${formatMs(row.avg_ms)}`}
                colors={colors}
              />
            );
          })}
        </Section>
      )}

      {summary.agent_phases.length > 0 && (
        <Section
          title="Where assistant time goes"
          subtitle="Average per phase"
          colors={colors}
          footnote="Phases are averaged separately and don't sum to a turn's total — tools only run on some turns. Network + tunnel is the phone's total minus the server's."
        >
          {summary.agent_phases.map((phase, index) => (
            <BarRow
              key={phase.phase}
              first={index === 0}
              title={PHASE_LABELS[phase.phase] ?? phase.phase}
              value={formatMs(phase.avg_ms)}
              fraction={(phase.avg_ms ?? 0) / longestPhase}
              uncertain={phase.turns < FEW_SAMPLES}
              detail={`p95 ${formatMs(phase.p95_ms)} · ${plural(phase.turns, "turn")}${fewNote(phase.turns)}`}
              colors={colors}
            />
          ))}
        </Section>
      )}

      {workoutSessions > 0 && (
        <Section
          title="Workout sessions"
          subtitle={`${plural(workoutSessions, "session")} · ${formatPct(
            summary.workouts?.set_completion_pct ?? null,
          )} of sets completed · avg ${formatMinutes(summary.workouts?.avg_minutes ?? null)}`}
          colors={colors}
          footnote="Minutes are active time — pauses aren't counted."
        >
          {(summary.workout_outcomes ?? []).map((row, index) => {
            const known = WORKOUT_OUTCOMES[row.outcome];
            return (
              <BarRow
                key={row.outcome}
                first={index === 0}
                leadingIcon={known?.icon ?? STATUS_ICON.neutral}
                leadingColor={statusColor(known?.status ?? "neutral", colors)}
                title={known?.label ?? row.outcome}
                value={formatPct(row.pct)}
                // Shares of all sessions, so measured against 100%.
                fraction={(row.pct ?? 0) / 100}
                detail={`${plural(row.sessions, "session")} · ${formatMinutes(row.avg_minutes)} of ${formatMinutes(row.avg_planned_min)} planned · ${formatPct(row.set_completion_pct)} of sets`}
                colors={colors}
              />
            );
          })}

          {/* Results and remembered sets may fail without failing the
              workout, so this is where such a failure shows. */}
          {summary.workouts?.details_saved_pct != null && (
            <BarRow
              first={false}
              leadingIcon={
                summary.workouts.details_saved_pct >= 100 ? STATUS_ICON.good : STATUS_ICON.bad
              }
              leadingColor={statusColor(
                summary.workouts.details_saved_pct >= 100 ? "good" : "bad",
                colors,
              )}
              title="Details saved"
              value={formatPct(summary.workouts.details_saved_pct)}
              fraction={summary.workouts.details_saved_pct / 100}
              detail="Sessions whose exercise results (for PRs) and remembered sets saved, not just the session."
              colors={colors}
            />
          )}
        </Section>
      )}

      {(syncs > 0 || opens.length > 0) && (
        <Section
          title="Notifications"
          subtitle={
            notifications && syncs > 0
              ? `${plural(syncs, "sync")} · p95 ${formatMs(notifications.p95_ms)} · ${formatPct(notifications.error_pct)} failed${fewNote(syncs)}`
              : `Reminder scheduling and taps, ${windowPhrase}`
          }
          colors={colors}
        >
          {/* Reminders built vs actually scheduled, per sync: a gap means
              some never reach the phone's schedule. */}
          {notifications && syncs > 0 && (
            <>
              <BarRow
                first
                leadingIcon="bell-outline"
                leadingColor={colors.textSecondary}
                title="Reminders built, per sync"
                value={String(notifications.avg_built ?? "—")}
                fraction={(notifications.avg_built ?? 0) / Math.max(1, notifications.avg_built ?? 0)}
                colors={colors}
              />
              <BarRow
                first={false}
                leadingIcon="bell-ring-outline"
                leadingColor={colors.textSecondary}
                title="Scheduled on the phone"
                value={String(notifications.avg_scheduled ?? "—")}
                fraction={(notifications.avg_scheduled ?? 0) / Math.max(1, notifications.avg_built ?? 0)}
                colors={colors}
              />
            </>
          )}

          {/* The silent failure: toggles on, permission off, every sync
              "succeeds" and schedules nothing. Only shown when it happened. */}
          {notifications && (notifications.denied_pct ?? 0) > 0 && (
            <BarRow
              first={false}
              leadingIcon={STATUS_ICON.bad}
              leadingColor={colors.danger}
              title="Notifications blocked"
              value={formatPct(notifications.denied_pct)}
              fraction={(notifications.denied_pct ?? 0) / 100}
              detail="Share of syncs that built reminders but couldn't schedule any, because notifications are off for UpKeep on the device."
              colors={colors}
            />
          )}

          {opens.length > 0 && (
            <Text
              variant="labelLarge"
              style={[styles.subheading, { color: colors.textSecondary }]}
            >
              Reminders opened
            </Text>
          )}
          {opens.map((row, index) => (
            <BarRow
              key={row.kind}
              first={index === 0}
              title={REMINDER_KIND_LABELS[row.kind] ?? row.kind}
              value={formatCount(row.opens)}
              fraction={row.opens / mostOpens}
              colors={colors}
            />
          ))}
        </Section>
      )}

      <Section
        title="Recent errors"
        subtitle={
          summary.image_errors > 0
            ? `Plus ${plural(summary.image_errors, "image")} that failed to load`
            : "Latest failed requests and turns"
        }
        colors={colors}
      >
        {summary.recent_errors.length === 0 ? (
          <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
            None in the {windowPhrase}.
          </Text>
        ) : (
          summary.recent_errors.map((row, index) => (
            <View
              key={`${row.created_at}:${index}`}
              style={[
                styles.errorRow,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                },
              ]}
            >
              <View style={styles.rowHead}>
                <Text
                  variant="bodyMedium"
                  numberOfLines={1}
                  style={[styles.flexText, styles.mono, { color: colors.text }]}
                >
                  {row.detail ?? row.name}
                </Text>
                {row.status && row.status !== "0" ? (
                  <Text
                    variant="labelMedium"
                    style={[styles.tabular, { color: colors.textSecondary }]}
                  >
                    {row.status}
                  </Text>
                ) : null}
              </View>
              <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
                {row.name} · {format(new Date(row.created_at), "MMM d, h:mm a")}
              </Text>
            </View>
          ))
        )}
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function StatTile({
  label,
  value,
  detail,
  trend,
  colors,
}: {
  label: string;
  value: string;
  detail: string;
  // The same figure per hour or day, for a sparkline under it.
  trend?: (number | null)[];
  colors: ThemeColors;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}. ${detail}`}
      style={[
        styles.tile,
        { backgroundColor: colors.backgroundElement, borderColor: colors.border },
      ]}
    >
      <Text variant="labelMedium" style={{ color: colors.textSecondary }}>
        {label}
      </Text>
      {/* Proportional figures at display size: tabular digits look loose. */}
      <Text variant="headlineSmall" style={[styles.tileValue, { color: colors.text }]}>
        {value}
      </Text>
      {trend ? <Sparkline values={trend} color={markColor(colors)} /> : null}
      {/* Wraps rather than truncating: the "few samples" note is the part
          that matters most when it's there. */}
      <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
        {detail}
      </Text>
    </View>
  );
}

function Section({
  title,
  subtitle,
  footnote,
  colors,
  children,
}: {
  title: string;
  subtitle: string;
  footnote?: string;
  colors: ThemeColors;
  children: React.ReactNode;
}) {
  return (
    <Card
      mode="contained"
      style={[
        styles.card,
        { backgroundColor: colors.backgroundElement, borderColor: colors.border },
      ]}
    >
      <Card.Content style={{ gap: Spacing.two }}>
        <View>
          <Text variant="titleMedium" style={{ color: colors.text }}>
            {title}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
            {subtitle}
          </Text>
        </View>
        {children}
        {footnote ? (
          <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
            {footnote}
          </Text>
        ) : null}
      </Card.Content>
    </Card>
  );
}

/**
 * Label and value on one line, a full-width bar beneath, detail under that.
 * The bar gets the whole row width for resolution, and the value is always
 * printed, so the bar is never the only way to read it.
 */
function BarRow({
  title,
  value,
  fraction = 0,
  graphic,
  uncertain = false,
  detail,
  first,
  mono = false,
  leadingIcon,
  leadingColor,
  colors,
}: {
  title: string;
  value: string;
  fraction?: number;
  // Drawn in place of the bar (the endpoints' p50-to-p95 range).
  graphic?: React.ReactNode;
  // Rests on too few samples to trust: the bar is drawn faded.
  uncertain?: boolean;
  detail?: string;
  first: boolean;
  mono?: boolean;
  leadingIcon?: string;
  leadingColor?: string;
  colors: ThemeColors;
}) {
  const clamped = Math.min(1, Math.max(0, fraction));

  return (
    <View
      style={[
        styles.barRow,
        !first && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
      ]}
    >
      <View style={styles.rowHead}>
        {leadingIcon ? (
          <Icon source={leadingIcon} size={18} color={leadingColor} />
        ) : null}
        <Text
          variant="bodyMedium"
          numberOfLines={1}
          style={[styles.flexText, mono && styles.mono, { color: colors.text }]}
        >
          {title}
        </Text>
        {/* Values sit in a column down the card, so these do use tabular digits. */}
        <Text
          variant="labelLarge"
          style={[styles.tabular, { color: colors.text }]}
        >
          {value}
        </Text>
      </View>

      {graphic ?? (
        <View style={styles.barLane}>
          {clamped > 0 ? (
            <View
              style={[
                styles.bar,
                {
                  // Never thinner than 2px, so a real but tiny value is still
                  // visible rather than reading as zero.
                  width: `${clamped * 100}%`,
                  minWidth: 2,
                  backgroundColor: markColor(colors),
                  opacity: uncertain ? 0.4 : 1,
                },
              ]}
            />
          ) : null}
        </View>
      )}

      {detail ? (
        <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

function Notice({
  icon,
  title,
  body,
  colors,
  action,
}: {
  icon: string;
  title: string;
  body: string;
  colors: ThemeColors;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.notice}>
      <Icon source={icon} size={32} color={colors.textSecondary} />
      <Text variant="titleMedium" style={{ color: colors.text }}>
        {title}
      </Text>
      <Text
        variant="bodyMedium"
        style={{ color: colors.textSecondary, textAlign: "center" }}
      >
        {body}
      </Text>
      {action ? (
        <Button mode="contained-tonal" onPress={action.onPress}>
          {action.label}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    width: "100%",
    paddingHorizontal: Spacing.four,
    paddingTop: TopBadgeInset,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  tiles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  tile: {
    flexBasis: "47%",
    flexGrow: 1,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.half,
  },
  tileValue: {
    fontWeight: "600",
  },
  card: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
  },
  barRow: {
    paddingVertical: Spacing.two,
    gap: Spacing.one,
  },
  rowHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  flexText: {
    flex: 1,
    minWidth: 0,
  },
  mono: {
    fontFamily: "monospace",
    fontSize: 13,
  },
  tabular: {
    fontVariant: ["tabular-nums"],
  },
  // Thin mark: 8px, well under the 24px cap.
  barLane: {
    height: 8,
  },
  bar: {
    height: 8,
    // Rounded at the data end only, square at the baseline.
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  subheading: {
    marginTop: Spacing.two,
  },
  errorRow: {
    paddingVertical: Spacing.two,
    gap: Spacing.half,
  },
  notice: {
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.three,
  },
});
