import React, { createContext, useCallback, useContext, useState, useEffect } from "react";
import { FridgeEntry, Ingredient, Recipe, recipeKey } from "@/lib/meals/meals";
import {
  addFridgeItem,
  fetchFridgeItems,
  fetchIngredients,
  saveFridgeItems,
  fetchRecipes,
  removeFridgeItem,
  fetchFavoriteRecipes,
  fetchCustomRecipes,
  fetchCustomFavoriteRecipes,
  addFavoriteRecipe,
  removeFavoriteRecipe,
  addCustomFavoriteRecipe,
  removeCustomFavoriteRecipe,
  createRecipe,
  type CreateRecipeInput
} from "@/lib/meals/queries";
import { userContext } from "./userContext";

// Lifted out of MealsScreen's local useState so index.tsx can read the same data.

export type MealsDataContextType = {
  ingredients: Ingredient[];
  recipes: Recipe[];
  catalogLoading: boolean;
  catalogError: string;
  fridgeIds: ReadonlySet<string>;
  // Quantities keyed by ingredient id. fridgeIds is kept alongside it because
  // recipe matching only cares about presence, not amounts.
  fridgeEntries: ReadonlyMap<string, FridgeEntry>;
  fridgeLoading: boolean;
  favoriteIds: Set<string>;
  // Batch write of the whole fridge. Throws on failure so the caller can
  // surface it; state is updated from the saved draft on success.
  saveFridge: (entries: ReadonlyMap<string, FridgeEntry>) => Promise<void>;
  refreshCatalog: () => void;
  refreshFridge: () => void;
  refreshFavorites: () => void;
  // Optimistic toggle — updates fridgeIds immediately, rolls back and
  // re-throws on failure so the caller can surface its own error message.
  toggleFridgeItem: (ingredient: Ingredient) => Promise<void>;
  toggleFavorite: (recipe: Recipe) => void;
  createNewRecipe: (recipe: CreateRecipeInput) => Promise<void>
};

export const mealsDataContext = createContext<MealsDataContextType | null>(null);

type MealsDataProviderProps = {
  children: React.ReactNode;
};

export const MealsDataProvider = ({ children }: MealsDataProviderProps) => {
  const { user } = useContext(userContext) ?? {};
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set())
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [fridgeIds, setFridgeIds] = useState<ReadonlySet<string>>(new Set());
  const [fridgeEntries, setFridgeEntries] = useState<ReadonlyMap<string, FridgeEntry>>(
    new Map(),
  );
  const [fridgeLoading, setFridgeLoading] = useState(false);
  
  const refreshFavorites = useCallback(() => {
    if (!user?.id) return
    Promise.all([
      fetchFavoriteRecipes(user),
      fetchCustomFavoriteRecipes(user),
    ])
      .then(([recipeIds, customRecipeIds]) => {
        setFavoriteIds(new Set([...recipeIds, ...customRecipeIds]))
      })
      .catch((err) => {
        console.log("Error fetching favorite recipes: ", err);
        setFavoriteIds(new Set())
      })
  }, [user?.id])



  const toggleFavorite = useCallback(
    (recipe: Recipe) => {
      if (!user?.id) return;
      const key = recipeKey(recipe);
      const wasFavorited = favoriteIds.has(key);
      
      setFavoriteIds((prev) => {
        const next = new Set(prev)
        if (wasFavorited) next.delete(key)
        else next.add(key)
        return next
      })

      const write = wasFavorited
        ? recipe.isCustom
          ? removeCustomFavoriteRecipe(user, recipe.id)
          : removeFavoriteRecipe(user, recipe.id)
        : recipe.isCustom
          ? addCustomFavoriteRecipe(user, recipe.id)
          : addFavoriteRecipe(user, recipe.id)

      write
        .then((res) => {
          if (res) return
          setFavoriteIds((prev) => {
            const next = new Set(prev)
            if (wasFavorited) next.add(key)
              else next.delete(key)
            return next
          })
        })
        .catch((err) => {
          console.log("Error toggling favorite recipe: ", err)
          setFavoriteIds((prev) => {
            const next = new Set(prev)
            if (wasFavorited) next.add(key)
            else next.delete(key)
            return next
          })
        })
    }, [user?.id, favoriteIds]
  )


  const refreshCatalog = useCallback(() => {
    setCatalogLoading(true);
    setCatalogError("");

    const customRecipesRequest = user?.id
      ? fetchCustomRecipes(user)
      : Promise.resolve<Recipe[]>([])

    Promise.all([
      fetchIngredients(), 
      fetchRecipes(),
      customRecipesRequest,
    ])
      .then(([ingredientRows, recipeRows, customRecipeRows]) => {
        setIngredients(ingredientRows);
        setRecipes([...recipeRows, ...customRecipeRows]);
      })
      .catch((error: Error) => setCatalogError(error.message))
      .finally(() => setCatalogLoading(false));
  }, [user?.id]);

  const refreshFridge = useCallback(() => {
    if (!user?.id) {
      setFridgeIds(new Set());
      setFridgeEntries(new Map());
      return;
    }
    setFridgeLoading(true);
    fetchFridgeItems(user.id)
      .then((entries) => {
        setFridgeEntries(entries);
        setFridgeIds(new Set(entries.keys()));
      })
      .catch(() => {
        // MealsScreen surfaces this via its own error state today; keep
        // this context focused on data, not UI error messaging.
      })
      .finally(() => setFridgeLoading(false));
  }, [user?.id]);

  // Diffs the draft against what's loaded and writes both sides in one pass.
  const saveFridge = useCallback(
    async (entries: ReadonlyMap<string, FridgeEntry>) => {
      if (!user?.id) return;

      const items = [...entries].map(([ingredientId, entry]) => ({
        ingredientId,
        quantity: entry.quantity,
        unit: entry.unit,
      }));
      const removedIngredientIds = [...fridgeEntries.keys()].filter(
        (id) => !entries.has(id),
      );

      await saveFridgeItems(user.id, items, removedIngredientIds);

      setFridgeEntries(new Map(entries));
      setFridgeIds(new Set(entries.keys()));
    },
    [user?.id, fridgeEntries],
  );



  const createNewRecipe = useCallback(
    async (recipe: CreateRecipeInput) => {
      if (!user?.id) return;
      try {
        const created = await createRecipe(user, recipe)
        if (!created) {
          throw new Error("Could not create the recipe.")
        }
        refreshCatalog()
      } catch (err) {
        console.log("Error creating recipe: ", err)
        throw err
      }
    }, [user?.id, refreshCatalog]
  )
  useEffect(() => {
    refreshCatalog()
  }, [refreshCatalog])

  useEffect(() => {
    if (!user?.id) return
    refreshFridge();
    refreshFavorites()
  }, [user, refreshFridge]);

  const toggleFridgeItem = useCallback(
    async (ingredient: Ingredient) => {
      if (!user?.id) return;
      const userId = user.id;
      const id = ingredient.id;
      const had = fridgeIds.has(id);

      // Keep fridgeEntries in step with fridgeIds — a toggle-on defaults to a
      // quantity of 1 in the catalog unit, matching what addFridgeItem writes.
      const applyLocal = (present: boolean) => {
        setFridgeIds((prev) => {
          const next = new Set(prev);
          if (present) next.add(id);
          else next.delete(id);
          return next;
        });
        setFridgeEntries((prev) => {
          const next = new Map(prev);
          if (present) next.set(id, prev.get(id) ?? { quantity: 1, unit: ingredient.unit });
          else next.delete(id);
          return next;
        });
      };

      applyLocal(!had);

      try {
        if (had) await removeFridgeItem(userId, id);
        else await addFridgeItem(userId, id);
      } catch (error) {
        applyLocal(had);
        throw error;
      }
    },
    [user?.id, fridgeIds]
  );

  const contextValue: MealsDataContextType = {
    ingredients,
    recipes,
    catalogLoading,
    catalogError,
    fridgeIds,
    fridgeEntries,
    favoriteIds,
    fridgeLoading,
    saveFridge,
    refreshCatalog,
    refreshFridge,
    refreshFavorites,
    toggleFridgeItem,
    toggleFavorite,
    createNewRecipe
  };

  return (
    <mealsDataContext.Provider value={contextValue}>
      {children}
    </mealsDataContext.Provider>
  );
};

// Use this instead of `useContext(mealsDataContext)` — throws a clear error if <MealsDataProvider> isn't mounted.
export function useMealsData() {
  const ctx = useContext(mealsDataContext);
  if (!ctx) {
    throw new Error("useMealsData must be used within a <MealsDataProvider>");
  }
  return ctx;
}
