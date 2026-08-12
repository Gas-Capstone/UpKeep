import { useEffect, useMemo, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { ActivityIndicator, Chip, Text } from "react-native-paper";

import { HabitAnimatedFAB } from "@/components/habits/HabitAnimatedFAB";
import { Center } from "@/components/ui/center";
import { HStack } from "@/components/ui/hstack";
import { ScreenView } from "@/components/ui/ScreenView";
import { VStack } from "@/components/ui/vstack";
import { styles } from "@/constants/styles";
import { Spacing } from "@/constants/theme";
import { useSession } from "@/hooks/use-session";
import { useTheme } from "@/hooks/use-theme";
import { Ingredient, matchRecipes } from "@/lib/meals/meals";
import { useMealsData } from "@/components/context/mealsDataContext";

import { AddIngredientsModal } from "./AddIngredientsModal";
import { RecipeCard } from "./RecipeCard";

const ERROR_COLOR = "#ff4d4f";

export default function MealsScreen() {
  const theme = useTheme();
  const { user, loading: sessionLoading } = useSession();

  // Catalog/fridge state now lives in mealsDataContext so index.tsx can read the same data.
  const {
    ingredients,
    recipes,
    catalogLoading,
    catalogError,
    fridgeIds,
    fridgeLoading,
    refreshCatalog,
    refreshFridge,
    toggleFridgeItem: toggleFridgeItemShared,
  } = useMealsData();

  const [mutationError, setMutationError] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [fabExtended, setFabExtended] = useState(true);



  const ingredientName = (id: number) =>
    ingredients.find((i) => i.id === id)?.name ?? "Unknown";

  // Optimistic update itself now lives in mealsDataContext; this wraps it to surface errors locally.
  const toggleFridgeItem = async (ingredient: Ingredient) => {
    setMutationError("");
    try {
      await toggleFridgeItemShared(ingredient);
    } catch (error) {
      setMutationError(
        error instanceof Error ? error.message : "Couldn't update your fridge",
      );
    }
  };

  const fridgeItems = ingredients.filter((i) => fridgeIds.has(i.id));

  const { ready, almost } = useMemo(
    () => matchRecipes(recipes, fridgeIds),
    [recipes, fridgeIds],
  );

  const onScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    setFabExtended(nativeEvent.contentOffset.y <= 0);
  };


  if (!sessionLoading && !user) {
    return (
      <ScreenView>
        <Center style={{ flex: 1 }}>
          <Text variant="titleMedium">Log in to build your fridge</Text>
        </Center>
      </ScreenView>
    );
  }

  return (
    <ScreenView
      onScroll={onScroll}
      overlay={
        <>
          <HabitAnimatedFAB
            extended={fabExtended}
            label="Add ingredients"
            visible={!sessionLoading && !catalogLoading && !catalogError}
            onPress={() => setModalVisible(true)}
          />
          <AddIngredientsModal
            visible={modalVisible}
            onDismiss={() => setModalVisible(false)}
            ingredients={ingredients}
            selectedIds={fridgeIds}
            onToggle={toggleFridgeItem}
          />
        </>
      }>
      <VStack style={styles.columnContainer} space="md">
        {sessionLoading || catalogLoading ? (
          <Center style={{ paddingVertical: Spacing.five }}>
            <ActivityIndicator />
          </Center>
        ) : catalogError ? (
          <VStack space="sm" style={{ alignSelf: "stretch" }}>
            <Text style={{ color: ERROR_COLOR }}>{catalogError}</Text>
            <Text onPress={refreshCatalog} style={{ color: theme.accentMeals }}>
              Try again
            </Text>
          </VStack>
        ) : (
          <>
            <VStack space="sm" style={{ alignSelf: "stretch" }}>
              <HStack style={styles.rowBox}>
                <Text variant="titleMedium">In my fridge</Text>
                <Text>
                  {fridgeLoading
                    ? "Loading..."
                    : `${fridgeItems.length} ${fridgeItems.length === 1 ? "item" : "items"}`}
                </Text>
              </HStack>

              {fridgeItems.length > 0 ? (
                <HStack space="sm" style={{ flexWrap: "wrap" }}>
                  {fridgeItems.map((item) => (
                    <Chip
                      key={item.id}
                      mode="flat"
                      onClose={() => toggleFridgeItem(item)}
                      textStyle={{ color: theme.accentMeals }}>
                      {item.name}
                    </Chip>
                  ))}
                </HStack>
              ) : (
                <Text>Your fridge is empty — add ingredients to get started.</Text>
              )}

              {mutationError.length > 0 && (
                <Text style={{ color: ERROR_COLOR }}>{mutationError}</Text>
              )}
            </VStack>

            <VStack space="sm" style={{ alignSelf: "stretch" }}>
              <Text variant="titleMedium">Ready to cook</Text>
              {ready.length > 0 ? (
                ready.map(({ recipe, missingIds }) => (
                  <RecipeCard
                    key={recipe.id}
                    missingNames={missingIds.map(ingredientName)}
                    recipe={recipe}
                    isFavorited={false}
                    onToggleFavorite={() => console.log("Favorited: ", recipe.name)}
                  />
                ))
              ) : (
                <Center>
                  <Text>Nothing fully stocked yet...</Text>
                </Center>
              )}
            </VStack>

            <VStack space="md" style={{ alignSelf: "stretch" }}>
              <Text variant="titleMedium">Almost there</Text>
              {almost.length > 0 ? (
                almost.map(({ recipe, missingIds }) => (
                  <RecipeCard
                    key={recipe.id}
                    missingNames={missingIds.map(ingredientName)}
                    recipe={recipe}
                    isFavorited={false}
                    onToggleFavorite={() => console.log("Favorited: ", recipe.name)}
                  />
                ))
              ) : (
                <Center>
                  <Text>You can cook every recipe on the list.</Text>
                </Center>
              )}
            </VStack>
          </>
        )}
      </VStack>
    </ScreenView>
  );
}
