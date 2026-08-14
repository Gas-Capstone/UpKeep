import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Chip,
  HelperText,
  Modal,
  Portal,
  SegmentedButtons,
  Text,
  TextInput,
} from "react-native-paper";

import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { styles } from "@/constants/styles";
import { useTheme } from "@/hooks/use-theme";
import { GrocerySource, Ingredient } from "@/lib/meals/meals";

type AddGroceryItemModalProps = {
  visible: boolean;
  onDismiss: () => void;
  // Which list the form should open on — the one the user is currently viewing.
  defaultSource: GrocerySource;
  ingredients: Ingredient[];
  onAdd: (item: {
    ingredientId: string | null;
    customName: string | null;
    quantity: number | null;
    unit: string | null;
    source: GrocerySource;
  }) => Promise<void>;
};

// Enough to recognise the one you meant without burying the rest of the form.
const MAX_SUGGESTIONS = 5;

// "combined" isn't a real source, so adding from that view defaults to
// "manual" — which still shows up in Combined.
const SOURCES = [
  { value: "meal_plan", label: "Meal plan" },
  { value: "recipe", label: "Quick add" },
  { value: "manual", label: "Other" },
];

export function AddGroceryItemModal({
  visible,
  onDismiss,
  defaultSource,
  ingredients,
  onAdd,
}: AddGroceryItemModalProps) {
  const theme = useTheme();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [source, setSource] = useState<GrocerySource>(defaultSource);
  // Set once a catalog ingredient is chosen; null means the typed text is
  // saved as free text instead.
  const [selected, setSelected] = useState<Ingredient | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setName("");
    setQuantity("");
    setUnit("");
    setSource(defaultSource);
    setSelected(null);
    setError("");
  }, [visible, defaultSource]);

  // Suggestions stop once something is picked, so the list doesn't sit there
  // competing with the selection it just produced.
  const suggestions = useMemo(() => {
    const q = name.trim().toLowerCase();
    if (selected || q === "") return [];
    return ingredients
      .filter((ing) => ing.name.toLowerCase().includes(q))
      .slice(0, MAX_SUGGESTIONS);
  }, [ingredients, name, selected]);

  const selectIngredient = (ingredient: Ingredient) => {
    setSelected(ingredient);
    setName(ingredient.name);
    // Prefill the catalog unit; still editable, since "2 bags" of something
    // sold by the pound is a legitimate shopping note.
    setUnit(ingredient.unit ?? "");
  };

  const clearSelection = () => {
    setSelected(null);
    setName("");
    setUnit("");
  };

  const handleAdd = async () => {
    if (!name.trim()) {
      setError("Give the item a name.");
      return;
    }

    const parsed = Number(quantity);
    // Quantity is optional; only reject it when something unparseable was typed.
    if (quantity.trim() !== "" && (!Number.isFinite(parsed) || parsed <= 0)) {
      setError("Quantity must be a number greater than 0.");
      return;
    }

    setError("");
    setSaving(true);
    try {
      await onAdd({
        // Exactly one of these is set — the table's check constraint requires
        // it, and a catalog link is what lets the row dedupe.
        ingredientId: selected?.id ?? null,
        customName: selected ? null : name.trim(),
        quantity: quantity.trim() === "" ? null : parsed,
        unit: unit.trim() === "" ? null : unit.trim(),
        source,
      });
      onDismiss();
    } catch {
      setError("Couldn't add that item. Please try again.");
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
          <Card.Title title={<Text variant="titleLarge">Add item</Text>} />
          <Card.Content>
            <VStack space="md" style={{ alignSelf: "stretch" }}>
              <TextInput
                label="Item"
                mode="outlined"
                value={name}
                onChangeText={(text) => {
                  // Typing after a selection means they're naming something
                  // else, so the catalog link is dropped.
                  if (selected) setSelected(null);
                  setName(text);
                }}
                right={
                  selected ? (
                    <TextInput.Icon icon="close" onPress={clearSelection} />
                  ) : undefined
                }
                autoFocus
              />

              {selected ? (
                <Text variant="bodySmall" style={{ color: theme.textSecondary }}>
                  Linked to {selected.name} in your ingredients — adding it
                  again will update the amount instead of duplicating it.
                </Text>
              ) : (
                suggestions.length > 0 && (
                  <VStack space="xs" style={{ alignSelf: "stretch" }}>
                    <Text variant="labelSmall" style={{ color: theme.textSecondary }}>
                      Tap to link to an ingredient
                    </Text>
                    <HStack space="sm" style={{ flexWrap: "wrap" }}>
                      {suggestions.map((ing) => (
                        <Chip key={ing.id} onPress={() => selectIngredient(ing)}>
                          {ing.name}
                        </Chip>
                      ))}
                    </HStack>
                  </VStack>
                )
              )}

              <HStack space="sm" style={{ alignSelf: "stretch" }}>
                <TextInput
                  label="Quantity"
                  mode="outlined"
                  keyboardType="decimal-pad"
                  style={{ flex: 1 }}
                  value={quantity}
                  onChangeText={setQuantity}
                />
                <TextInput
                  label="Unit"
                  mode="outlined"
                  style={{ flex: 1 }}
                  value={unit}
                  onChangeText={setUnit}
                />
              </HStack>

              <VStack space="sm" style={{ alignSelf: "stretch" }}>
                <Text variant="labelLarge">Add to</Text>
                <SegmentedButtons
                  value={source}
                  onValueChange={(value) => setSource(value as GrocerySource)}
                  buttons={SOURCES}
                />
              </VStack>

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
                onPress={handleAdd}
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
