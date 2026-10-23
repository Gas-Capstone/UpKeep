/**
 * PerformanceScreen — developer-only view of the app's performance metrics.
 *
 * Reads aggregates from get_performance_summary(), which only answers for
 * accounts listed in public.developers. The Settings entry is hidden for
 * everyone else, but the database is what actually enforces it.
 *
 * Every value is printed beside its bar, so the bars are a reading aid and
 * nothing depends on color alone. Agent outcomes carry their status with an
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

function formatMs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

function formatPct(pct: number | null): string {
  if (pct == null) return "—";
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

/** 1,284 · 12.9K · 3.4M */
function formatCount(n: number): string {
  if (n < 10_000) return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

function plural(n: number, word: string): string {
  return `${formatCount(n)} ${word}${n === 1 ? "" : "s"}`;
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

  if (requests.count === 0 && agent.turns === 0) {
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
  const longestPhase = Math.max(1, ...summary.agent_phases.map((p) => p.avg_ms ?? 0));

  return (
    <>
      <View style={styles.tiles}>
        <StatTile
          label="Request latency, p95"
          value={formatMs(requests.p95_ms)}
          detail={`p50 ${formatMs(requests.p50_ms)} · ${plural(requests.count, "request")}`}
          colors={colors}
        />
        <StatTile
          label="Request errors"
          value={formatPct(requests.error_pct)}
          detail={windowPhrase}
          colors={colors}
        />
        <StatTile
          label="Assistant success"
          value={formatPct(agent.ok_pct)}
          detail={plural(agent.turns, "turn")}
          colors={colors}
        />
        <StatTile
          label="Assistant latency, p95"
          value={formatMs(agent.p95_ms)}
          detail={`p50 ${formatMs(agent.p50_ms)}`}
          colors={colors}
        />
      </View>

      {summary.endpoints.length > 0 && (
        <Section
          title="Slowest endpoints"
          subtitle={`95th-percentile latency, ${windowPhrase}`}
          colors={colors}
        >
          {summary.endpoints.map((endpoint, index) => (
            <BarRow
              key={`${endpoint.method} ${endpoint.path}`}
              first={index === 0}
              title={`${endpoint.method} ${endpoint.path}`}
              mono
              value={formatMs(endpoint.p95_ms)}
              fraction={(endpoint.p95_ms ?? 0) / slowest}
              detail={`${plural(endpoint.requests, "request")} · p50 ${formatMs(endpoint.p50_ms)} · ${formatPct(endpoint.error_pct)} errors`}
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
              detail={`p95 ${formatMs(phase.p95_ms)} · ${plural(phase.turns, "turn")}`}
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
  colors,
}: {
  label: string;
  value: string;
  detail: string;
  colors: ThemeColors;
}) {
  return (
    <View
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
      <Text
        variant="bodySmall"
        numberOfLines={1}
        style={{ color: colors.textSecondary }}
      >
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
  fraction,
  detail,
  first,
  mono = false,
  leadingIcon,
  leadingColor,
  colors,
}: {
  title: string;
  value: string;
  fraction: number;
  detail: string;
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
                backgroundColor: colors.brand,
              },
            ]}
          />
        ) : null}
      </View>

      <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
        {detail}
      </Text>
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
