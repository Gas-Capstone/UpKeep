import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import {
  ActivityIndicator,
  Button,
  Card,
  IconButton,
  List,
  Modal,
  Text,
  Portal,
  useTheme,
} from "react-native-paper";
import { format, isThisYear, isToday, isYesterday, parse } from "date-fns";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { styles as shared } from "@/constants/styles";
import { Spacing } from "@/constants/theme";
import { useWeightUnit } from "@/components/context/UnitsContext";
import {
  describeSessionExercise,
  type SessionExercise,
  type SessionSummary,
} from "@/lib/sessionSummary";
import {
  describeSession,
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
  const insets = useSafeAreaInsets();
  const { loadSessionSummary, loadSessionExercises, deleteSession } = useWorkoutsData();
  const { weightUnit } = useWeightUnit();

  // The session row open in the list, and each opened session's exercises,
  // kept so reopening one doesn't load it again.
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [exercisesBySession, setExercisesBySession] = useState<
    Record<string, SessionExercise[] | "loading" | "error">
  >({});

  const loadExercises = (session: CompletedWorkout) => {
    setExercisesBySession((prev) => ({ ...prev, [session.id]: "loading" }));
    loadSessionExercises(session)
      .then((list) => setExercisesBySession((prev) => ({ ...prev, [session.id]: list })))
      .catch(() => setExercisesBySession((prev) => ({ ...prev, [session.id]: "error" })));
  };

  const toggleSession = (session: CompletedWorkout) => {
    if (expandedSession === session.id) {
      setExpandedSession(null);
      return;
    }
    setExpandedSession(session.id);
    const loaded = exercisesBySession[session.id];
    if (loaded === undefined || loaded === "error") loadExercises(session);
  };

  // Deeper than the session row it opens under.
  const exerciseIndent = { paddingLeft: Spacing.five + Spacing.four };

  const renderExercises = (session: CompletedWorkout) => {
    const state = exercisesBySession[session.id];
    const summaryRow = (
      <List.Item
        title="View full summary"
        onPress={() => showSession(session)}
        accessibilityHint="Opens this workout's summary"
        left={(props) => <List.Icon {...props} icon="chart-box-outline" />}
        right={(props) => <List.Icon {...props} icon="chevron-right" />}
        style={exerciseIndent}
      />
    );

    if (state === undefined || state === "loading") {
      return (
        <List.Item
          title="Loading exercises…"
          left={() => <ActivityIndicator size="small" style={{ marginLeft: Spacing.two }} />}
          style={exerciseIndent}
        />
      );
    }
    if (state === "error") {
      return (
        <List.Item
          title="Couldn't load the exercises"
          description="Tap to try again"
          titleStyle={{ color: theme.colors.error }}
          onPress={() => loadExercises(session)}
          left={(props) => <List.Icon {...props} icon="refresh" color={theme.colors.error} />}
          style={exerciseIndent}
        />
      );
    }

    return (
      <>
        {state.length === 0 ? (
          <List.Item title="No exercises recorded" style={exerciseIndent} />
        ) : (
          state.map((exercise) => {
            const finished =
              exercise.setsTotal !== null && exercise.setsDone >= exercise.setsTotal;
            return (
              <List.Item
                key={exercise.workoutId}
                title={exercise.name}
                titleNumberOfLines={2}
                description={describeSessionExercise(exercise, weightUnit)}
                left={(props) => (
                  <List.Icon
                    {...props}
                    icon={
                      finished
                        ? "check-circle"
                        : exercise.setsDone > 0
                          ? "progress-check"
                          : "circle-outline"
                    }
                    color={
                      exercise.setsDone > 0
                        ? theme.colors.primary
                        : theme.colors.onSurfaceVariant
                    }
                  />
                )}
                style={exerciseIndent}
              />
            );
          })
        )}
        {summaryRow}
      </>
    );
  };

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
    <Portal>
      <Modal
        visible={visible}
        onDismiss={close}
        style={{
          marginTop: insets.top + Spacing.three,
          marginBottom: insets.bottom + Spacing.three,
        }}
        contentContainerStyle={[shared.modalContent, fit.fill]}
      >
        {openSession ? (
          <Card mode="contained" style={[shared.modalCard, fit.fill]}>
            <Card.Title
              title={
                <Text variant="titleLarge" accessibilityRole="header">
                  {openSession.name}
                </Text>
              }
              subtitle={[openSession.workout_type, formatSessionTime(openSession.completed_at)]
                .filter((part): part is string => part !== null)
                .join(" · ")}
              subtitleNumberOfLines={2}
              left={() => (
                <IconButton
                  icon="arrow-left"
                  onPress={() => setOpenSession(null)}
                  accessibilityLabel="Back to history"
                  style={{ margin: 0 }}
                />
              )}
            />
  
            <Card.Content style={fit.shrink}>
              <ScrollView style={fit.shrink}>
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
          <Card mode="contained" style={[shared.modalCard, fit.fill]}>
            <Card.Title title={<Text variant="titleLarge">Completed Workouts</Text>} />
        
            <Card.Content style={[fit.shrink, { gap: Spacing.two }]}>
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
                    <StatTile compact label="Day streak" value={String(streak)} />
                    <StatTile compact label="This week" value={String(thisWeek)} />
                    <StatTile compact label="Total time" value={formatDuration(totalMinutes)} />
                    <StatTile
                      compact
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
                  <ScrollView style={fit.shrink}>
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
                            {/* A group of its own, so one session opens at a time
                                and opening one loads its exercises. */}
                            <List.AccordionGroup
                              expandedId={expandedSession ?? undefined}
                              onAccordionPress={(id) => {
                                const workout = sessions.find((s) => s.id === id);
                                if (workout) toggleSession(workout);
                              }}
                            >
                              {sessions.map((workout) => (
                                <List.Accordion
                                  key={workout.id}
                                  id={workout.id}
                                  title={workout.name}
                                  description={describeSession(workout)}
                                  descriptionNumberOfLines={2}
                                  // Indented under its day, so sessions read as
                                  // inside the heading rather than beside it.
                                  style={{ 
                                    paddingLeft: Spacing.five, 
                                    backgroundColor: theme.colors.surface}}
                                >
                                  {renderExercises(workout)}
                                </List.Accordion>
                              ))}
                            </List.AccordionGroup>
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
    </Portal>
  );
}

// Lets the panel fit the space it has: the card is never taller than the
// modal area, and the scrolling list gives up height first.
const fit = StyleSheet.create({
  fill: { maxHeight: "100%" },
  shrink: { flexShrink: 1 },
});
