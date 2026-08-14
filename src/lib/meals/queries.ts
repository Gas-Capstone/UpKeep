import { supabase } from "@/lib/supabaseClient";

import type { Ingredient, Recipe } from "./meals";

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
    .select("id, name, category, calories, unit_type")
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
