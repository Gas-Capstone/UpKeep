import { useState } from "react";
import { ScrollView, View } from "react-native";
import {
  Button,
  Card,
  Divider,
  HelperText,
  Menu,
  Modal,
  Portal,
  Text,
  TextInput,
} from "react-native-paper";

import { useMealsData } from "@/components/context/mealsDataContext";
import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { styles } from "@/constants/styles";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { applyFridgeUses, sameUnit, suggestedAmount } from "@/lib/meals/fridgeUsage";
import { RecipeDetail, formatAmount, sanitizeDecimal } from "@/lib/meals/meals";

type UpdateFridgeModalProps = {
  recipe: RecipeDetail;
  // Back to cooking without touching the fridge or the saved progress.
  onDismiss: () => void;
  // Called once the fridge is saved, or skipped — cooking is over either way.
  onFinished: () => void;
};

// One recipe line: which fridge item it came out of (itself, a swapped-in
// substitute, or nothing), and how much was used, as typed.
type Row = {
  ingredientId: string;
  quantity: number | null;
  unit: string | null;
  sourceId: string | null;
  amountText: string;
};

/**
 * Shown when cooking finishes: what the recipe used, taken out of the fridge
 * in one save. Amounts are in each fridge item's own unit and can be edited,
 * swapped onto a different fridge item, or cleared to leave that item alone.
 *
 * Mount it only while it's open — rows are seeded from the fridge on mount.
 */
export function UpdateFridgeModal({ recipe, onDismiss, onFinished }: UpdateFridgeModalProps) {
  const theme = useTheme();
  const { ingredients, fridgeEntries, saveFridge } = useMealsData();
  const nameById = new Map(ingredients.map((ing) => [ing.id, ing.name]));
  const nameOf = (id: string) => nameById.get(id) ?? "Unknown ingredient";

  const [rows, setRows] = useState<Row[]>(() =>
    recipe.ingredients.map((line) => {
      const entry = fridgeEntries.get(line.ingredientId);
      return {
        ...line,
        sourceId: entry ? line.ingredientId : null,
        amountText: suggestedAmount(line, entry),
      };
    }),
  );
  const [swapMenuFor, setSwapMenuFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateRow = (ingredientId: string, changes: Partial<Row>) =>
    setRows((current) =>
      current.map((row) => (row.ingredientId === ingredientId ? { ...row, ...changes } : row)),
    );

  const swapTo = (row: Row, sourceId: string) => {
    setSwapMenuFor(null);
    updateRow(row.ingredientId, {
      sourceId,
      amountText: suggestedAmount(row, fridgeEntries.get(sourceId)),
    });
  };

  const saveAndFinish = async () => {
    const uses = rows.flatMap((row) =>
      row.sourceId && row.amountText !== ""
        ? [{ ingredientId: row.sourceId, amount: Number(row.amountText) }]
        : [],
    );
    if (uses.length === 0) {
      onFinished();
      return;
    }

    setError("");
    setSaving(true);
    try {
      await saveFridge(applyFridgeUses(fridgeEntries, uses));
      onFinished();
    } catch {
      // The fridge is only replaced after a successful save, so nothing has
      // changed and the user can simply try again.
      setError("Couldn't update your fridge. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      {/* Not dismissable mid-save: closing it would leave the save running
          with nowhere to show an error, then exit cooking out of nowhere. */}
      <Modal
        visible
        dismissable={!saving}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContent}
      >
        <Card mode="contained" style={styles.modalCard}>
          <Card.Title title={<Text variant="titleLarge">Update your fridge</Text>} />
          <Card.Content>
            <Text style={{ color: theme.textSecondary, marginBottom: Spacing.three }}>
              Here&apos;s what {recipe.name} used. Change any amount that&apos;s different, or
              clear it to leave that item alone.
            </Text>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <VStack style={{ alignSelf: "stretch" }}>
                {rows.map((row, index) => {
                  const entry = row.sourceId ? fridgeEntries.get(row.sourceId) : undefined;
                  const swapped = row.sourceId !== null && row.sourceId !== row.ingredientId;
                  const swapOptions = [...fridgeEntries.keys()].filter((id) => id !== row.sourceId);
                  const uses =
                    row.quantity === null
                      ? "Recipe doesn't say how much"
                      : `Recipe uses ${formatAmount({ quantity: row.quantity, unit: row.unit ?? "" })}`;

                  return (
                    <View key={row.ingredientId}>
                      {index > 0 && <Divider />}
                      <VStack space="xs" style={{ paddingVertical: Spacing.two }}>
                        <Text variant="titleSmall">
                          {swapped && row.sourceId
                            ? `${nameOf(row.sourceId)} (instead of ${nameOf(row.ingredientId)})`
                            : nameOf(row.ingredientId)}
                        </Text>
                        <Text variant="bodySmall" style={{ color: theme.textSecondary }}>
                          {uses} · {entry ? `You have ${formatAmount(entry)}` : "Not in your fridge"}
                        </Text>

                        {entry && row.quantity !== null && !sameUnit(row.unit, entry.unit) && (
                          <Text variant="bodySmall" style={{ color: theme.warning }}>
                            Different units, so enter how much you used.
                          </Text>
                        )}

                        <HStack space="sm" style={{ alignItems: "center", flexWrap: "wrap" }}>
                          {entry && (
                            <>
                              <TextInput
                                mode="outlined"
                                dense
                                keyboardType="decimal-pad"
                                label={`Used${entry.unit ? ` (${entry.unit})` : ""}`}
                                placeholder="None"
                                value={row.amountText}
                                onChangeText={(text) =>
                                  updateRow(row.ingredientId, { amountText: sanitizeDecimal(text) })
                                }
                                style={{ width: 120 }}
                                accessibilityLabel={`Amount of ${nameOf(row.sourceId ?? row.ingredientId)} used`}
                              />
                              <Button
                                compact
                                onPress={() =>
                                  updateRow(row.ingredientId, { amountText: String(entry.quantity) })
                                }
                              >
                                All
                              </Button>
                            </>
                          )}

                          {(swapOptions.length > 0 || swapped) && (
                            <Menu
                              visible={swapMenuFor === row.ingredientId}
                              onDismiss={() => setSwapMenuFor(null)}
                              anchor={
                                <Button
                                  compact
                                  icon="swap-horizontal"
                                  onPress={() => setSwapMenuFor(row.ingredientId)}
                                >
                                  Swap
                                </Button>
                              }
                            >
                              {swapped && fridgeEntries.has(row.ingredientId) && (
                                <Menu.Item
                                  leadingIcon="undo"
                                  title={`Back to ${nameOf(row.ingredientId)}`}
                                  onPress={() => swapTo(row, row.ingredientId)}
                                />
                              )}
                              {swapOptions.map((id) => (
                                <Menu.Item key={id} title={nameOf(id)} onPress={() => swapTo(row, id)} />
                              ))}
                            </Menu>
                          )}
                        </HStack>
                      </VStack>
                    </View>
                  );
                })}
              </VStack>
            </ScrollView>

            {error !== "" && (
              <HelperText type="error" visible>
                {error}
              </HelperText>
            )}
          </Card.Content>
          <Card.Actions>
            <HStack style={styles.rowBox}>
              <Button onPress={onFinished} disabled={saving}>
                Skip
              </Button>
              <Button mode="contained" onPress={saveAndFinish} loading={saving} disabled={saving}>
                Update fridge
              </Button>
            </HStack>
          </Card.Actions>
        </Card>
      </Modal>
    </Portal>
  );
}
