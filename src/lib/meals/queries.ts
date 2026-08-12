import { supabase } from "@/lib/supabaseClient";

import type { Ingredient, Recipe } from "./meals";

export async function fetchIngredients(): Promise<Ingredient[]> {
  const { data, error } = await supabase
    .from("ingredients")
    .select("id, name, category")
    .order("name");

  if (error) throw error;
  return data;
}

type RecipeRow = {
  id: number;
  name: string;
  prep_time_min: number;
  recipe_ingredients: { ingredient_id: number }[];
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
  }));
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

export async function addFavoriteRecipe(user, recipeId) {
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

export async function removeFavoriteRecipe(user, recipeId) {
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