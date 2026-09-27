import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ActivityIndicator, Button, Icon, Text } from "react-native-paper";

import { useThemeMode } from "@/components/context/ThemeContext";
import { useMealsData } from "@/components/context/mealsDataContext";
import { Center } from "@/components/ui/center";
import { ScreenView } from "@/components/ui/ScreenView";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useSession } from "@/hooks/use-session";
import {
  Ingredient,
  Recipe,
  matchRecipes,
  recipeKey,
  sortFavoritesFirst,
} from "@/lib/meals/meals";
import { addRecipeToGroceryList, setMealPlanEntry } from "@/lib/meals/queries";

import { AddIngredientsModal } from "./AddIngredientsModal";
import { AddRecipeModal } from "./AddRecipeModal";
import { AddToMealPlanModal } from "./AddToMealPlanModal";
import { FridgeModal } from "./FridgeModal";
import { RecipeCard } from "./RecipeCard";

export default function MealsScreen() {
  const router = useRouter();
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];
  const { user, loading: sessionLoading } = useSession();

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
    toggleFavorite,
    createNewRecipe,
    toggleFridgeItem: toggleFridgeItemShared,
  } = useMealsData();

  const [mutationError, setMutationError] = useState("");
  const [addIngredientsVisible, setAddIngredientsVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [fridgeModalVisible, setFridgeModalVisible] = useState(false);
  const [planRecipe, setPlanRecipe] = useState<Recipe | null>(null);
  const [addingKey, setAddingKey] = useState<string | null>(null);

  const openFridge = () => {
    refreshCatalog();
    setFridgeModalVisible(true);
  };

  const openRecipe = (recipe: Recipe) => {
    router.navigate({
      pathname: "/recipe",
      params: { id: String(recipe.id), isCustom: String(recipe.isCustom) },
    });
  };

  const quickAdd = async (recipe: Recipe) => {
    if (!user?.id) return;

    setMutationError("");
    setAddingKey(recipeKey(recipe));

    try {
      await addRecipeToGroceryList(user.id, recipe);
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
    ingredients.find((ingredient) => ingredient.id === id)?.name ?? "Unknown";

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

  const sortedRecipes = useMemo(
    () => sortFavoritesFirst(recipes, favoriteIds),
    [recipes, favoriteIds],
  );

  const { ready, almost } = useMemo(
    () => matchRecipes(sortedRecipes, fridgeIds),
    [sortedRecipes, fridgeIds],
  );

  const hasCatalogData = ingredients.length > 0 || recipes.length > 0;
  const showInitialLoading =
    (sessionLoading || catalogLoading) && !hasCatalogData;

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
      contentContainerStyle={styles.screenContent}
      overlay={
        <>
          <AddIngredientsModal
            visible={addIngredientsVisible}
            onDismiss={() => setAddIngredientsVisible(false)}
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
      }
    >
      <View style={styles.headingRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <View
              style={[styles.titleIcon, { backgroundColor: colors.brandSoft }]}
            >
              <Icon
                source="silverware-fork-knife"
                size={22}
                color={colors.brand}
              />
            </View>
            <Text
              variant="headlineMedium"
              style={[styles.title, { color: colors.text }]}
            >
              Meals
            </Text>
          </View>

          <Text
            variant="bodyMedium"
            style={{ color: colors.textSecondary, marginTop: Spacing.one }}
          >
            Cook from what you have, or plan what you need next.
          </Text>
        </View>

        <Button
          compact
          mode="text"
          icon="plus"
          onPress={() => setCreateModalVisible(true)}
          textColor={colors.brand}
        >
          New recipe
        </Button>
      </View>

      <View
        style={[
          styles.quickPanel,
          {
            backgroundColor: colors.backgroundElement,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.quickRow}>
          <QuickAction
            icon="calendar-month-outline"
            label="Meal plan"
            onPress={() => router.navigate("/mealplan")}
          />
          <QuickAction
            icon="cart-outline"
            label="Grocery list"
            onPress={() => router.navigate("/grocery")}
          />
        </View>

        <View style={styles.quickRow}>
          <QuickAction
            icon="fridge-outline"
            label="View fridge"
            onPress={openFridge}
          />
          <QuickAction
            icon="basket-plus-outline"
            label="Add ingredients"
            onPress={() => setAddIngredientsVisible(true)}
          />
        </View>
      </View>

      {catalogLoading && hasCatalogData ? (
        <View
          style={[
            styles.refreshingRow,
            {
              backgroundColor: colors.brandSoft,
              borderColor: colors.border,
            },
          ]}
        >
          <ActivityIndicator size="small" color={colors.brand} />
          <Text variant="bodySmall" style={{ color: colors.brandStrong }}>
            Refreshing recipes…
          </Text>
        </View>
      ) : null}

      {showInitialLoading ? (
        <Center style={styles.loadingBox}>
          <ActivityIndicator />
          <Text style={{ color: colors.textSecondary }}>
            Loading your meals…
          </Text>
        </Center>
      ) : catalogError && !hasCatalogData ? (
        <View
          style={[
            styles.messageCard,
            {
              backgroundColor: colors.backgroundElement,
              borderColor: colors.danger,
            },
          ]}
        >
          <Icon source="alert-circle-outline" size={22} color={colors.danger} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.danger, fontWeight: "700" }}>
              {catalogError}
            </Text>
            <Text
              onPress={refreshCatalog}
              style={{ color: colors.brand, marginTop: Spacing.one }}
            >
              Try again
            </Text>
          </View>
        </View>
      ) : (
        <>
          {mutationError ? (
            <View
              style={[
                styles.messageCard,
                {
                  backgroundColor: colors.backgroundElement,
                  borderColor: colors.danger,
                },
              ]}
            >
              <Icon
                source="alert-circle-outline"
                size={20}
                color={colors.danger}
              />
              <Text style={{ color: colors.danger, flex: 1 }}>
                {mutationError}
              </Text>
            </View>
          ) : null}

          <RecipeSectionHeader
            title="Ready to cook"
            subtitle="You already have everything these recipes need."
            count={ready.length}
          />

          <View style={styles.recipeList}>
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
              <EmptyRecipeState
                icon="fridge-outline"
                title="Nothing is fully stocked yet"
                body="Add what you have to your fridge and ready recipes will appear here."
                actionLabel="Update fridge"
                onAction={openFridge}
              />
            )}
          </View>

          <RecipeSectionHeader
            title="Almost there"
            subtitle="A few grocery additions will unlock these meals."
            count={almost.length}
          />

          <View style={styles.recipeList}>
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
              <EmptyRecipeState
                icon="check-circle-outline"
                title="Everything is ready"
                body="Every recipe in your list can be made from what is currently in your fridge."
              />
            )}
          </View>
        </>
      )}
    </ScreenView>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  return (
    <Button
      mode="contained-tonal"
      icon={icon}
      onPress={onPress}
      buttonColor={colors.brandSoft}
      textColor={colors.brandStrong}
      style={styles.quickAction}
      contentStyle={styles.quickActionContent}
    >
      {label}
    </Button>
  );
}

function RecipeSectionHeader({
  title,
  subtitle,
  count,
}: {
  title: string;
  subtitle: string;
  count: number;
}) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text
          variant="titleLarge"
          style={{ color: colors.text, fontWeight: "800" }}
        >
          {title}
        </Text>
        <Text
          variant="bodySmall"
          style={{ color: colors.textSecondary, marginTop: 2 }}
        >
          {subtitle}
        </Text>
      </View>

      <View style={[styles.countBadge, { backgroundColor: colors.brandSoft }]}>
        <Text
          variant="labelMedium"
          style={{ color: colors.brandStrong, fontWeight: "800" }}
        >
          {count}
        </Text>
      </View>
    </View>
  );
}

function EmptyRecipeState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: string;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  return (
    <View
      style={[
        styles.emptyState,
        {
          backgroundColor: colors.backgroundElement,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={[styles.emptyIcon, { backgroundColor: colors.brandSoft }]}>
        <Icon source={icon} size={24} color={colors.brand} />
      </View>
      <Text
        variant="titleMedium"
        style={{ color: colors.text, fontWeight: "800", textAlign: "center" }}
      >
        {title}
      </Text>
      <Text
        variant="bodySmall"
        style={{ color: colors.textSecondary, textAlign: "center" }}
      >
        {body}
      </Text>

      {actionLabel && onAction ? (
        <Button
          mode="contained-tonal"
          onPress={onAction}
          buttonColor={colors.brandSoft}
          textColor={colors.brandStrong}
          style={{ borderRadius: Radius.pill }}
        >
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    gap: Spacing.four,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.two,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  titleIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.medium,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontWeight: "900",
  },
  quickPanel: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  quickRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  quickAction: {
    flex: 1,
    borderRadius: Radius.medium,
  },
  quickActionContent: {
    minHeight: 46,
  },
  loadingBox: {
    paddingVertical: Spacing.six,
    gap: Spacing.three,
  },
  refreshingRow: {
    minHeight: 40,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  messageCard: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  countBadge: {
    minWidth: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.two,
  },
  recipeList: {
    gap: Spacing.three,
  },
  emptyState: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    alignItems: "center",
    gap: Spacing.two,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.medium,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.one,
  },
});
