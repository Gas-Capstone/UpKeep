import { useEffect, useMemo, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useRouter } from "expo-router";
import { ActivityIndicator, Text, Button } from "react-native-paper";

import { HabitAnimatedFAB } from "@/components/habits/HabitAnimatedFAB";
import { Center } from "@/components/ui/center";
import { HStack } from "@/components/ui/hstack";
import { ScreenView } from "@/components/ui/ScreenView";
import { VStack } from "@/components/ui/vstack";
import { styles } from "@/constants/styles";
import { Spacing, TopBadgeInset } from "@/constants/theme";
import { useSession } from "@/hooks/use-session";
import { useTheme } from "@/hooks/use-theme";
import { Ingredient, Recipe, matchRecipes, recipeKey, sortFavoritesFirst } from "@/lib/meals/meals";
import { addRecipeToGroceryList, setMealPlanEntry } from "@/lib/meals/queries";
import { useMealsData } from "@/components/context/mealsDataContext";

import { AddIngredientsModal } from "./AddIngredientsModal";
import { AddToMealPlanModal } from "./AddToMealPlanModal";
import { FridgeModal } from "./FridgeModal";
import { RecipeCard } from "./RecipeCard";
import { AddRecipeModal } from "./AddRecipeModal";
const ERROR_COLOR = "#ff4d4f";

export default function MealsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();

  // Catalog/fridge state now lives in mealsDataContext so index.tsx can read the same data.
  const {
    ingredients,
    recipes,
    catalogLoading,
    catalogError,
    fridgeIds,
    fridgeEntries,
    favoriteIds,
    saveFridge,
    refreshCatalog,
    refreshFridge,
    toggleFavorite,
    createNewRecipe,
    toggleFridgeItem: toggleFridgeItemShared,
  } = useMealsData();

  const [mutationError, setMutationError] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [ createModalVisible, setCreateModalVisible ] = useState(false)
  const [fabExtended, setFabExtended] = useState(true);
  const [fridgeModalVisible, setFridgeModalVisible] = useState(false);
  // Recipe queued for the meal plan, or null when the picker is closed.
  const [planRecipe, setPlanRecipe] = useState<Recipe | null>(null);
  // Recipe currently being queued, so only that card shows a spinner.
  const [addingKey, setAddingKey] = useState<string | null>(null);

  const openFridge = () => {
    // The catalog is otherwise only fetched when the provider mounts, so unit
    // edits made in the DB while the app is running wouldn't show until a
    // full restart.
    refreshCatalog();
    setFridgeModalVisible(true);
  };

  const openRecipe = (recipe: Recipe) => {
    router.navigate({
      pathname: "/recipe",
      // Params serialise to strings, so isCustom is read back as "true"/"false".
      params: { id: String(recipe.id), isCustom: String(recipe.isCustom) },
    });
  };

  const quickAdd = async (recipe: Recipe) => {
    setMutationError("");
    setAddingKey(recipeKey(recipe));
    try {
      await addRecipeToGroceryList(user!.id, recipe);
    } catch (error) {
      setMutationError(
        error instanceof Error
          ? error.message
          : "Couldn't add to your grocery list",
      );
    } finally {
      setAddingKey(null);
    }
  };

  const ingredientName = (id: string) =>
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

  const sortedRecipes = useMemo(
    () => sortFavoritesFirst(recipes, favoriteIds),
    [recipes, favoriteIds],
  );

  const { ready, almost } = useMemo(
    () => matchRecipes(sortedRecipes, fridgeIds),
    [sortedRecipes, fridgeIds],
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
      // ScreenView renders `header` outside the ScrollView, so these stay
      // fixed while the recipe lists scroll underneath.
      header={
        <VStack
          space="sm"
          style={{
            width: "100%",
            paddingHorizontal: Spacing.four,
            paddingTop: TopBadgeInset,
            paddingBottom: Spacing.two,
          }}>
          <HStack space="sm" style={{ width: "100%" }}>
            <Button
              mode="contained-tonal"
              icon="calendar-month"
              style={{ flex: 1 }}
              onPress={() => router.navigate("/mealplan")}>
              Meal plan
            </Button>
            <Button
              mode="contained-tonal"
              icon="cart-outline"
              style={{ flex: 1 }}
              onPress={() => router.navigate("/grocery")}>
              Grocery list
            </Button>
          </HStack>

          <Button mode="contained-tonal" icon="fridge-outline" onPress={openFridge}>
            View fridge
          </Button>
        </VStack>
      }
      overlay={
        <>
          <HabitAnimatedFAB
            extended={fabExtended}
            label="Create recipe"
            visible={!sessionLoading && !catalogLoading && !catalogError}
            onPress={() => setCreateModalVisible(true)}
          />
          <AddIngredientsModal
            visible={modalVisible}
            onDismiss={() => setModalVisible(false)}
            ingredients={ingredients}
            selectedIds={fridgeIds}
            onToggle={toggleFridgeItem}
          />
          <AddRecipeModal
            visible={createModalVisible}
            onDismiss={() => setCreateModalVisible(false)}
            availableIngredients={ingredients}
            onCreate={async (recipe) => {
              await createNewRecipe(recipe);
            }}
          />
          <FridgeModal
            visible={fridgeModalVisible}
            onDismiss={() => setFridgeModalVisible(false)}
            ingredients={ingredients}
            entries={fridgeEntries}
            onSave={saveFridge}
          />
          <AddToMealPlanModal
            visible={planRecipe !== null}
            onDismiss={() => setPlanRecipe(null)}
            recipeName={planRecipe?.name ?? ""}
            onConfirm={(plannedDate, mealType) =>
              setMealPlanEntry(user!.id, planRecipe!, plannedDate, mealType)
            }
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
            {mutationError.length > 0 && (
              <Text style={{ color: ERROR_COLOR }}>{mutationError}</Text>
            )}

            <VStack space="sm" style={{ alignSelf: "stretch" }}>
              <Text variant="titleMedium">Ready to cook</Text>
              {ready.length > 0 ? (
                ready.map(({ recipe, missingIds }) => (
                  <RecipeCard
                    key={recipeKey(recipe)}
                    missingNames={missingIds.map(ingredientName)}
                    recipe={recipe}
                    isFavorited={favoriteIds.has(recipeKey(recipe))}
                    onToggleFavorite={() => toggleFavorite(recipe)}
                    onQuickAdd={() => quickAdd(recipe)}
                    adding={addingKey === recipeKey(recipe)}
                    onAddToPlan={() => setPlanRecipe(recipe)}
                    onOpen={() => openRecipe(recipe)}
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
                    key={recipeKey(recipe)}
                    missingNames={missingIds.map(ingredientName)}
                    recipe={recipe}
                    isFavorited={favoriteIds.has(recipeKey(recipe))}
                    onToggleFavorite={() => toggleFavorite(recipe)}
                    onQuickAdd={() => quickAdd(recipe)}
                    adding={addingKey === recipeKey(recipe)}
                    onAddToPlan={() => setPlanRecipe(recipe)}
                    onOpen={() => openRecipe(recipe)}
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
