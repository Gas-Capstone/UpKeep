import { useEffect, useState } from "react";
import { ActivityIndicator, Button, Dialog, Portal, Text } from "react-native-paper";

import { useWorkoutsData, type Workout } from "@/components/context/workoutsDataContext";
import type { PlanExercise } from "@/lib/workouts";
import { CreateWorkoutPlanModal } from "./CreateWorkoutPlanModal";

export function EditWorkoutPlanModal({ plan, onDismiss }: {
  plan: Workout;
  onDismiss: () => void;
}) {
  const { availableWorkouts, loadPlanExercises, updatePlan } = useWorkoutsData();
  const [exercises, setExercises] = useState<PlanExercise[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadPlanExercises(String(plan.id)).then((loaded) => {
      if (!cancelled) setExercises(loaded);
    }).catch(() => {
      if (!cancelled) setError(true);
    });
    return () => { cancelled = true; };
  }, [plan.id, loadPlanExercises, attempt]);

  if (exercises !== null) {
    return (
      <CreateWorkoutPlanModal
        visible
        initialPlan={plan}
        initialExercises={exercises}
        availableWorkouts={availableWorkouts}
        onDismiss={onDismiss}
        onCreate={(details, selections) => updatePlan(String(plan.id), details, selections)}
      />
    );
  }

  return (
    <Portal>
      <Dialog visible onDismiss={onDismiss}>
        <Dialog.Title>Edit workout plan</Dialog.Title>
        <Dialog.Content>
          {error ? <Text>Couldn&apos;t load your plan. Please try again.</Text> : <ActivityIndicator accessibilityLabel="Loading plan" />}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          {error ? <Button onPress={() => { setError(false); setAttempt(attempt + 1); }}>Retry</Button> : null}
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
