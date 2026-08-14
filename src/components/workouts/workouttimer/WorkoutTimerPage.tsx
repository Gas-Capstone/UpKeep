import { useState, useEffect } from "react";
import { useUserContext } from "../../context/userContext";
import { useWorkoutSessionContext } from "@/components/context/workoutSessionContext";
import { ScreenView } from "../../ui/ScreenView";
import { ConfirmStopModal } from "./ConfirmStopModal";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, useTheme } from "react-native-paper";
import { styles } from "@/constants/styles";
import { Center } from "@/components/ui/center";

import { View } from "react-native";
import { IconButton, Checkbox, Divider } from "react-native-paper";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { CircleTimer } from "@/components/ui/CircleTimer";

import { getPlanExercises, setWorkoutComplete } from "@/lib/supabaseFunctions";
import type { PlanExercise } from "@/lib/workouts";
import { Spacing } from "@/constants/theme";

export default function WorkoutTimerPage() {
  const router = useRouter();
  const theme = useTheme();
  const { user } = useUserContext();
  const {
    workoutSession,
    exerciseProgress: progress,
    setExerciseProgress,
    seedExerciseProgress,
    completeSession,
    pauseSession,
    resumeSession,
    clearSession,
    getElapsedTime,
  } = useWorkoutSessionContext();

  const [ confirmStopOpen, setConfirmStopOpen ] = useState(false)
  // vars for timer
  const [now, setNow] = useState(Date.now());

  const [exercises, setExercises] = useState<PlanExercise[]>([]);

  const planId = workoutSession?.workout?.id;

  // The plan's exercises come from the database; how far through them the user
  // is lives in the session context, so it survives leaving this screen and
  // resets when a new workout starts.
  useEffect(() => {
    if (!planId) return;
    let cancelled = false;

    getPlanExercises(planId).then((planExercises) => {
      if (cancelled) return;
      setExercises(planExercises);
      seedExerciseProgress(planExercises);
    });

    return () => {
      cancelled = true;
    };
  }, [planId]);

  const saveProgress = (
    exercise: PlanExercise,
    setsRemaining: number,
    completed: boolean,
  ) => {
    setExerciseProgress(exercise.workoutId, { setsRemaining, completed });
  };

  const decrementSet = (exercise: PlanExercise) => {
    const current = progress.get(exercise.workoutId);
    if (!current || current.setsRemaining <= 0) return;
    const setsRemaining = current.setsRemaining - 1;
    // Running out of sets is what finishing an exercise means.
    saveProgress(exercise, setsRemaining, setsRemaining === 0);
  };

  // Undo for a mis-tap; capped at the plan's own set count so it can't exceed
  // what the exercise actually calls for.
  const incrementSet = (exercise: PlanExercise) => {
    const current = progress.get(exercise.workoutId);
    if (!current || current.setsRemaining >= exercise.sets) return;
    const setsRemaining = current.setsRemaining + 1;
    saveProgress(exercise, setsRemaining, false);
  };

  const toggleComplete = (exercise: PlanExercise) => {
    const current = progress.get(exercise.workoutId);
    if (!current) return;
    const completed = !current.completed;
    // Completing zeroes the remaining sets; un-completing restores them, so
    // the checkbox and the counter can never disagree.
    saveProgress(exercise, completed ? 0 : exercise.sets, completed);
  };


  useEffect(() => {
    // sets a "tick" every second to force a re-render of the timer, and keep the timecheck going
    if (workoutSession?.status !== "active") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [workoutSession?.status]);

  useEffect(() => {
    // fires when timer is finished
    if (workoutSession?.status !== "active") return;
    if (workoutSession.plannedDuration * 60 * 1000 - getElapsedTime() <= 0) {
      setWorkoutComplete(user, workoutSession.workout, workoutSession.plannedDuration);
      completeSession();
    }
  }, [workoutSession?.status, getElapsedTime, now]);

  useEffect(() => {
    // Finishing every exercise ends the session the same way the timer running
    // out does — logged with the time actually spent, not the planned duration.
    if (!workoutSession || workoutSession.status === "complete") return;
    // An empty list would otherwise satisfy `every` and end the session the
    // moment the page opened.
    if (exercises.length === 0) return;

    const allDone = exercises.every(
      (exercise) => progress.get(exercise.workoutId)?.completed,
    );
    if (!allDone) return;

    const minutes = Math.max(1, Math.ceil(getElapsedTime() / 60000));
    setWorkoutComplete(user, workoutSession.workout, minutes);
    // Flips status to complete synchronously, so this can't fire twice.
    completeSession();
  }, [exercises, progress, workoutSession?.status]);

  // workoutSession can be null; this guard sits after all hooks (Rules of Hooks) since useEffect above must run unconditionally.
  if (!workoutSession) {
    return null;
  }

  const isActive = workoutSession?.status === "active"
  const isPaused = workoutSession?.status === "paused"
  const isIdle = workoutSession?.status === "idle"
  const isCompleted = workoutSession?.status === "complete"


  const totalMS = workoutSession.plannedDuration * 60 * 1000;
  const elapsedMS = getElapsedTime();
  const elapsedMins = Math.max(1, Math.ceil(elapsedMS / 60000))
  const remainingMS = Math.max(totalMS - elapsedMS, 0);
  const remainingMins =
    workoutSession.status === "complete" ? 0 : Math.floor(remainingMS / 60000);
  const remainingSecs =
    workoutSession.status === "complete"
      ? 0
      : Math.floor((remainingMS % 60000) / 1000);
  const timerLabel = `${remainingMins}:${remainingSecs.toString().padStart(2, "0")}`;
  const timerProgress =
    workoutSession.status === "complete"
      ? 0
      : totalMS > 0
        ? remainingMS / totalMS
        : 0;


  const handleTimerToggle = () => {
    if (isActive) {
      pauseSession()
    } else if (isPaused || isIdle) {
      resumeSession()
    }
  }

  const handleStop = async () => {
    if (isCompleted) return

    await setWorkoutComplete(user, workoutSession.workout, elapsedMins)
    completeSession()
    setConfirmStopOpen(false)
  }


  return (
    <ScreenView
      contentContainerStyle={{ flexGrow: 1 }} 
      header={
        <HStack style={{ alignContent: "flex-start", width: "100%" }}>
          <IconButton
            icon="arrow-left"
            size={25}
            onPress={() => router.back()}
          />
        </HStack>
      }
      overlay={
        <>
          <ConfirmStopModal
            visible={confirmStopOpen}
            elapsedTime={elapsedMins}
            onDismiss={() => setConfirmStopOpen(false)}
            onConfirm={handleStop}
          />
        </>
      }

    >
      <VStack
        style={{ flex: 1, width: "100%", alignContent: "center", alignItems: "center"}}
        space="sm"
      >
        <CircleTimer
          progress={timerProgress}
          label={timerLabel}
          duration={1000}
        />

        {/* Below the timer, spread apart from each other rather than sitting
            as one adjacent pair. */}
        <HStack
          style={{
            width: "100%",
            alignItems: "center",
            justifyContent: "space-evenly",
            marginTop: Spacing.three,
          }}
        >
          <IconButton
            icon={isActive ? "pause" : "play"}
            size={40}
            disabled={isCompleted}
            onPress={handleTimerToggle}
            containerColor={isCompleted ? theme.colors.surface : theme.colors.primary}
            iconColor={theme.colors.onPrimary}
            style={{ margin: 0 }}
          />

          <IconButton
            icon="stop"
            size={40}
            disabled={isCompleted}
            onPress={() => setConfirmStopOpen(true)}
            containerColor={isCompleted ? theme.colors.surface : theme.colors.primary}
            iconColor={theme.colors.onPrimary}
            style={{ margin: 0 }}
          />
        </HStack>

        <Text variant="headlineMedium" style={{
          marginTop: Spacing.two,
          marginBottom: Spacing.one }}>{workoutSession.workout.name}</Text>
        {isCompleted && <Text variant="labelLarge">Workout complete!</Text>}

        <VStack style={{ alignSelf: "stretch", width: "100%" }}>
          {exercises.length === 0 ? (
            <Center style={{ paddingVertical: Spacing.four }}>
              <Text style={{ color: theme.colors.onSurfaceVariant }}>
                No exercises listed for this plan.
              </Text>
            </Center>
          ) : (
            exercises.map((exercise, index) => {
              const state = progress.get(exercise.workoutId);
              const setsRemaining = state?.setsRemaining ?? exercise.sets;
              const completed = state?.completed ?? false;

              return (
                <View key={exercise.workoutId}>
                  {index > 0 && <Divider />}
                  <HStack style={{ alignItems: "center", paddingVertical: Spacing.one }}>
                    <Checkbox
                      status={completed ? "checked" : "unchecked"}
                      onPress={() => toggleComplete(exercise)}
                    />

                    <VStack style={{ flex: 1, minWidth: 0, paddingHorizontal: Spacing.two }}>
                      <Text
                        variant="bodyLarge"
                        numberOfLines={1}
                        style={
                          completed
                            ? {
                                textDecorationLine: "line-through",
                                color: theme.colors.onSurfaceVariant,
                              }
                            : undefined
                        }
                      >
                        {exercise.name}
                      </Text>
                      <Text
                        variant="labelSmall"
                        style={{ color: theme.colors.onSurfaceVariant }}
                      >
                        sets left of {exercise.sets} · {exercise.reps} reps
                      </Text>
                    </VStack>

                    {/* Explicit stepper: the count sits between the controls
                        so it's clear the buttons act on it. */}
                    <HStack style={{ alignItems: "center" }}>
                      <IconButton
                        icon="minus"
                        mode="outlined"
                        size={18}
                        style={{ margin: 0 }}
                        disabled={setsRemaining <= 0}
                        onPress={() => decrementSet(exercise)}
                        accessibilityLabel={`One less set of ${exercise.name}`}
                      />
                      <Text
                        variant="titleMedium"
                        style={{ minWidth: 32, textAlign: "center" }}
                      >
                        {setsRemaining}
                      </Text>
                      <IconButton
                        icon="plus"
                        mode="outlined"
                        size={18}
                        style={{ margin: 0 }}
                        disabled={setsRemaining >= exercise.sets}
                        onPress={() => incrementSet(exercise)}
                        accessibilityLabel={`One more set of ${exercise.name}`}
                      />
                    </HStack>
                  </HStack>
                </View>
              );
            })
          )}
        </VStack>
      </VStack>
    </ScreenView>
  );
}
