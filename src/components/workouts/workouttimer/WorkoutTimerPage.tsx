import { useEffect, useState } from "react";
import { AppState, Keyboard, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Button, IconButton, ProgressBar, Snackbar, Text, useTheme } from "react-native-paper";

import { useWorkoutSessionContext } from "@/components/context/workoutSessionContext";
import { ScreenView } from "@/components/ui/ScreenView";
import { Spacing, Radius } from "@/constants/theme";
import { ConfirmStopModal } from "./ConfirmStopModal";
import { SessionExerciseCard } from "./SessionExerciseCard";
import { ExerciseDetailsModal } from "./ExerciseDetailsModal";
import type { PlanExercise } from "@/lib/workouts";
import { Center } from "@/components/ui/center";
import { SessionTimerDock } from "./SessionTimerDock";

export default function WorkoutTimerPage() {
  const router = useRouter();
  const theme = useTheme();
  const {
    workoutSession, exercises, exercisesLoading, exercisesError, reloadExercises,
    exerciseProgress, setExerciseProgress, completeSession,
    pauseSession, resumeSession, getElapsedTime, saving, saveError,
  } = useWorkoutSessionContext();
  const [dockHeight, setDockHeight] = useState(0);
  const [confirmStopOpen, setConfirmStopOpen] = useState(false);
  const [finishedFeedbackVisible, setFinishedFeedbackVisible] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<PlanExercise | null>(null);
  const [elapsed, setElapsed] = useState(getElapsedTime);

  useEffect(() => {
    const update = () => setElapsed(getElapsedTime());
    update();
    if (workoutSession?.status !== "active") return;
    const interval = setInterval(update, 1000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") update();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [workoutSession, getElapsedTime]);

  const header = (
    <View style={styles.header}>
      <IconButton
        icon="arrow-left"
        mode="outlined"
        size={24}
        onPress={() => router.back()}
        accessibilityLabel="Go back"
        iconColor={theme.colors.onSurface}
        containerColor={theme.colors.surface}
        style={[styles.backButton, { borderColor: theme.colors.outlineVariant }]}
      />

      <View style={styles.headerCopy}>
        <Text variant="headlineMedium" accessibilityRole="header" style={styles.headerTitle}>
          {workoutSession?.workout.name ?? "Workout session"}
        </Text>
      </View>
    </View>
  );

  if (!workoutSession) {
    return (
      <ScreenView header={header}>
        <Text variant="headlineSmall">No workout in progress</Text>

        <Text variant="bodyMedium">Choose a workout plan to start a session.</Text>

        <Button mode="contained" onPress={() => router.replace("/(tabs)/workouts")}>Browse workouts</Button>
      </ScreenView>
    );
  }

  const isActive = workoutSession.status === "active";
  const isCompleted = workoutSession.status === "complete";
  const isIdle = workoutSession.status === "idle";
  const completedCount = exercises.filter((exercise) => exerciseProgress.get(exercise.workoutId)?.completed).length;
  const elapsedTime = isActive ? elapsed : getElapsedTime();
  const elapsedMinutes = Math.max(1, Math.ceil(elapsedTime / 60000));
  const status = isCompleted ? "Workout complete" : isActive ? "In progress" : isIdle ? "Ready to start" : "Paused";

  return (
    <ScreenView
      header={header}
      keyboardShouldPersistTaps="handled"
      keyboardBottomOffset={dockHeight + Spacing.three}
      contentContainerStyle={{ paddingBottom: dockHeight + Spacing.four }}
      overlay={
        <>
          <SessionTimerDock
            elapsedMilliseconds={elapsedTime}
            status={status}
            active={isActive}
            idle={isIdle}
            completed={isCompleted}
            saving={saving}
            error={confirmStopOpen ? "" : saveError}
            onToggle={isActive ? pauseSession : resumeSession}
            onFinish={() => {
              Keyboard.dismiss();
              setConfirmStopOpen(true);
            }}
            onBackToWorkouts={() => router.replace("/(tabs)/workouts")}
            onHeightChange={setDockHeight}
          />

          <ExerciseDetailsModal
            exercise={selectedExercise}
            onDismiss={() => setSelectedExercise(null)}
          />

          <ConfirmStopModal
            visible={confirmStopOpen}
            elapsedTime={elapsedMinutes}
            loading={saving}
            error={saveError}
            onDismiss={() => setConfirmStopOpen(false)}
            onConfirm={async () => {
              if (await completeSession()) {
                setConfirmStopOpen(false);
                setFinishedFeedbackVisible(true);
              }
            }}
          />

          <Snackbar
            visible={finishedFeedbackVisible}
            onDismiss={() => setFinishedFeedbackVisible(false)}
            duration={4000}
            wrapperStyle={{ bottom: dockHeight + Spacing.two }}
            accessibilityLiveRegion="polite"
          >
            Workout finished and saved.
          </Snackbar>
        </>
      }
    >
      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Text variant="titleLarge" style={styles.title}>Exercises</Text>

          {!exercisesLoading && !exercisesError && exercises.length > 0 && (
            <Text variant="labelLarge" style={{ color: theme.colors.onSurfaceVariant }}>{completedCount} of {exercises.length} done</Text>
          )}
        </View>

        {exercises.length > 0 && <ProgressBar progress={completedCount / exercises.length} style={styles.progress} />}
      </View>

      {exercisesLoading ? (
        <View style={styles.loading} accessibilityLabel="Loading exercises" accessibilityState={{ busy: true }}>
          <ProgressBar indeterminate />

          <Text variant="bodyMedium">Loading exercises…</Text>
        </View>
      ) : exercisesError ? (
        <View style={styles.section}>
          <Text variant="bodyMedium" style={{ color: theme.colors.error }}>{exercisesError}</Text>

          <Button mode="outlined" onPress={reloadExercises}>Retry loading exercises</Button>
        </View>
      ) : exercises.length === 0 ? (
        <View style={styles.section}>
          <Text variant="titleMedium">No exercises in this plan</Text>

          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>You can still time and finish this workout.</Text>
        </View>
      ) : exercises.map((exercise) => {
        const progress = exerciseProgress.get(exercise.workoutId);
        return progress ? (
          <SessionExerciseCard
            key={`${workoutSession.workout.id}:${exercise.workoutId}`} exercise={exercise} progress={progress}
            disabled={isCompleted || saving}
            trackingDisabled={!isActive}
            onViewDetails={() => {
              Keyboard.dismiss();
              setSelectedExercise(exercise);
            }}
            onChange={(next) => setExerciseProgress(exercise.workoutId, next)}
          />
        ) : null;
      })}

      {!isCompleted && <Center>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Exercise adjustments apply to this session only.</Text>
      </Center>}
    </ScreenView>
  );
}

const styles = StyleSheet.create({
  header: {
    width: "100%",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.three,
  },
  backButton: { margin: 0, width: 48, height: 48, borderRadius: Radius.medium },
  headerCopy: { flex: 1, minWidth: 0, gap: Spacing.one },
  headerTitle: { fontWeight: "800" },
  title: { fontWeight: "700" },
  section: { gap: Spacing.two, marginTop: Spacing.two },
  sectionHeading: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: Spacing.two },
  progress: { borderRadius: Radius.pill },
  loading: { gap: Spacing.three, paddingVertical: Spacing.three },
});
