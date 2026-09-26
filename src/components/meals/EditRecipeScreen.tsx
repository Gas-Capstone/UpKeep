import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Button,
  Chip,
  Divider,
  HelperText,
  IconButton,
  Text,
  TextInput,
} from "react-native-paper";

import { useMealsData } from "@/components/context/mealsDataContext";
import { Center } from "@/components/ui/center";
import { HStack } from "@/components/ui/hstack";
import { ScreenView } from "@/components/ui/ScreenView";
import { VStack } from "@/components/ui/vstack";
import { Spacing, TopBadgeInset } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  fetchRecipeDetail,
  replaceCustomRecipeIngredients,
  updateCustomRecipe,
} from "@/lib/meals/queries";

// Quantities are fractional (0.5 lb), capped at two decimal places — the same
// rule the fridge card uses.
function sanitizeDecimal(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  if (rest.length === 0) return whole;
  return `${whole}.${rest.join("").slice(0, 2)}`;
}

// One ingredient line being edited. Amount and unit are text so a half-typed
// field doesn't become NaN.
type IngredientDraft = {
  ingredientId: string;
  quantity: string;
  unit: string;
};

export default function EditRecipeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ingredients, refreshCatalog } = useMealsData();

  const [name, setName] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [drafts, setDrafts] = useState<IngredientDraft[]>([]);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

  const ingredientById = useMemo(
    () => new Map(ingredients.map((ing) => [ing.id, ing])),
    [ingredients],
  );

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    // Always custom: catalog recipes have no menu, so nothing routes here.
    fetchRecipeDetail(String(id), true)
      .then((recipe) => {
        if (cancelled) return;
        setName(recipe.name ?? "");
        setPrepTime(recipe.prepTimeMin !== null ? String(recipe.prepTimeMin) : "");
        setDrafts(
          recipe.ingredients.map((line) => ({
            ingredientId: line.ingredientId,
            quantity: line.quantity !== null ? String(line.quantity) : "",
            unit: line.unit ?? "",
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const chosenIds = useMemo(
    () => new Set(drafts.map((d) => d.ingredientId)),
    [drafts],
  );

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ingredients
      .filter((ing) => !chosenIds.has(ing.id))
      .filter((ing) => (q === "" ? true : ing.name.toLowerCase().includes(q)))
      .slice(0, 12);
  }, [ingredients, chosenIds, query]);

  const updateDraft = (
    ingredientId: string,
    field: "quantity" | "unit",
    value: string,
  ) => {
    setDrafts((current) =>
      current.map((d) =>
        d.ingredientId === ingredientId
          ? {
              ...d,
              [field]: field === "quantity" ? sanitizeDecimal(value) : value,
            }
          : d,
      ),
    );
  };

  const addIngredient = (ingredientId: string) => {
    setDrafts((current) => [
      ...current,
      {
        ingredientId,
        quantity: "1",
        // Seed from the catalog unit so the row starts sensible.
        unit: ingredientById.get(ingredientId)?.unit ?? "",
      },
    ]);
    setQuery("");
    setPicking(false);
  };

  const removeIngredient = (ingredientId: string) => {
    setDrafts((current) => current.filter((d) => d.ingredientId !== ingredientId));
  };

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setError("Give the recipe a name.");
      return;
    }
    if (drafts.length === 0) {
      setError("A recipe needs at least one ingredient.");
      return;
    }
    const minutes = Number(prepTime);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setError("Prep time must be a number greater than 0.");
      return;
    }

    setError("");
    setSaving(true);

    try {
      await updateCustomRecipe(String(id), {
        name: name.trim(),
        prep_time_min: minutes,
      });
      await replaceCustomRecipeIngredients(
        String(id),
        drafts.map((draft) => {
          const quantity = Number(draft.quantity);
          return {
            ingredient_id: draft.ingredientId,
            // Blank amounts stay null rather than becoming 0.
            quantity:
              draft.quantity.trim() !== "" && Number.isFinite(quantity)
                ? quantity
                : null,
            unit: draft.unit.trim() === "" ? null : draft.unit.trim(),
          };
        }),
      );
      refreshCatalog();
      router.back();
    } catch {
      setError("Couldn't save your changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [name, prepTime, drafts, id, refreshCatalog, router]);

  return (
    <ScreenView
      header={
        <VStack
          style={{
            width: "100%",
            paddingHorizontal: Spacing.four,
            paddingTop: TopBadgeInset,
            paddingBottom: Spacing.two,
          }}
        >
          <HStack style={{ alignItems: "center" }}>
            <IconButton
              icon="arrow-left"
              size={24}
              style={{ margin: 0 }}
              onPress={() => router.back()}
              accessibilityLabel="Back"
            />
            <Text variant="titleLarge" style={{ marginLeft: Spacing.two, flex: 1 }}>
              Edit recipe
            </Text>
          </HStack>
        </VStack>
      }
    >
      <VStack space="md" style={{ alignSelf: "stretch" }}>
        {loading ? (
          <Center style={{ paddingVertical: Spacing.five }}>
            <ActivityIndicator />
          </Center>
        ) : notFound ? (
          <Text style={{ color: theme.textSecondary }}>
            That recipe couldn&apos;t be found.
          </Text>
        ) : (
          <>
            <TextInput
              label="Recipe name"
              mode="outlined"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              label="Prep time (minutes)"
              mode="outlined"
              keyboardType="number-pad"
              value={prepTime}
              onChangeText={(text) => setPrepTime(text.replace(/[^0-9]/g, ""))}
            />

            <Divider bold />

            <VStack space="sm" style={{ alignSelf: "stretch" }}>
              <Text variant="titleMedium">Ingredients ({drafts.length})</Text>

              {drafts.map((draft, index) => (
                <View key={draft.ingredientId}>
                  {index > 0 && <Divider />}
                  <HStack
                    style={{ alignItems: "center", paddingVertical: Spacing.one }}
                  >
                    <Text
                      variant="bodyLarge"
                      numberOfLines={1}
                      style={{ flex: 1, minWidth: 0, paddingRight: Spacing.two }}
                    >
                      {ingredientById.get(draft.ingredientId)?.name ??
                        "Unknown ingredient"}
                    </Text>

                    <TextInput
                      label="Qty"
                      mode="outlined"
                      dense
                      keyboardType="decimal-pad"
                      style={{ width: 62 }}
                      value={draft.quantity}
                      onChangeText={(text) =>
                        updateDraft(draft.ingredientId, "quantity", text)
                      }
                    />
                    <TextInput
                      label="Unit"
                      mode="outlined"
                      dense
                      style={{ width: 70, marginLeft: Spacing.one }}
                      value={draft.unit}
                      onChangeText={(text) =>
                        updateDraft(draft.ingredientId, "unit", text)
                      }
                    />

                    <IconButton
                      icon="close"
                      size={18}
                      style={{ margin: 0 }}
                      onPress={() => removeIngredient(draft.ingredientId)}
                      accessibilityLabel={`Remove ${ingredientById.get(draft.ingredientId)?.name ?? "ingredient"}`}
                    />
                  </HStack>
                </View>
              ))}

              {picking ? (
                <VStack space="xs" style={{ alignSelf: "stretch" }}>
                  <TextInput
                    label="Search ingredients"
                    mode="outlined"
                    dense
                    value={query}
                    onChangeText={setQuery}
                    autoCapitalize="none"
                  />
                  <HStack space="sm" style={{ flexWrap: "wrap" }}>
                    {suggestions.map((ing) => (
                      <Chip key={ing.id} onPress={() => addIngredient(ing.id)}>
                        {ing.name}
                      </Chip>
                    ))}
                  </HStack>
                  <Button compact onPress={() => setPicking(false)}>
                    Cancel
                  </Button>
                </VStack>
              ) : (
                <Button
                  compact
                  icon="plus"
                  style={{ alignSelf: "flex-start" }}
                  onPress={() => setPicking(true)}
                >
                  Add ingredient
                </Button>
              )}
            </VStack>

            {error !== "" && (
              <HelperText type="error" visible>
                {error}
              </HelperText>
            )}

            <Button
              mode="contained"
              onPress={handleSave}
              loading={saving}
              disabled={saving}
            >
              Save changes
            </Button>
          </>
        )}
      </VStack>
    </ScreenView>
  );
}
