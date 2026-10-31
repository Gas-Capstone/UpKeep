/**
 * Charts for the Performance screen, drawn with plain views and SVG.
 *
 * Each plots a single series in the brand color, with its values printed
 * beside it, so nothing depends on telling colors apart. Tapping a bar reads
 * it out in the caption above; screen readers get each bar as a button with
 * its value.
 */

import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Chip, Text } from "react-native-paper";
import Svg, { Circle, Polyline } from "react-native-svg";
import { format, parseISO } from "date-fns";

import { Colors, Spacing } from "@/constants/theme";
import type { TimelineBucket } from "@/lib/performance";
import { formatCount, formatMs, formatPct, plural } from "./format";

type ThemeColors = (typeof Colors)["light"] | (typeof Colors)["dark"];

/**
 * The color for chart marks: the brand teal in both themes. The dark theme's
 * own brand color (aqua) is too light for marks on its dark cards — checked
 * with the dataviz palette validator: aqua falls outside the dark lightness
 * band, teal passes it and 3:1 contrast in both themes.
 */
export function markColor(colors: ThemeColors): string {
  return colors === Colors.dark ? colors.brandStrong : colors.brand;
}

// ---------------------------------------------------------------------------
// Sparkline
// ---------------------------------------------------------------------------

/**
 * A small trend line under a headline figure. Starts at zero, so a small
 * change doesn't look like a cliff; empty periods break the line instead of
 * being drawn as zero. Decorative: the figure beside it is what's read out.
 */
export function Sparkline({
  values,
  color,
  height = 28,
}: {
  values: (number | null)[];
  color: string;
  height?: number;
}) {
  const [width, setWidth] = useState(0);
  const max = Math.max(0, ...values.map((value) => value ?? 0));
  const known = values.filter((value) => value !== null).length;

  // Nothing worth a line: no data, or a single point.
  if (known < 2 || max === 0) return null;

  const pad = 3;
  const x = (index: number) =>
    pad + (values.length === 1 ? 0 : (index / (values.length - 1)) * (width - pad * 2));
  const y = (value: number) => pad + (1 - value / max) * (height - pad * 2);

  // Runs of consecutive known values, each drawn as its own line.
  const runs: string[] = [];
  let run: string[] = [];
  values.forEach((value, index) => {
    if (value === null) {
      if (run.length > 1) runs.push(run.join(" "));
      run = [];
    } else {
      run.push(`${x(index)},${y(value)}`);
    }
  });
  if (run.length > 1) runs.push(run.join(" "));

  const lastIndex = values.map((value) => value !== null).lastIndexOf(true);
  const lastValue = values[lastIndex];

  return (
    <View
      style={{ height }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {width > 0 && (
        <Svg width={width} height={height}>
          {runs.map((points) => (
            <Polyline
              key={points}
              points={points}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {lastValue != null && (
            <Circle cx={x(lastIndex)} cy={y(lastValue)} r={3} fill={color} />
          )}
        </Svg>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Trend chart
// ---------------------------------------------------------------------------

export type TrendMetric = "requests" | "latency" | "errors" | "assistant" | "workouts";

type MetricSpec = {
  chip: string;
  value: (bucket: TimelineBucket) => number | null;
  format: (value: number) => string;
  // How many samples a value rests on, for metrics where few is noisy.
  samples?: (bucket: TimelineBucket) => number;
  sampleWord?: string;
  // The caption for one bucket, after its date.
  describe: (bucket: TimelineBucket) => string;
  empty: string;
};

const METRICS: Record<TrendMetric, MetricSpec> = {
  requests: {
    chip: "Requests",
    value: (b) => b.requests,
    format: formatCount,
    describe: (b) => plural(b.requests, "request"),
    empty: "No requests",
  },
  latency: {
    chip: "Latency p95",
    value: (b) => b.request_p95_ms,
    format: formatMs,
    samples: (b) => b.requests,
    sampleWord: "request",
    describe: (b) => `p95 ${formatMs(b.request_p95_ms)} over ${plural(b.requests, "request")}`,
    empty: "No requests",
  },
  errors: {
    chip: "Errors",
    value: (b) => b.request_error_pct,
    format: (v) => formatPct(v),
    samples: (b) => b.requests,
    sampleWord: "request",
    describe: (b) => `${formatPct(b.request_error_pct)} of ${plural(b.requests, "request")} failed`,
    empty: "No requests",
  },
  assistant: {
    chip: "Assistant success",
    value: (b) => b.agent_ok_pct,
    format: (v) => formatPct(v),
    samples: (b) => b.agent_turns,
    sampleWord: "turn",
    describe: (b) => `${formatPct(b.agent_ok_pct)} of ${plural(b.agent_turns, "turn")} succeeded`,
    empty: "No assistant turns",
  },
  workouts: {
    chip: "Workouts",
    value: (b) => b.workouts,
    format: formatCount,
    describe: (b) => `${plural(b.workouts, "workout")} finished`,
    empty: "No workouts finished",
  },
};

// Per bucket, fewer than this and a p95 or a share is mostly noise.
const ROUGH_BUCKET = 5;
const CHART_HEIGHT = 120;

/**
 * The window broken into hours or days, one metric at a time. Bars rather
 * than a line so each period can be tapped, and so a quiet period reads as a
 * gap, not as a line diving to zero.
 */
export function TrendChart({
  unit,
  buckets,
  colors,
}: {
  unit: "hour" | "day";
  buckets: TimelineBucket[];
  colors: ThemeColors;
}) {
  const [metric, setMetric] = useState<TrendMetric>("requests");
  const [picked, setPicked] = useState<number | null>(null);
  const spec = METRICS[metric];
  const selected = picked ?? buckets.length - 1;

  const values = buckets.map(spec.value);
  const max = Math.max(0, ...values.map((value) => value ?? 0));
  // Percentages are shares of a whole: scaled to 100, not to the busiest bar.
  const scale = metric === "errors" || metric === "assistant" ? 100 : max;

  const label = (index: number) => {
    const start = parseISO(buckets[index].start);
    if (index === buckets.length - 1) return unit === "hour" ? "This hour" : "Today";
    return unit === "hour" ? format(start, "h a") : format(start, "MMM d");
  };
  const fullName = (index: number) => {
    const start = parseISO(buckets[index].start);
    return unit === "hour" ? format(start, "EEE h a") : format(start, "EEE, MMM d");
  };
  const isRough = (bucket: TimelineBucket) =>
    spec.samples !== undefined && spec.samples(bucket) > 0 && spec.samples(bucket) < ROUGH_BUCKET;
  const caption = (index: number) => {
    const bucket = buckets[index];
    if (spec.value(bucket) === null) return `${fullName(index)} · ${spec.empty.toLowerCase()}`;
    const rough = isRough(bucket) ? " · too few to be sure" : "";
    return `${fullName(index)} · ${spec.describe(bucket)}${rough}`;
  };

  return (
    <View style={styles.trend}>
      {/* One row of choices, above the chart it controls. */}
      <View style={styles.chips}>
        {(Object.keys(METRICS) as TrendMetric[]).map((key) => (
          <Chip
            key={key}
            compact
            selected={metric === key}
            showSelectedCheck={false}
            onPress={() => setMetric(key)}
            accessibilityState={{ selected: metric === key }}
          >
            {METRICS[key].chip}
          </Chip>
        ))}
      </View>

      <Text
        variant="bodyMedium"
        accessibilityLiveRegion="polite"
        style={{ color: colors.text }}
      >
        {caption(selected)}
      </Text>

      <View>
        {/* The scale's top, labelled above its gridline rather than over the
            bars. */}
        <Text variant="labelSmall" style={{ color: colors.textSecondary }}>
          {scale > 0 ? spec.format(scale) : " "}
        </Text>

        <View style={[styles.plot, { borderColor: colors.border }]}>
          {buckets.map((bucket, index) => {
            const value = values[index];
            const isSelected = index === selected;
            const height =
              value === null || scale === 0 ? 0 : Math.max(2, (value / scale) * CHART_HEIGHT);
            return (
              <Pressable
                key={bucket.start}
                onPress={() => setPicked(index)}
                accessibilityRole="button"
                accessibilityLabel={caption(index)}
                accessibilityState={{ selected: isSelected }}
                style={styles.column}
              >
                {height > 0 && (
                  <View
                    style={[
                      styles.bar,
                      {
                        height,
                        backgroundColor: markColor(colors),
                        // Faded when it rests on too few samples to trust,
                        // and dimmed when another bar is the one being read.
                        opacity: isRough(bucket) ? 0.35 : isSelected ? 1 : 0.6,
                      },
                    ]}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Each label gets half the row, so neither loses a word on Android. */}
      <View style={styles.axis}>
        <Text variant="labelSmall" style={[styles.axisLabel, { color: colors.textSecondary }]}>
          {label(0)}
        </Text>
        <Text
          variant="labelSmall"
          style={[styles.axisLabel, { color: colors.textSecondary, textAlign: "right" }]}
        >
          {label(buckets.length - 1)}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Range row
// ---------------------------------------------------------------------------

/**
 * How spread out one endpoint's timings are: a line from its p50 (hollow
 * dot) to its p95 (filled dot), on a scale shared by every row. A long line
 * means usually fast but sometimes slow.
 */
export function RangeBar({
  p50,
  p95,
  scale,
  faded,
  colors,
}: {
  p50: number | null;
  p95: number | null;
  scale: number;
  faded: boolean;
  colors: ThemeColors;
}) {
  const [width, setWidth] = useState(0);
  const height = 14;
  const r = 4;
  const at = (ms: number) => r + (Math.min(ms, scale) / scale) * (width - r * 2);

  return (
    <View
      style={{ height, opacity: faded ? 0.4 : 1 }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {width > 0 && p95 != null && scale > 0 && (
        <Svg width={width} height={height}>
          {p50 != null && p50 < p95 && (
            <Polyline
              points={`${at(p50)},${height / 2} ${at(p95)},${height / 2}`}
              stroke={markColor(colors)}
              strokeWidth={3}
              strokeLinecap="round"
            />
          )}
          {p50 != null && (
            <Circle
              cx={at(p50)}
              cy={height / 2}
              r={r - 1}
              fill={colors.backgroundElement}
              stroke={markColor(colors)}
              strokeWidth={2}
            />
          )}
          <Circle cx={at(p95)} cy={height / 2} r={r} fill={markColor(colors)} />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  trend: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.one,
  },
  // Recessive gridlines: the scale's top and the baseline.
  plot: {
    height: CHART_HEIGHT,
    flexDirection: "row",
    alignItems: "flex-end",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // The whole column is the tap target, wider and taller than its bar.
  column: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
    paddingHorizontal: 1,
  },
  // Rounded at the data end only, square on the baseline.
  bar: {
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  axis: {
    flexDirection: "row",
  },
  axisLabel: {
    flex: 1,
  },
});
