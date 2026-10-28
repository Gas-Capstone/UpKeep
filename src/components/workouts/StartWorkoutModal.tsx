import {
  Button,
  Text,
  Modal,
  Portal,
  Card,
  useTheme,
  Chip,
  DataTable,
  TextInput,
} from "react-native-paper";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { styles } from "@/constants/styles";
import { HStack } from "../ui/hstack";
import { VStack } from "../ui/vstack";
import { Center } from "../ui/center";
import type { Workout } from "../context/workoutsDataContext";

// Removed unused `user` prop (same issue WorkoutCard.tsx had) and swapped loose Object/Number types for Workout/number.
type startWorkoutProps = {
  visible: boolean;
  workout: Workout;
  onDismiss: () => void;
  onStart?: (workout: Workout, mins: number) => void;
};

export function StartWorkoutModal({
  visible,
  workout,
  onDismiss,
  onStart,
}: startWorkoutProps) {
  const [mins, setMins] = useState(0);
  const theme = useTheme();

  useEffect(() => {
    setMins(workout.duration_min);
  }, [workout]);
  return (
    <>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContent}
      >
        <Card mode="contained" style={styles.modalCard}>
          <Card.Title title={workout.name} />

          <Card.Content style={styles.stepContainer}>
            <VStack space="md" style={{ alignSelf: "stretch" }}>
              <TextInput
                label="Planned minutes"
                mode="outlined"
                value={mins?.toString()}
                onChangeText={(text) => setMins(Number(text))}
              />
            </VStack>
          </Card.Content>

          <Card.Actions>
            <Button onPress={onDismiss}>Cancel</Button>

            <Button
              mode="contained"
              onPress={onStart ? () => onStart(workout, mins) : () => null}
            >
              Start Workout
            </Button>
          </Card.Actions>
        </Card>
      </Modal>
    </>
  );
}
