import { useState } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  IconButton,
  List,
  Modal,
  Text,
  useTheme,
} from "react-native-paper";
import { format, isThisYear, isToday, isYesterday, parse } from "date-fns";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { styles as shared } from "@/constants/styles";
import { Spacing } from "@/constants/theme";
import type { SessionSummary } from "@/lib/sessionSummary";
import {
  formatDuration,
  getMostDonePlan,
  getTotalMinutes,
  getWorkoutStreak,
  getWorkoutsThisWeek,
} from "@/lib/workoutList";
import {
  useWorkoutsData,
  type CompletedWorkout,
} from "../context/workoutsDataContext";
import { SessionSummaryView } from "./SessionSummaryView";
import { StatGrid, StatTile } from "./StatTile";

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

/** "Mon, Oct 20 · 6:42 PM", for the top of one session's summary. */
function formatSessionTime(completedAt: string): string {
  const date = new Date(completedAt);
  return format(date, isThisYear(date) ? "EEE, MMM d · h:mm a" : "EEE, MMM d, yyyy · h:mm a");
}

/**
 * Workout history: a summary up top, then every session grouped by day. A
 * session opens its own summary, where it can also be deleted.
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
  const { loadSessionSummary, deleteSession } = useWorkoutsData();

  // The session opened from the list, and its summary once it has loaded.
  // Keyed by id, so a slow load for one can't show up under another.
  const [openSession, setOpenSession] = useState<CompletedWorkout | null>(null);
  const [loaded, setLoaded] = useState<{ id: string; summary: SessionSummary } | null>(null);
  const [loadError, setLoadError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const summary = openSession && loaded?.id === openSession.id ? loaded.summary : null;

  const showSession = (session: CompletedWorkout) => {
    setOpenSession(session);
    setLoadError("");
    loadSessionSummary(session)
      .then((next) => setLoaded({ id: session.id, summary: next }))
      .catch(() => setLoadError("Couldn't load this workout's details. Please try again."));
  };

  const close = () => {
    setOpenSession(null);
    onDismiss();
  };

  const confirmDelete = async () => {
    if (!openSession) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteSession(openSession.id);
      setConfirmingDelete(false);
      setOpenSession(null);
    } catch {
      setDeleteError("Couldn't delete that workout. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

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
    <Modal visible={visible} onDismiss={close} contentContainerStyle={shared.modalContent}>
      {openSession ? (
        <Card mode="contained" style={shared.modalCard}>
          <Card.Title
            title={
              <Text variant="titleLarge" accessibilityRole="header">
                {openSession.name}
              </Text>
            }
            subtitle={formatSessionTime(openSession.completed_at)}
            left={() => (
              <IconButton
                icon="arrow-left"
                onPress={() => setOpenSession(null)}
                accessibilityLabel="Back to history"
                style={{ margin: 0 }}
              />
            )}
          />

          <Card.Content>
            <ScrollView style={{ maxHeight: height * 0.55 }}>
              {summary ? (
                <SessionSummaryView summary={summary} context="history" />
              ) : loadError ? (
                <View style={{ gap: Spacing.two, alignItems: "flex-start" }}>
                  <Text variant="bodyMedium" style={{ color: theme.colors.error }}>
                    {loadError}
                  </Text>
                  <Button mode="outlined" onPress={() => showSession(openSession)}>
                    Try again
                  </Button>
                </View>
              ) : (
                <ActivityIndicator
                  style={{ paddingVertical: Spacing.four }}
                  accessibilityLabel="Loading workout details"
                />
              )}
            </ScrollView>
          </Card.Content>

          <Card.Actions>
            <Button
              icon="delete-outline"
              textColor={theme.colors.error}
              onPress={() => {
                setDeleteError("");
                setConfirmingDelete(true);
              }}
            >
              Delete
            </Button>
            <Button mode="contained" onPress={() => setOpenSession(null)}>
              Back
            </Button>
          </Card.Actions>

          <ConfirmDialog
            visible={confirmingDelete}
            title="Delete this workout?"
            message={`${openSession.name} on ${formatSessionTime(openSession.completed_at)} will be removed from your history, streaks and progress, along with its sets and records. This can't be undone.`}
            confirmLabel="Delete"
            loading={deleting}
            error={deleteError}
            onDismiss={() => setConfirmingDelete(false)}
            onConfirm={confirmDelete}
          />
        </Card>
      ) : (
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
                <StatGrid>
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
                </StatGrid>

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
                              onPress={() => showSession(workout)}
                              accessibilityHint="Opens this workout's summary"
                              right={(props) => <List.Icon {...props} icon="chevron-right" />}
                              // Indented under its day, so sessions read as
                              // inside the heading rather than beside it.
                              style={{ paddingLeft: Spacing.five }}
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
      )}
    </Modal>
  );
}
