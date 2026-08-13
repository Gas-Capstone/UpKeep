import React, { createContext, useCallback, useContext, useState, useEffect } from "react";
import { Ingredient, Recipe } from "@/lib/meals/meals";
import {
  addFridgeItem,
  fetchFridgeItemIds,
  fetchIngredients,
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
  fridgeIds: ReadonlySet<number>;
  fridgeLoading: boolean;
  favoriteIds: Set<string>;
  refreshCatalog: () => void;
  refreshFridge: () => void;
  refreshFavorites: () => void;
  // Optimistic toggle — updates fridgeIds immediately, rolls back and
  // re-throws on failure so the caller can surface its own error message.
  toggleFridgeItem: (ingredient: Ingredient) => Promise<void>;
  toggleFavorite: (recipe: Recipe) => void;
  createNewRecipe: (recipe: CreateRecipeInput) => Promise<boolean | undefined>
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
  const [fridgeIds, setFridgeIds] = useState<ReadonlySet<number>>(new Set());
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
      const recipeId = String(recipe.id);
      const wasFavorited = favoriteIds.has(recipeId);
      
      setFavoriteIds((prev) => {
        const next = new Set(prev)
        if (wasFavorited) next.delete(recipeId)
        else next.add(recipeId)
        return next
      })

      const write = wasFavorited
        ? recipe.isCustom
          ? removeCustomFavoriteRecipe(user, recipeId)
          : removeFavoriteRecipe(user, recipeId)
        : recipe.isCustom
          ? addCustomFavoriteRecipe(user, recipeId)
          : addFavoriteRecipe(user, recipeId)

      write
        .then((res) => {
          if (res) return
          setFavoriteIds((prev) => {
            const next = new Set(prev)
            if (wasFavorited) next.add(recipeId)
              else next.delete(recipeId)
            return next
          })
        })
        .catch((err) => {
          console.log("Error toggling favorite recipe: ", err)
          setFavoriteIds((prev) => {
            const next = new Set(prev)
            if (wasFavorited) next.add(recipeId)
            else next.delete(recipeId)
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
      return;
    }
    setFridgeLoading(true);
    fetchFridgeItemIds(user.id)
      .then((ids) => setFridgeIds(new Set(ids)))
      .catch(() => {
        // MealsScreen surfaces this via its own error state today; keep
        // this context focused on data, not UI error messaging.
      })
      .finally(() => setFridgeLoading(false));
  }, [user?.id]);



  const createNewRecipe = useCallback(
    async (recipe: CreateRecipeInput) => {
      if (!user?.id) return;
      try {
        const created = await createRecipe(user, recipe)
        if (!created) return false
        refreshCatalog()
        return true
      } catch (err) {
        console.log("Error creating recipe: ", err)
        return false
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

      setFridgeIds((prev) => {
        const next = new Set(prev);
        if (had) next.delete(id);
        else next.add(id);
        return next;
      });

      try {
        if (had) await removeFridgeItem(userId, id);
        else await addFridgeItem(userId, id);
      } catch (error) {
        setFridgeIds((prev) => {
          const next = new Set(prev);
          if (had) next.add(id);
          else next.delete(id);
          return next;
        });
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
    favoriteIds,
    fridgeLoading,
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
