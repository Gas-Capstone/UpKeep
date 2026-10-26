import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Card, List, Modal, Text, useTheme } from "react-native-paper";
import { format, isThisYear, isToday, isYesterday, parse } from "date-fns";

import { styles as shared } from "@/constants/styles";
import { Radius, Spacing } from "@/constants/theme";
import {
  formatDuration,
  getMostDonePlan,
  getTotalMinutes,
  getWorkoutStreak,
  getWorkoutsThisWeek,
} from "@/lib/workoutList";
import type { CompletedWorkout } from "../context/workoutsDataContext";

type CompletedWorkoutsModalProps = {
  visible: boolean;
  onDismiss: () => void;
  workouts: CompletedWorkout[];
};

/** "Today", "Yesterday", "Mon, Oct 20" — the year only once it isn't this one. */
function formatDay(key: string): string {
  const date = parse(key, "yyyy-MM-dd", new Date());
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, isThisYear(date) ? "EEE, MMM d" : "EEE, MMM d, yyyy");
}

/**
 * Workout history: a summary up top, then every session grouped by day.
 *
 * The summary reuses the home tab's streak and this-week figures, so the two
 * screens can never disagree.
 */
export function CompletedWorkoutsModal({
  visible,
  onDismiss,
  workouts,
}: CompletedWorkoutsModalProps) {
  const theme = useTheme();
  const { height } = useWindowDimensions();

  const workoutsByDate = workouts.reduce<Record<string, CompletedWorkout[]>>(
    (acc, workout) => {
      const date = format(new Date(workout.completed_at), "yyyy-MM-dd");
      (acc[date] ??= []).push(workout);
      return acc;
    },
    {},
  );
  const dates = Object.keys(workoutsByDate).sort().reverse(); // newest first

  const streak = getWorkoutStreak(workouts);
  const thisWeek = getWorkoutsThisWeek(workouts);
  const totalMinutes = getTotalMinutes(workouts);
  const mostDone = getMostDonePlan(workouts);

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      contentContainerStyle={shared.modalContent}
    >
      <Card mode="contained" style={shared.modalCard}>
        <Card.Title title={<Text variant="titleLarge">Completed Workouts</Text>} />

        <Card.Content style={{ gap: Spacing.three }}>
          {workouts.length === 0 ? (
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Nothing here yet. Finish a workout and it will show up here.
            </Text>
          ) : (
            <>
              <View style={styles.tiles}>
                <StatTile label="Day streak" value={String(streak)} />
                <StatTile label="This week" value={String(thisWeek)} />
                <StatTile label="Total time" value={formatDuration(totalMinutes)} />
                <StatTile
                  label="Most done"
                  value={mostDone?.name ?? "—"}
                  detail={
                    mostDone
                      ? `${mostDone.count} time${mostDone.count === 1 ? "" : "s"}`
                      : undefined
                  }
                />
              </View>

              {/* Capped and scrollable: the card has no height limit of its
                  own, so a long history would otherwise run off the screen
                  with no way to reach the bottom. */}
              <ScrollView style={{ maxHeight: height * 0.45 }}>
                <List.AccordionGroup>
                  {dates.map((date) => {
                    const sessions = workoutsByDate[date];
                    return (
                      <List.Accordion
                        key={date}
                        id={date}
                        title={formatDay(date)}
                        description={`${sessions.length} workout${
                          sessions.length === 1 ? "" : "s"
                        }`}
                        style={{ backgroundColor: theme.colors.surfaceVariant }}
                      >
                        {sessions.map((workout) => (
                          <List.Item
                            key={workout.id}
                            title={workout.name}
                            description={`${workout.duration_min} min`}
                          />
                        ))}
                      </List.Accordion>
                    );
                  })}
                </List.AccordionGroup>
              </ScrollView>
            </>
          )}
        </Card.Content>
      </Card>
    </Modal>
  );
}

function StatTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.tile, { backgroundColor: theme.colors.surfaceVariant }]}>
      <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {label}
      </Text>
      <Text
        variant="titleLarge"
        numberOfLines={1}
        style={[styles.tileValue, { color: theme.colors.onSurface }]}
      >
        {value}
      </Text>
      {detail ? (
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  // Two to a row at phone width.
  tile: {
    flexBasis: "47%",
    flexGrow: 1,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    gap: Spacing.half,
  },
  tileValue: {
    fontWeight: "600",
  },
});
