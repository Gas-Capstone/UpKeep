import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Divider, Icon, IconButton, Text } from "react-native-paper";

import { useMealsData } from "@/components/context/mealsDataContext";
import { Center } from "@/components/ui/center";
import { HStack } from "@/components/ui/hstack";
import { ScreenView } from "@/components/ui/ScreenView";
import { VStack } from "@/components/ui/vstack";
import { Spacing, TopBadgeInset } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { RecipeDetail, parseInstructionSteps } from "@/lib/meals/meals";
import { fetchRecipeDetail } from "@/lib/meals/queries";

const ERROR_COLOR = "#ff4d4f";
const HAVE_COLOR = "#4CAF50";

export default function RecipeDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { ingredients, fridgeIds } = useMealsData();
  // Params always arrive as strings, so both need converting back.
  const { id, isCustom } = useLocalSearchParams<{ id: string; isCustom: string }>();

  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const ingredientById = useMemo(
    () => new Map(ingredients.map((ing) => [ing.id, ing])),
    [ingredients],
  );

  const load = useCallback(() => {
    // Ids are passed through as-is, never parsed as numbers — `recipes.id` is
    // a uuid in the database even though the codebase types it as `number`.
    if (!id) {
      setError("That recipe couldn't be found.");
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchRecipeDetail(id, isCustom === "true")
      .then(setRecipe)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isCustom]);

  useFocusEffect(load);

  const steps = parseInstructionSteps(recipe?.instructions ?? null);

  return (
    <ScreenView
      header={
        <VStack
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
              onPress={() => router.back()}
              accessibilityLabel="Back"
            />
          </HStack>
        </VStack>
      }>
      <VStack space="md" style={{ alignSelf: "stretch" }}>
        {loading ? (
          <Center style={{ paddingVertical: Spacing.five }}>
            <ActivityIndicator />
          </Center>
        ) : error !== "" || !recipe ? (
          <Text style={{ color: ERROR_COLOR }}>
            {error || "That recipe couldn't be found."}
          </Text>
        ) : (
          <>
            <VStack space="sm" style={{ alignSelf: "stretch" }}>
              <Text variant="headlineSmall">{recipe.name}</Text>

              {/* Only the stats that actually have values — a recipe with no
                  calories recorded shouldn't show "— cal". */}
              <HStack space="md" style={{ flexWrap: "wrap" }}>
                {recipe.prepTimeMin !== null && (
                  <Stat label="Time" value={`${recipe.prepTimeMin} min`} />
                )}
                {recipe.calories !== null && (
                  <Stat label="Calories" value={`${recipe.calories}`} />
                )}
                {recipe.proteinG !== null && (
                  <Stat label="Protein" value={`${recipe.proteinG} g`} />
                )}
              </HStack>
            </VStack>

            <Divider bold />

            <VStack space="sm" style={{ alignSelf: "stretch" }}>
              <Text variant="titleMedium">Ingredients</Text>
              {recipe.ingredients.length === 0 ? (
                <Text style={{ color: theme.textSecondary }}>
                  No ingredients listed.
                </Text>
              ) : (
                recipe.ingredients.map((line) => {
                  const ingredient = ingredientById.get(line.ingredientId);
                  const have = fridgeIds.has(line.ingredientId);
                  const amount = [line.quantity, line.unit]
                    .filter((part) => part !== null && part !== "")
                    .join(" ");

                  return (
                    <HStack
                      key={line.ingredientId}
                      style={{ alignItems: "center", paddingVertical: Spacing.one }}>
                      {/* Checkmark for stocked, empty circle for missing —
                          colour alone wouldn't distinguish them. */}
                      <Icon
                        source={have ? "check-circle" : "circle-outline"}
                        size={20}
                        color={have ? HAVE_COLOR : theme.textSecondary}
                      />
                      <Text
                        style={{
                          flex: 1,
                          minWidth: 0,
                          marginLeft: Spacing.two,
                          color: have ? theme.text : theme.textSecondary,
                        }}>
                        {ingredient?.name ?? "Unknown ingredient"}
                      </Text>
                      {amount !== "" && (
                        <Text
                          variant="labelMedium"
                          style={{ color: theme.textSecondary }}>
                          {amount}
                        </Text>
                      )}
                    </HStack>
                  );
                })
              )}
            </VStack>

            <Divider bold />

            <VStack space="sm" style={{ alignSelf: "stretch" }}>
              <Text variant="titleMedium">Steps</Text>
              {steps.length === 0 ? (
                <Text style={{ color: theme.textSecondary }}>
                  No instructions recorded for this recipe.
                </Text>
              ) : (
                steps.map((step, index) => (
                  <HStack
                    key={index}
                    style={{ alignItems: "flex-start", paddingVertical: Spacing.one }}>
                    <Text
                      variant="labelLarge"
                      style={{ width: 24, color: theme.accentMeals }}>
                      {index + 1}
                    </Text>
                    <Text style={{ flex: 1, minWidth: 0 }}>{step}</Text>
                  </HStack>
                ))
              )}
            </VStack>
          </>
        )}
      </VStack>
    </ScreenView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View>
      <Text variant="labelSmall" style={{ color: theme.textSecondary }}>
        {label}
      </Text>
      <Text variant="titleSmall">{value}</Text>
    </View>
  );
}
