import { ScrollView } from "react-native";
import { Button, Card, Modal, Portal, Text } from "react-native-paper";

import { styles } from "@/constants/styles";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { Ingredient } from "@/lib/meals/meals";

import { IngredientPicker } from "./IngredientPicker";

type AddIngredientsModalProps = {
  visible: boolean;
  onDismiss: () => void;
  ingredients: Ingredient[];
  selectedIds: ReadonlySet<string>;
  onToggle: (ingredient: Ingredient) => void;
};

/** Full-catalog picker in a modal. Toggles persist instantly via onToggle. */
export function AddIngredientsModal({
  visible,
  onDismiss,
  ingredients,
  selectedIds,
  onToggle,
}: AddIngredientsModalProps) {
  const theme = useTheme();

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.modalContent}>
        <Card mode="contained" style={styles.modalCard}>
          <Card.Title title={<Text variant="titleLarge">My fridge</Text>} />
          <Card.Content>
            <Text style={{ color: theme.textSecondary, marginBottom: Spacing.three }}>
              Tap to add or remove — changes save automatically.
            </Text>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <IngredientPicker
                ingredients={ingredients}
                selectedIds={selectedIds}
                onToggle={onToggle}
              />
            </ScrollView>
          </Card.Content>
          <Card.Actions>
            <Button mode="contained" onPress={onDismiss}>
              Done
            </Button>
          </Card.Actions>
        </Card>
      </Modal>
    </Portal>
  );
}
