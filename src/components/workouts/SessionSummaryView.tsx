import { StyleSheet, View } from "react-native";
import { Icon, ProgressBar, Text, useTheme } from "react-native-paper";

import { useWeightUnit } from "@/components/context/UnitsContext";
import { Radius, Spacing } from "@/constants/theme";
import { describeNewRecord, type SessionSummary } from "@/lib/sessionSummary";
import { displayWeight, formatThousands } from "@/lib/units";
import { formatDuration } from "@/lib/workoutList";
import { StatGrid, StatTile } from "./StatTile";

type SessionSummaryViewProps = {
  summary: SessionSummary;
  // "finished" right after a session; "history" when reopened later, which
  // changes a little of the wording.
  context: "finished" | "history";
};

/**
 * The body of a session summary: bars for what has a whole to fill, figures
 * for what doesn't, then any new personal records. Shared by the summary
 * shown after finishing and the one History reopens.
 */
export function SessionSummaryView({ summary, context }: SessionSummaryViewProps) {
  const theme = useTheme();
  const { weightUnit } = useWeightUnit();
  const { newRecords, firstRecords, plannedMin, sets, exercises } = summary;
  const overPlan = plannedMin === null ? 0 : summary.minutes - plannedMin;

  return (
    <View style={styles.body}>
      {/* Bars for what has a whole to fill: the time planned, the sets and
          the exercises in the plan. */}
      {plannedMin !== null || (exercises !== null && exercises.total > 0) ? (
        <View style={styles.bars}>
          {plannedMin !== null && (
            <ProgressRow
              label="Time"
              value={`${formatDuration(summary.minutes)} of ${formatDuration(plannedMin)}${
                overPlan > 0 ? ` · ${formatDuration(overPlan)} over` : ""
              }`}
              spoken={`${summary.minutes} of ${plannedMin} planned minutes`}
              done={summary.minutes}
              total={plannedMin}
            />
          )}
          {sets !== null && exercises !== null && exercises.total > 0 && (
            <>
              <ProgressRow
                label="Sets"
                value={`${sets.done} of ${sets.total}`}
                spoken={`${sets.done} of ${sets.total} sets`}
                done={sets.done}
                total={sets.total}
              />
              <ProgressRow
                label="Exercises"
                value={`${exercises.done} of ${exercises.total}`}
                spoken={`${exercises.done} of ${exercises.total} exercises`}
                done={exercises.done}
                total={exercises.total}
              />
            </>
          )}
        </View>
      ) : null}

      {/* No whole to fill for these, so they stay as figures rather than
          bars against a made-up target. */}
      <StatGrid>
        {plannedMin === null && (
          <StatTile label="Time" value={formatDuration(summary.minutes)} />
        )}
        {summary.volumeKg > 0 && (
          <StatTile
            label="Weight lifted"
            value={`${formatThousands(displayWeight(summary.volumeKg, weightUnit))} ${weightUnit}`}
          />
        )}
        {summary.streak !== null && (
          <StatTile
            label="Day streak"
            value={String(summary.streak.days)}
            detail={`${summary.streak.thisWeek} this week`}
          />
        )}
      </StatGrid>

      {sets === null && (
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          Sets and exercises weren&apos;t recorded for workouts saved before this
          update.
        </Text>
      )}

      {newRecords.length > 0 && (
        <View style={styles.section}>
          <View style={styles.heading}>
            <Icon source="trophy" size={20} color={theme.colors.primary} />
            <Text variant="titleMedium" accessibilityRole="header">
              {newRecords.length === 1
                ? "New personal record"
                : `${newRecords.length} new personal records`}
            </Text>
          </View>

          {newRecords.map((record) => {
            const { result, previous, spoken } = describeNewRecord(record, weightUnit);
            return (
              <View
                key={record.workoutId}
                accessible
                accessibilityLabel={spoken}
                style={styles.record}
              >
                <Text variant="bodyMedium" style={styles.recordName}>
                  {record.name}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {result} · beat {previous}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {firstRecords > 0 && (
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {context === "finished"
            ? firstRecords === 1
              ? "You set a first record on 1 exercise. Beat it next time."
              : `You set first records on ${firstRecords} exercises. Beat them next time.`
            : firstRecords === 1
              ? "First record set on 1 exercise."
              : `First records set on ${firstRecords} exercises.`}
        </Text>
      )}
    </View>
  );
}

/**
 * One labelled bar: the label and "16 of 18" on a line, the bar under it.
 * The numbers are always written out, so the bar is never the only way to
 * read the value. Full at 100%, even when the total was passed.
 */
function ProgressRow({
  label,
  value,
  spoken,
  done,
  total,
}: {
  label: string;
  value: string;
  spoken: string;
  done: number;
  total: number;
}) {
  const theme = useTheme();
  const progress = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100), text: spoken }}
      style={styles.row}
    >
      <View style={styles.rowLabels}>
        <Text variant="labelLarge" style={{ color: theme.colors.onSurface }}>
          {label}
        </Text>
        {/* Takes the rest of the row so a long value ("32 min of 45 min ·
            7 min over") has room instead of losing its last word. */}
        <Text
          variant="labelLarge"
          style={{ color: theme.colors.onSurfaceVariant, flex: 1, textAlign: "right" }}
        >
          {value}
        </Text>
      </View>
      <ProgressBar progress={progress} color={theme.colors.primary} style={styles.bar} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.three,
  },
  bars: {
    gap: Spacing.three,
  },
  row: {
    gap: Spacing.one,
  },
  rowLabels: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    columnGap: Spacing.two,
  },
  bar: {
    height: 8,
    borderRadius: Radius.pill,
  },
  section: {
    gap: Spacing.two,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  record: {
    gap: Spacing.half,
  },
  recordName: {
    fontWeight: "600",
  },
});
