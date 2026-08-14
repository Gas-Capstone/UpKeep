import { useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import {
  Button,
  Card,
  Divider,
  HelperText,
  IconButton,
  Modal,
  Portal,
  Text,
  TextInput,
} from "react-native-paper";

import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { styles } from "@/constants/styles";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { FridgeEntry, Ingredient } from "@/lib/meals/meals";

import { IngredientPicker } from "./IngredientPicker";

type FridgeModalProps = {
  visible: boolean;
  onDismiss: () => void;
  ingredients: Ingredient[];
  entries: ReadonlyMap<string, FridgeEntry>;
  onSave: (entries: ReadonlyMap<string, FridgeEntry>) => Promise<void>;
};

// Three states of the same card: the fridge list, the catalog picker reached
// from "Add ingredients", and the quantity form for one chosen ingredient.
type FridgeView = "list" | "picker" | "quantity";

// Quantities are fractional (0.5 lb of beef), so the floor is one hundredth
// rather than 1. Decreasing is done by typing — the up arrow is the only
// stepper.
const MIN_QUANTITY = 0.01;
const DEFAULT_QUANTITY = 1;

/**
 * Keeps input to digits, at most one decimal point, and at most two decimal
 * places. Runs on every keystroke, so typing a third decimal simply doesn't
 * register rather than being corrected after the fact.
 */
function sanitizeDecimal(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  if (rest.length === 0) return whole;
  return `${whole}.${rest.join("").slice(0, 2)}`;
}

function roundToHundredths(value: number): number {
  return Math.round(value * 100) / 100;
}

export function FridgeModal({
  visible,
  onDismiss,
  ingredients,
  entries,
  onSave,
}: FridgeModalProps) {
  const theme = useTheme();
  const [view, setView] = useState<FridgeView>("list");
  // Edits are held here and flushed once on close, so a run of arrow taps is
  // one write rather than one per tap.
  const [draft, setDraft] = useState<Map<string, FridgeEntry>>(new Map());
  // Raw text per row while the field is being edited. Without this the input
  // is driven straight off the numeric draft, so a trailing "." is normalized
  // away on each keystroke and decimals can never be typed.
  const [quantityText, setQuantityText] = useState<Map<string, string>>(new Map());
  const [pending, setPending] = useState<Ingredient | null>(null);
  const [pendingQuantity, setPendingQuantity] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reload the draft from context each time the card opens so it never shows
  // edits abandoned by a previous session.
  useEffect(() => {
    if (!visible) return;
    setDraft(new Map(entries));
    setQuantityText(new Map());
    setView("list");
    setPending(null);
    setError("");
  }, [visible, entries]);

  const byId = useMemo(
    () => new Map(ingredients.map((ing) => [ing.id, ing])),
    [ingredients],
  );

  const draftRows = useMemo(
    () =>
      [...draft]
        .map(([id, entry]) => ({ ingredient: byId.get(id), entry, id }))
        .filter((row): row is { ingredient: Ingredient; entry: FridgeEntry; id: string } =>
          Boolean(row.ingredient),
        )
        .sort((a, b) => a.ingredient.name.localeCompare(b.ingredient.name)),
    [draft, byId],
  );

  const draftIds = useMemo(() => new Set(draft.keys()), [draft]);

  const setQuantity = (id: string, value: string) => {
    const text = sanitizeDecimal(value);
    setQuantityText((current) => new Map(current).set(id, text));

    const parsed = Number(text);
    setDraft((current) => {
      const entry = current.get(id);
      if (!entry) return current;
      const next = new Map(current);
      next.set(id, {
        ...entry,
        // Keep the last valid number while the field is mid-edit or blank,
        // rather than writing NaN into the draft.
        quantity:
          text !== "" && Number.isFinite(parsed) && parsed >= MIN_QUANTITY
            ? parsed
            : entry.quantity,
      });
      return next;
    });
  };

  const removeItem = (id: string) => {
    setDraft((current) => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  };

  // Tapping a catalog chip opens the quantity form. Tapping one already in the
  // fridge reopens it on its current amount rather than toggling it off.
  const openQuantityForm = (ingredient: Ingredient) => {
    setPending(ingredient);
    setPendingQuantity(
      String(draft.get(ingredient.id)?.quantity ?? DEFAULT_QUANTITY),
    );
    setView("quantity");
  };

  const confirmQuantity = () => {
    if (!pending) return;
    const parsed = Number(pendingQuantity);
    const quantity = roundToHundredths(
      pendingQuantity !== "" && Number.isFinite(parsed) && parsed >= MIN_QUANTITY
        ? parsed
        : DEFAULT_QUANTITY,
    );

    setDraft((current) => {
      const next = new Map(current);
      next.set(pending.id, { quantity, unit: pending.unit });
      return next;
    });
    setPending(null);
    setView("picker");
  };

  const handleDismiss = async () => {
    setError("");
    setSaving(true);
    try {
      // Restamp each row with the catalog's current unit so an edited unit
      // propagates to rows added before the change, matching what's displayed.
      const normalized = new Map(
        [...draft].map(([id, entry]) => [
          id,
          { ...entry, unit: byId.get(id)?.unit ?? entry.unit },
        ]),
      );
      await onSave(normalized);
      onDismiss();
    } catch {
      setError("Couldn't save your fridge. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        // Dismissing writes the batched edits, so the gesture can't quietly
        // drop them.
        onDismiss={handleDismiss}
        contentContainerStyle={styles.modalContent}>
        {/* Each view gets its own Card rather than sharing one: Paper's Card
            clones its direct children to inject index/total, and a Fragment
            can't accept those props. */}
        {view === "list" && (
          <Card mode="contained" style={styles.modalCard}>
              <Card.Title title={<Text variant="titleLarge">My fridge</Text>} />
              <Card.Content>
                {draftRows.length === 0 ? (
                  <Text style={{ color: theme.textSecondary }}>
                    Your fridge is empty — add ingredients to get started.
                  </Text>
                ) : (
                  <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                    <VStack space="xs" style={{ alignSelf: "stretch" }}>
                      {draftRows.map((row, index) => (
                        <View key={row.id}>
                          {index > 0 && <Divider />}
                          <HStack
                            style={{
                              alignItems: "center",
                              paddingVertical: Spacing.one,
                            }}>
                            {/* minWidth 0 lets this column actually shrink;
                                without it a long name forces the row wider
                                instead of ellipsizing. */}
                            <VStack
                              style={{
                                flex: 1,
                                minWidth: 0,
                                paddingRight: Spacing.two,
                              }}>
                              <Text variant="bodyLarge" numberOfLines={1}>
                                {row.ingredient.name}
                              </Text>
                              <Text
                                variant="labelSmall"
                                numberOfLines={1}
                                style={{ color: theme.textSecondary }}>
                                {row.ingredient.unit}
                              </Text>
                            </VStack>

                            <TextInput
                              mode="outlined"
                              dense
                              keyboardType="decimal-pad"
                              value={quantityText.get(row.id) ?? String(row.entry.quantity)}
                              onChangeText={(text) => setQuantity(row.id, text)}
                              style={{ width: 64 }}
                              accessibilityLabel={`Quantity of ${row.ingredient.name} in ${row.ingredient.unit}`}
                            />

                            {/* Paper gives IconButton a default margin of 6 on
                                every side; zeroing it keeps the remove button
                                tight against the edge. */}
                            <IconButton
                              icon="close"
                              size={18}
                              style={{ margin: 0 }}
                              onPress={() => removeItem(row.id)}
                              accessibilityLabel={`Remove ${row.ingredient.name} from fridge`}
                            />
                          </HStack>
                        </View>
                      ))}
                    </VStack>
                  </ScrollView>
                )}

                {error !== "" && (
                  <HelperText type="error" visible>
                    {error}
                  </HelperText>
                )}
              </Card.Content>
              <Card.Actions>
                <HStack style={styles.rowBox}>
                  <Button onPress={() => setView("picker")} disabled={saving}>
                    Add ingredients
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleDismiss}
                    loading={saving}
                    disabled={saving}>
                    Done
                  </Button>
                </HStack>
              </Card.Actions>
          </Card>
        )}

        {view === "picker" && (
          <Card mode="contained" style={styles.modalCard}>
              <Card.Title title={<Text variant="titleLarge">Add ingredients</Text>} />
              <Card.Content>
                <Text style={{ color: theme.textSecondary, marginBottom: Spacing.three }}>
                  Tap an ingredient to set how much you have.
                </Text>
                <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                  <IngredientPicker
                    ingredients={ingredients}
                    selectedIds={draftIds}
                    onToggle={openQuantityForm}
                  />
                </ScrollView>
              </Card.Content>
              <Card.Actions>
                <Button mode="contained" onPress={() => setView("list")}>
                  Done
                </Button>
              </Card.Actions>
          </Card>
        )}

        {view === "quantity" && pending && (
          <Card mode="contained" style={styles.modalCard}>
              <Card.Title title={<Text variant="titleLarge">{pending.name}</Text>} />
              <Card.Content>
                <VStack space="sm" style={{ alignSelf: "stretch" }}>
                  <Text style={{ color: theme.textSecondary }}>
                    How much do you have?
                  </Text>
                  <TextInput
                    label={`Quantity (${pending.unit})`}
                    mode="outlined"
                    keyboardType="decimal-pad"
                    value={pendingQuantity}
                    onChangeText={(text) => setPendingQuantity(sanitizeDecimal(text))}
                    autoFocus
                  />
                </VStack>
              </Card.Content>
              <Card.Actions>
                <HStack style={styles.rowBox}>
                  <Button
                    onPress={() => {
                      setPending(null);
                      setView("picker");
                    }}>
                    Cancel
                  </Button>
                  <Button mode="contained" onPress={confirmQuantity}>
                    Done
                  </Button>
                </HStack>
              </Card.Actions>
          </Card>
        )}
      </Modal>
    </Portal>
  );
}
