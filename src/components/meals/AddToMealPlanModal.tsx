import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { format, isSameDay } from "date-fns";
import {
  Button,
  Card,
  Chip,
  HelperText,
  Modal,
  Portal,
  Text,
} from "react-native-paper";

import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { styles } from "@/constants/styles";
import { useTheme } from "@/hooks/use-theme";
import {
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  MealType,
  getWeekDays,
  toDateKey,
} from "@/lib/meals/mealPlan";

type AddToMealPlanModalProps = {
  visible: boolean;
  onDismiss: () => void;
  recipeName: string;
  onConfirm: (plannedDate: string, mealType: MealType) => Promise<void>;
};

export function AddToMealPlanModal({
  visible,
  onDismiss,
  recipeName,
  onConfirm,
}: AddToMealPlanModalProps) {
  const theme = useTheme();
  const today = new Date();
  // Both weeks the plan page shows, so anything plannable there is reachable
  // from here too.
  const days = [...getWeekDays(0, today), ...getWeekDays(1, today)];

  const [selectedDate, setSelectedDate] = useState(toDateKey(today));
  const [mealType, setMealType] = useState<MealType>("dinner");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setSelectedDate(toDateKey(new Date()));
    setMealType("dinner");
    setError("");
  }, [visible]);

  const handleConfirm = async () => {
    setError("");
    setSaving(true);
    try {
      await onConfirm(selectedDate, mealType);
      onDismiss();
    } catch {
      setError("Couldn't add to your meal plan. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContent}>
        <Card mode="contained" style={styles.modalCard}>
          <Card.Title
            title={<Text variant="titleLarge">Add to meal plan</Text>}
            subtitle={recipeName}
          />
          <Card.Content>
            <VStack space="md" style={{ alignSelf: "stretch" }}>
              <VStack space="sm" style={{ alignSelf: "stretch" }}>
                <Text variant="labelLarge">Day</Text>
                <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
                  <VStack space="xs" style={{ alignSelf: "stretch" }}>
                    {days.map((day) => {
                      const key = toDateKey(day);
                      return (
                        <Chip
                          key={key}
                          selected={selectedDate === key}
                          showSelectedCheck
                          onPress={() => setSelectedDate(key)}
                          style={{ backgroundColor: theme.background }}>
                          {format(day, "EEEE, MMM d")}
                          {isSameDay(day, today) ? " · Today" : ""}
                        </Chip>
                      );
                    })}
                  </VStack>
                </ScrollView>
              </VStack>

              <VStack space="sm" style={{ alignSelf: "stretch" }}>
                <Text variant="labelLarge">Meal</Text>
                <HStack space="sm" style={{ flexWrap: "wrap" }}>
                  {MEAL_TYPES.map((type) => (
                    <Chip
                      key={type}
                      selected={mealType === type}
                      showSelectedCheck
                      onPress={() => setMealType(type)}
                      style={{ backgroundColor: theme.background }}>
                      {MEAL_TYPE_LABELS[type]}
                    </Chip>
                  ))}
                </HStack>
              </VStack>

              {/* One recipe per slot is a DB constraint, so warn rather than
                  let the replacement come as a surprise. */}
              <Text variant="bodySmall" style={{ color: theme.textSecondary }}>
                If that slot already has a recipe, this replaces it.
              </Text>

              {error !== "" && (
                <HelperText type="error" visible>
                  {error}
                </HelperText>
              )}
            </VStack>
          </Card.Content>
          <Card.Actions>
            <HStack style={styles.rowBox}>
              <Button onPress={onDismiss} disabled={saving}>
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleConfirm}
                loading={saving}
                disabled={saving}>
                Add
              </Button>
            </HStack>
          </Card.Actions>
        </Card>
      </Modal>
    </Portal>
  );
}
