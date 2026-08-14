import { useCallback, useMemo, useState } from "react";
import { View, ViewStyle } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Button,
  Checkbox,
  Divider,
  IconButton,
  Text,
} from "react-native-paper";

import { useMealsData } from "@/components/context/mealsDataContext";
import { Center } from "@/components/ui/center";
import { HStack } from "@/components/ui/hstack";
import { ScreenView } from "@/components/ui/ScreenView";
import { VStack } from "@/components/ui/vstack";
import { Spacing, TopBadgeInset } from "@/constants/theme";
import { useSession } from "@/hooks/use-session";
import { useTheme } from "@/hooks/use-theme";
import { GroceryItem, GrocerySource } from "@/lib/meals/meals";
import {
  addGroceryItem,
  addIngredientToFridge,
  clearCheckedGroceryItems,
  fetchGroceryItems,
  removeGroceryItem,
  setGroceryItemChecked,
} from "@/lib/meals/queries";

import { AddGroceryItemModal } from "./AddGroceryItemModal";

const ERROR_COLOR = "#ff4d4f";

// "combined" isn't a source value — it means no filter at all, so manually
// added items show up there too rather than being invisible.
type ListFilter = "meal_plan" | "recipe" | "combined";

function FilterButton({
  label,
  selected,
  onPress,
  style,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: ViewStyle;
}) {
  return (
    <Button
      mode={selected ? "contained" : "outlined"}
      onPress={onPress}
      style={style}
      accessibilityState={{ selected }}>
      {label}
    </Button>
  );
}

export default function GroceryListScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const { ingredients, refreshFridge } = useMealsData();

  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<ListFilter>("combined");
  const [addVisible, setAddVisible] = useState(false);

  const addItem = async (item: {
    ingredientId: string | null;
    customName: string | null;
    quantity: number | null;
    unit: string | null;
    source: GrocerySource;
  }) => {
    if (!user?.id) return;
    await addGroceryItem(user.id, item);
    // Refetch rather than pushing locally — the row's id and created_at come
    // from the database, and ordering depends on created_at.
    refresh();
  };

  // The whole ingredient, not just its name — checking an item off also needs
  // its catalog unit as a fallback.
  const ingredientById = useMemo(
    () => new Map(ingredients.map((ing) => [ing.id, ing])),
    [ingredients],
  );

  const refresh = useCallback(() => {
    if (!user?.id) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchGroceryItems(user.id)
      .then(setItems)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user?.id]);

  // Reload on focus so items queued from a recipe show up on arrival.
  useFocusEffect(refresh);

  const displayName = (item: GroceryItem) =>
    item.customName ??
    (item.ingredientId !== null
      ? ingredientById.get(item.ingredientId)?.name
      : undefined) ??
    "Unknown item";

  const visible = useMemo(
    () => (filter === "combined" ? items : items.filter((i) => i.source === filter)),
    [items, filter],
  );

  const pending = visible.filter((item) => !item.checked);
  const completed = visible.filter((item) => item.checked);

  // Optimistic: the row moves between sections immediately, and is put back
  // if the write fails.
  const toggleChecked = async (item: GroceryItem) => {
    setError("");
    const next = !item.checked;
    setItems((current) =>
      current.map((i) => (i.id === item.id ? { ...i, checked: next } : i)),
    );
    try {
      await setGroceryItemChecked(item.id, next);
    } catch (err) {
      setItems((current) =>
        current.map((i) => (i.id === item.id ? { ...i, checked: item.checked } : i)),
      );
      setError(err instanceof Error ? err.message : "Couldn't update that item");
      return;
    }

    // Checking something off means you bought it, so it lands in the fridge —
    // but only for catalog-linked rows. Free-text items ("paper towels") have
    // no ingredient to put there.
    if (!next || item.ingredientId === null || !user?.id) return;

    const ingredient = ingredientById.get(item.ingredientId);
    try {
      await addIngredientToFridge(
        user.id,
        item.ingredientId,
        // Grocery quantities are optional; the fridge needs a number.
        item.quantity ?? 1,
        item.unit ?? ingredient?.unit ?? "",
      );
      // Keeps the fridge modal and recipe matching in step without a reload.
      refreshFridge();
    } catch (err) {
      // The item is checked either way — this is a follow-on action, so it
      // reports rather than undoing the check.
      setError(
        err instanceof Error ? err.message : "Couldn't add that to your fridge",
      );
    }
  };

  const removeItem = async (item: GroceryItem) => {
    setError("");
    const previous = items;
    setItems((current) => current.filter((i) => i.id !== item.id));
    try {
      await removeGroceryItem(item.id);
    } catch (err) {
      setItems(previous);
      setError(err instanceof Error ? err.message : "Couldn't remove that item");
    }
  };

  const clearCompleted = async () => {
    if (!user?.id) return;
    setError("");
    const previous = items;
    // Only clears what's checked in the *current* filter's view; other lists
    // keep their completed items.
    const clearedIds = new Set(completed.map((i) => i.id));
    setItems((current) => current.filter((i) => !clearedIds.has(i.id)));
    try {
      if (filter === "combined") {
        await clearCheckedGroceryItems(user.id);
      } else {
        await Promise.all(completed.map((item) => removeGroceryItem(item.id)));
      }
    } catch (err) {
      setItems(previous);
      setError(err instanceof Error ? err.message : "Couldn't clear completed items");
    }
  };

  const renderRow = (item: GroceryItem, index: number) => (
    <View key={item.id}>
      {index > 0 && <Divider />}
      {/* Deliberately not a Card — these read as one continuous list, with
          dividers rather than separate enclosing surfaces. */}
      <HStack style={{ alignItems: "center", paddingVertical: Spacing.one }}>
        <Checkbox
          status={item.checked ? "checked" : "unchecked"}
          onPress={() => toggleChecked(item)}
        />

        <VStack style={{ flex: 1, minWidth: 0, paddingHorizontal: Spacing.two }}>
          <Text
            variant="bodyLarge"
            numberOfLines={1}
            style={
              item.checked
                ? { textDecorationLine: "line-through", color: theme.textSecondary }
                : undefined
            }>
            {displayName(item)}
          </Text>
          {item.quantity !== null && (
            <Text
              variant="labelSmall"
              numberOfLines={1}
              style={{ color: theme.textSecondary }}>
              {item.quantity} {item.unit ?? ""}
            </Text>
          )}
        </VStack>

        <IconButton
          icon="close"
          size={18}
          style={{ margin: 0 }}
          onPress={() => removeItem(item)}
          accessibilityLabel={`Remove ${displayName(item)} from grocery list`}
        />
      </HStack>
    </View>
  );

  return (
    <ScreenView
      // Back arrow and the list switcher stay put while the list scrolls.
      header={
        <VStack
          space="sm"
          style={{
            width: "100%",
            paddingHorizontal: Spacing.four,
            paddingTop: TopBadgeInset,
            paddingBottom: Spacing.two,
          }}>
          <HStack style={{ alignItems: "center" }}>
            <IconButton
              icon="arrow-left"
              size={24}
              style={{ margin: 0 }}
              onPress={() => router.navigate("/meals")}
              accessibilityLabel="Back to meals"
            />
            <Text variant="titleLarge" style={{ marginLeft: Spacing.two, flex: 1 }}>
              Grocery list
            </Text>
            <Button
              mode="contained-tonal"
              icon="plus"
              compact
              onPress={() => setAddVisible(true)}
              accessibilityLabel="Add an item to the grocery list">
              Add item
            </Button>
          </HStack>

          {/* Not SegmentedButtons: that lays its options out in a single row,
              and Combined needs its own full-width row above the other two. */}
          <FilterButton
            label="Combined"
            selected={filter === "combined"}
            onPress={() => setFilter("combined")}
          />
          <HStack space="sm" style={{ alignSelf: "stretch" }}>
            <FilterButton
              label="Meal plan"
              selected={filter === "meal_plan"}
              onPress={() => setFilter("meal_plan")}
              style={{ flex: 1 }}
            />
            <FilterButton
              label="Quick add"
              selected={filter === "recipe"}
              onPress={() => setFilter("recipe")}
              style={{ flex: 1 }}
            />
          </HStack>
        </VStack>
      }
      overlay={
        <AddGroceryItemModal
          visible={addVisible}
          onDismiss={() => setAddVisible(false)}
          // Adding from Combined has no list to infer, so it falls back to
          // "manual", which Combined still shows.
          defaultSource={filter === "combined" ? "manual" : filter}
          ingredients={ingredients}
          onAdd={addItem}
        />
      }>
      <VStack space="md" style={{ alignSelf: "stretch" }}>
        {sessionLoading || loading ? (
          <Center style={{ paddingVertical: Spacing.five }}>
            <ActivityIndicator />
          </Center>
        ) : (
          <>
            {error !== "" && <Text style={{ color: ERROR_COLOR }}>{error}</Text>}

            {pending.length === 0 ? (
              <Text style={{ color: theme.textSecondary }}>
                Nothing on this list yet.
              </Text>
            ) : (
              <VStack style={{ alignSelf: "stretch" }}>
                {pending.map(renderRow)}
              </VStack>
            )}

            {completed.length > 0 && (
              <VStack space="sm" style={{ alignSelf: "stretch" }}>
                <HStack
                  style={{
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                  }}>
                  <Text variant="titleMedium">Completed ({completed.length})</Text>
                  <Button compact onPress={clearCompleted}>
                    Clear completed
                  </Button>
                </HStack>
                <VStack style={{ alignSelf: "stretch" }}>
                  {completed.map(renderRow)}
                </VStack>
              </VStack>
            )}
          </>
        )}
      </VStack>
    </ScreenView>
  );
}
