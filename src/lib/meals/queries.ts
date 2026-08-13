import { supabase } from "@/lib/supabaseClient";

import type { Ingredient, Recipe } from "./meals";
import { SUPPORTED_TAB_BAR_ITEM_LABEL_VISIBILITY_MODES } from "expo-router/build/native-tabs/types";

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

export async function createRecipe(user, recipe) {
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