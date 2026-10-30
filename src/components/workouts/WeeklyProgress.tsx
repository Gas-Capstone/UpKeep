import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { format } from "date-fns";

import { useThemeMode } from "@/components/context/ThemeContext";
import type { CompletedWorkout } from "@/components/context/workoutsDataContext";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { workoutsPerWeek } from "@/lib/workoutList";

const WEEKS = 8;
const CHART_HEIGHT = 56;

const plural = (count: number) => `${count} workout${count === 1 ? "" : "s"}`;

/**
 * Workouts per week for the last 8 weeks, from the user's history. Tap a
 * week to read its count; it starts on this week. Deleting a session from
 * History takes it out of here too.
 */
export function WeeklyProgress({ completedWorkouts }: { completedWorkouts: CompletedWorkout[] }) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];
  const weeks = workoutsPerWeek(completedWorkouts, WEEKS);
  const [selected, setSelected] = useState(WEEKS - 1);

  const max = Math.max(1, ...weeks.map((week) => week.count));
  const total = weeks.reduce((sum, week) => sum + week.count, 0);
  const average = Math.round((total / WEEKS) * 10) / 10;
  const isThisWeek = (index: number) => index === WEEKS - 1;
  const weekName = (index: number) =>
    isThisWeek(index) ? "This week" : `Week of ${format(weeks[index].weekStart, "MMM d")}`;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.backgroundElement, borderColor: colors.border },
      ]}
    >
      {/* One full-width line rather than two texts side by side: squeezed
          to exactly their measured width, Android can drop a last word. */}
      <Text variant="titleSmall" style={{ color: colors.text, fontWeight: "700" }}>
        Workouts per week
        <Text variant="labelMedium" style={{ color: colors.textSecondary, fontWeight: "400" }}>
          {total === 0 ? "  ·  none in the last 8 weeks" : `  ·  avg ${average} a week`}
        </Text>
      </Text>

      <Text
        variant="bodyMedium"
        accessibilityLiveRegion="polite"
        style={{ color: colors.text }}
      >
        {weekName(selected)} · {plural(weeks[selected].count)}
      </Text>

      <View style={styles.chart}>
        {weeks.map((week, index) => {
          const isSelected = index === selected;
          const barHeight = week.count === 0 ? 2 : Math.max(6, (week.count / max) * CHART_HEIGHT);
          return (
            <Pressable
              key={week.weekStart.toISOString()}
              onPress={() => setSelected(index)}
              accessibilityRole="button"
              accessibilityLabel={`${weekName(index)}: ${plural(week.count)}`}
              accessibilityState={{ selected: isSelected }}
              style={styles.column}
            >
              {/* The count is written over the selected week only, so the
                  chart doesn't turn into a row of numbers. */}
              <Text
                variant="labelSmall"
                style={[styles.count, { color: colors.text, opacity: isSelected ? 1 : 0 }]}
              >
                {week.count}
              </Text>
              <View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    backgroundColor: week.count === 0 ? colors.border : colors.brand,
                    opacity: isSelected || week.count === 0 ? 1 : 0.45,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      {/* Each label gets half the row, not just its own width, for the same
          reason. */}
      <View style={styles.axis}>
        <Text variant="labelSmall" style={[styles.axisLabel, { color: colors.textSecondary }]}>
          {format(weeks[0].weekStart, "MMM d")}
        </Text>
        <Text
          variant="labelSmall"
          style={[styles.axisLabel, { color: colors.textSecondary, textAlign: "right" }]}
        >
          This week
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.large,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    // Room for the count over the tallest bar.
    height: CHART_HEIGHT + 18,
  },
  // Each week's tap target is its whole column, wider and taller than the bar.
  column: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 3,
  },
  count: {
    marginBottom: 2,
  },
  bar: {
    width: "70%",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  axis: {
    flexDirection: "row",
  },
  axisLabel: {
    flex: 1,
  },
});
