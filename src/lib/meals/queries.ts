import { supabase } from "@/lib/supabaseClient";

import type { Ingredient, Recipe } from "./meals";
import { SUPPORTED_TAB_BAR_ITEM_LABEL_VISIBILITY_MODES } from "expo-router/build/native-tabs/types";

type IngredientRow = {
  id: number;
  name: string;
  category: string;
  calories: number;
  unit_type: string;
};

export async function fetchIngredients(): Promise<Ingredient[]> {
  const { data, error } = await supabase
    .from("ingredients")
    .select("id, name, category, calories, unit")
    .order("name")
    .returns<IngredientRow[]>();

  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    calories: row.calories,
    unitType: row.unit_type,
  }));
}

type RecipeRow = {
  id: number;
  name: string;
  prep_time_min: number;
  recipe_ingredients: { ingredient_id: number }[];
};

type CustomRecipeRow = {
  id: number;
  name: string;
  prep_time_min: number;
  custom_recipe_ingredients: { ingredient_id: number }[]
}

type RecipeIngredientInput = {
  ingredient_id: number;
  quantity?: number;
  unit?: string;
};

export type CreateRecipeInput = {
  name: string;
  prep_time_min?: number;
  instructions?: string;
  image_url?: string;
  calories?: number;
  protein_g?: number;
  ingredients: RecipeIngredientInput[];
};

export async function fetchRecipes(): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select("id, name, prep_time_min, recipe_ingredients(ingredient_id)")
    .order("name")
    .returns<RecipeRow[]>();

  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    prepTimeMin: row.prep_time_min,
    ingredientIds: row.recipe_ingredients.map((ri) => ri.ingredient_id),
    isCustom: false,
  }));
}

export async function fetchCustomRecipes(user: { id: string }): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from("custom_recipes")
    .select("id, name, prep_time_min, custom_recipe_ingredients(ingredient_id)")
    .eq("user_id", user.id)
    .order("name")
    .returns<CustomRecipeRow[]>()

    if (error) throw error;

    return data.map((row) => ({
      id: row.id,
      name: row.name,
      prepTimeMin: row.prep_time_min,
      ingredientIds: row.custom_recipe_ingredients.map((i) => i.ingredient_id),
      isCustom: true,
    }))
}

export async function fetchFridgeItemIds(userId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from("fridge_items")
    .select("ingredient_id")
    .eq("user_id", userId);

  if (error) throw error;
  return data.map((row) => row.ingredient_id);
}

export async function addFridgeItem(userId: string, ingredientId: number): Promise<void> {
  const { error } = await supabase
    .from("fridge_items")
    .upsert(
      { user_id: userId, ingredient_id: ingredientId },
      { onConflict: "user_id,ingredient_id" },
    );

  if (error) throw error;
}

export async function removeFridgeItem(userId: string, ingredientId: number): Promise<void> {
  const { error } = await supabase
    .from("fridge_items")
    .delete()
    .eq("user_id", userId)
    .eq("ingredient_id", ingredientId);

  if (error) throw error;
}

export async function fetchFavoriteRecipes(user: { id: string }) {
  const { data, error } = await supabase
    .from("favorite_recipes")
    .select("recipe_id")
    .eq("user_id", user.id)
  if (error) console.log("Error fetching favorite recipes: ", error)
  return (data ?? []).map((row) => String(row.recipe_id))
}

export async function fetchCustomFavoriteRecipes(user: { id: string }) {
  const { data, error } = await supabase
    .from("favorite_custom_recipes")
    .select("custom_recipe_id")
    .eq("user_id", user.id);

  if (error) throw error;
  return (data ?? []).map((row) => String(row.custom_recipe_id));
}

export async function addFavoriteRecipe(
  user: { id: string },
  recipeId: string | number,
) {
  const { error } = await supabase
    .from("favorite_recipes")
    .insert({
      user_id: user.id,
      recipe_id: recipeId
    })
    if (error) {
      console.log("Error favoriting recipe: ", error)
      return false
    }
    return true
}

export async function removeFavoriteRecipe(
  user: { id: string },
  recipeId: string | number,
) {
  const { error } = await supabase
    .from("favorite_recipes")
    .delete()
    .eq("user_id", user.id)
    .eq("recipe_id", recipeId)
  
  if (error) {
    console.log("Error unfavoriting recipe: ", error)
    return false
  }
  return true
}

export async function addCustomFavoriteRecipe(
  user: { id: string },
  recipeId: string | number,
) {
  const { error } = await supabase
    .from("favorite_custom_recipes")
    .insert({
      user_id: user.id,
      custom_recipe_id: recipeId,
    });

  if (error) {
    console.log("Error favoriting custom recipe: ", error);
    return false;
  }
  return true;
}

export async function removeCustomFavoriteRecipe(
  user: { id: string },
  recipeId: string | number,
) {
  const { error } = await supabase
    .from("favorite_custom_recipes")
    .delete()
    .eq("user_id", user.id)
    .eq("custom_recipe_id", recipeId);

  if (error) {
    console.log("Error unfavoriting custom recipe: ", error);
    return false;
  }
  return true;
}

export async function createRecipe(
  user: { id: string },
  recipe: CreateRecipeInput,
) {
  // because of the relationship in the db with recipes and ingredients, there will be two insertions in this function
  const { data: recipeData, error: recipeError } = await supabase
    .from("custom_recipes")
    .insert({
      user_id: user.id,
      name: recipe.name,
      prep_time_min: recipe.prep_time_min ?? null,
      instructions: recipe.instructions ?? null,
      image_url: recipe.image_url ?? null,
      calories: recipe.calories ?? null,
      protein_g: recipe.protein_g ?? null
    })
    .select("id")
    .single();
    if (recipeError) {
      console.log("Error inserting custom recipe: ", recipeError)
      return false
    }

    const ingredientRows = recipe.ingredients.map((i) => ({
      custom_recipe_id: recipeData?.id,
      ingredient_id: i.ingredient_id,
      quantity: i.quantity ?? 1,
      unit: i.unit ?? null,
    }))

    const { error: ingredientError } = await supabase
      .from("custom_recipe_ingredients")
      .insert(ingredientRows)
    
    if (ingredientError) {
      await supabase
        .from("custom_recipes")
        .delete()
        .eq("id", recipeData.id)

      console.log("Error creating custom recipe ingredients relation: ", ingredientError)
      return false
    }

    return true
}