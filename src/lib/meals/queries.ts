import { supabase } from "@/lib/supabaseClient";

import {
  recipeKey,
  type FridgeEntry,
  type GroceryItem,
  type GrocerySource,
  type Ingredient,
  type Recipe,
  type RecipeDetail,
} from "./meals";
import type { MealPlanEntry, MealType } from "./mealPlan";

type IngredientRow = {
  id: string;
  name: string;
  category: string;
  calories: number;
  unit: string;
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
    unit: row.unit,
  }));
}

type RecipeRow = {
  id: string;
  name: string;
  prep_time_min: number;
  recipe_ingredients: { ingredient_id: string }[];
};

type CustomRecipeRow = {
  id: string;
  name: string;
  prep_time_min: number;
  custom_recipe_ingredients: { ingredient_id: string }[]
}

type RecipeIngredientInput = {
  ingredient_id: string;
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

type RecipeDetailRow = {
  id: string;
  name: string;
  prep_time_min: number | null;
  calories: number | null;
  protein_g: number | null;
  instructions: string | null;
};

/**
 * One recipe with everything the detail page needs. Catalog and custom
 * recipes live in separate tables with matching shapes, so `isCustom` picks
 * both the recipe table and the join table its ingredients come from.
 */
export async function fetchRecipeDetail(
  // Accepts the raw id: `recipes.id` is a uuid in the database, so coercing to
  // a number here would produce NaN and match nothing.
  recipeId: string | number,
  isCustom: boolean,
): Promise<RecipeDetail> {
  const recipeTable = isCustom ? "custom_recipes" : "recipes";
  const ingredientTable = isCustom
    ? "custom_recipe_ingredients"
    : "recipe_ingredients";
  const keyColumn = isCustom ? "custom_recipe_id" : "recipe_id";

  const { data: recipe, error: recipeError } = await supabase
    .from(recipeTable)
    .select("id, name, prep_time_min, calories, protein_g, instructions")
    .eq("id", recipeId)
    .returns<RecipeDetailRow[]>()
    .single();

  if (recipeError) throw recipeError;

  const { data: ingredientRows, error: ingredientError } = await supabase
    .from(ingredientTable)
    .select("ingredient_id, quantity, unit")
    .eq(keyColumn, recipeId);

  if (ingredientError) throw ingredientError;

  return {
    id: recipe.id,
    name: recipe.name,
    prepTimeMin: recipe.prep_time_min,
    calories: recipe.calories,
    proteinG: recipe.protein_g,
    instructions: recipe.instructions,
    isCustom,
    ingredients: (ingredientRows ?? []).map((row) => ({
      ingredientId: row.ingredient_id as string,
      quantity: row.quantity as number | null,
      unit: row.unit as string | null,
    })),
  };
}

export async function fetchFridgeItemIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("fridge_items")
    .select("ingredient_id")
    .eq("user_id", userId);

  if (error) throw error;
  return data.map((row) => row.ingredient_id);
}

export async function addFridgeItem(userId: string, ingredientId: string): Promise<void> {
  const { error } = await supabase
    .from("fridge_items")
    .upsert(
      { user_id: userId, ingredient_id: ingredientId },
      { onConflict: "user_id,ingredient_id" },
    );

  if (error) throw error;
}

export async function removeFridgeItem(userId: string, ingredientId: string): Promise<void> {
  const { error } = await supabase
    .from("fridge_items")
    .delete()
    .eq("user_id", userId)
    .eq("ingredient_id", ingredientId);

  if (error) throw error;
}

/* --------------
    FRIDGE QUANTITIES
------------- */

/** Fridge rows with their quantities, keyed by ingredient id. */
export async function fetchFridgeItems(
  userId: string,
): Promise<Map<string, FridgeEntry>> {
  const { data, error } = await supabase
    .from("fridge_items")
    .select("ingredient_id, quantity, unit")
    .eq("user_id", userId);

  if (error) throw error;

  return new Map(
    data.map((row) => [
      row.ingredient_id as string,
      { quantity: row.quantity as number, unit: (row.unit as string) ?? "" },
    ]),
  );
}

/**
 * Puts a single ingredient in the fridge, used when a grocery item is checked
 * off. Upserts on (user_id, ingredient_id), so buying something already in the
 * fridge sets the new amount rather than creating a duplicate row.
 */
export async function addIngredientToFridge(
  userId: string,
  ingredientId: string,
  quantity: number,
  unit: string,
): Promise<void> {
  const { error } = await supabase.from("fridge_items").upsert(
    { user_id: userId, ingredient_id: ingredientId, quantity, unit },
    { onConflict: "user_id,ingredient_id" },
  );

  if (error) throw error;
}

/**
 * Writes a whole fridge in one go: upserts everything still present, deletes
 * what was taken out. Used when the fridge card closes, so a session of edits
 * costs two round trips instead of one per change.
 */
export async function saveFridgeItems(
  userId: string,
  items: { ingredientId: string; quantity: number; unit: string }[],
  removedIngredientIds: string[],
): Promise<void> {
  if (items.length > 0) {
    const { error } = await supabase.from("fridge_items").upsert(
      items.map((item) => ({
        user_id: userId,
        ingredient_id: item.ingredientId,
        quantity: item.quantity,
        unit: item.unit,
      })),
      { onConflict: "user_id,ingredient_id" },
    );

    if (error) throw error;
  }

  if (removedIngredientIds.length > 0) {
    const { error } = await supabase
      .from("fridge_items")
      .delete()
      .eq("user_id", userId)
      .in("ingredient_id", removedIngredientIds);

    if (error) throw error;
  }
}

/* --------------
    GROCERY LIST
------------- */

type GroceryItemRow = {
  id: string;
  ingredient_id: string | null;
  custom_name: string | null;
  quantity: number | null;
  unit: string | null;
  checked: boolean;
  source: GrocerySource;
};

export async function fetchGroceryItems(userId: string): Promise<GroceryItem[]> {
  const { data, error } = await supabase
    .from("grocery_items")
    .select("id, ingredient_id, custom_name, quantity, unit, checked, source")
    .eq("user_id", userId)
    .order("created_at")
    .returns<GroceryItemRow[]>();

  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    ingredientId: row.ingredient_id,
    customName: row.custom_name,
    quantity: row.quantity,
    unit: row.unit,
    checked: row.checked,
    source: row.source,
  }));
}

/**
 * Adds a recipe's missing ingredients to the grocery list — everything the
 * recipe calls for that isn't already in the user's fridge, at the recipe's
 * own quantity and unit.
 *
 * Custom recipes keep their ingredients in `custom_recipe_ingredients` with a
 * `custom_recipe_id`, so the source table and key column both switch.
 *
 * The "not in fridge" filter runs client-side (two reads, one write) because
 * PostgREST can't express a correlated NOT EXISTS. `ignoreDuplicates` is the
 * ON CONFLICT DO NOTHING, so re-tapping won't overwrite an edited quantity.
 */
export async function addRecipeToGroceryList(
  userId: string,
  recipe: Pick<Recipe, "id" | "isCustom">,
): Promise<number> {
  const table = recipe.isCustom ? "custom_recipe_ingredients" : "recipe_ingredients";
  const keyColumn = recipe.isCustom ? "custom_recipe_id" : "recipe_id";

  const { data: recipeRows, error: recipeError } = await supabase
    .from(table)
    .select("ingredient_id, quantity, unit")
    .eq(keyColumn, recipe.id);

  if (recipeError) throw recipeError;

  const { data: fridgeRows, error: fridgeError } = await supabase
    .from("fridge_items")
    .select("ingredient_id")
    .eq("user_id", userId);

  if (fridgeError) throw fridgeError;

  const inFridge = new Set((fridgeRows ?? []).map((row) => row.ingredient_id));
  const missing = (recipeRows ?? []).filter(
    (row) => !inFridge.has(row.ingredient_id),
  );

  if (missing.length === 0) return 0;

  const { error } = await supabase.from("grocery_items").upsert(
    missing.map((row) => ({
      user_id: userId,
      ingredient_id: row.ingredient_id,
      quantity: row.quantity,
      unit: row.unit,
      source: "recipe",
    })),
    { onConflict: "user_id,ingredient_id", ignoreDuplicates: true },
  );

  if (error) throw error;

  return missing.length;
}

/**
 * Adds an item to the list — linked to a catalog ingredient when one was
 * picked, or free text when it isn't in the catalog at all (the table's check
 * constraint requires exactly one of the two).
 *
 * Catalog-linked rows go through an upsert so `unique (user_id,
 * ingredient_id)` can dedupe: re-adding an ingredient updates its quantity
 * instead of creating a second row. Free-text rows leave `ingredient_id` null,
 * which that constraint can never match (NULLs are distinct in Postgres), so
 * they're a plain insert.
 */
export async function addGroceryItem(
  userId: string,
  item: {
    ingredientId: string | null;
    customName: string | null;
    quantity: number | null;
    unit: string | null;
    source: GrocerySource;
  },
): Promise<void> {
  const row = {
    user_id: userId,
    ingredient_id: item.ingredientId,
    custom_name: item.customName,
    quantity: item.quantity,
    unit: item.unit,
    source: item.source,
  };

  const { error } =
    item.ingredientId === null
      ? await supabase.from("grocery_items").insert(row)
      : await supabase
          .from("grocery_items")
          .upsert(row, { onConflict: "user_id,ingredient_id" });

  if (error) throw error;
}

export async function setGroceryItemChecked(
  itemId: string,
  checked: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("grocery_items")
    .update({ checked })
    .eq("id", itemId);

  if (error) throw error;
}

export async function removeGroceryItem(itemId: string): Promise<void> {
  const { error } = await supabase.from("grocery_items").delete().eq("id", itemId);

  if (error) throw error;
}

/** Deletes every checked row — the "Clear completed" action. */
export async function clearCheckedGroceryItems(userId: string): Promise<void> {
  const { error } = await supabase
    .from("grocery_items")
    .delete()
    .eq("user_id", userId)
    .eq("checked", true);

  if (error) throw error;
}

/* --------------
    MEAL PLAN
------------- */

type MealPlanEntryRow = {
  id: string;
  recipe_id: string | null;
  custom_recipe_id: string | null;
  planned_date: string;
  meal_type: MealType;
};

/** Entries between two ISO dates, inclusive. */
export async function fetchMealPlanEntries(
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<MealPlanEntry[]> {
  const { data, error } = await supabase
    .from("meal_plan_entries")
    .select("id, recipe_id, custom_recipe_id, planned_date, meal_type")
    .eq("user_id", userId)
    .gte("planned_date", fromDate)
    .lte("planned_date", toDate)
    .returns<MealPlanEntryRow[]>();

  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    // Exactly one of the two id columns is set; isCustom records which, so
    // the entry can be matched back against the right recipe list.
    recipeId: (row.custom_recipe_id ?? row.recipe_id) as string,
    isCustom: row.custom_recipe_id !== null,
    plannedDate: row.planned_date,
    mealType: row.meal_type,
  }));
}

/**
 * Places a recipe in a slot. The table's unique (user_id, planned_date,
 * meal_type) constraint means one recipe per slot, so an upsert replaces
 * whatever was there rather than erroring.
 */
export async function setMealPlanEntry(
  userId: string,
  recipe: Pick<Recipe, "id" | "isCustom">,
  plannedDate: string,
  mealType: MealType,
): Promise<void> {
  const { error } = await supabase.from("meal_plan_entries").upsert(
    {
      user_id: userId,
      recipe_id: recipe.isCustom ? null : recipe.id,
      custom_recipe_id: recipe.isCustom ? recipe.id : null,
      planned_date: plannedDate,
      meal_type: mealType,
    },
    { onConflict: "user_id,planned_date,meal_type" },
  );

  if (error) throw error;
}

/**
 * Adds every ingredient the given planned recipes call for onto the grocery
 * list under `meal_plan`, skipping anything already in the fridge.
 *
 * Pass a recipe once per time it's planned — the same recipe on two nights
 * should buy twice the ingredients, so duplicates in the input are deliberate.
 *
 * Returns how many distinct ingredients were queued.
 */
export async function addMealPlanToGroceryList(
  userId: string,
  recipes: Pick<Recipe, "id" | "isCustom">[],
): Promise<number> {
  if (recipes.length === 0) return 0;

  const catalogIds = recipes.filter((r) => !r.isCustom).map((r) => r.id);
  const customIds = recipes.filter((r) => r.isCustom).map((r) => r.id);

  type IngredientLine = {
    ingredient_id: string;
    quantity: number | null;
    unit: string | null;
  };
  const lines: IngredientLine[] = [];

  if (catalogIds.length > 0) {
    const { data, error } = await supabase
      .from("recipe_ingredients")
      .select("ingredient_id, quantity, unit")
      .in("recipe_id", catalogIds);

    if (error) throw error;
    lines.push(...((data ?? []) as IngredientLine[]));
  }

  if (customIds.length > 0) {
    const { data, error } = await supabase
      .from("custom_recipe_ingredients")
      .select("ingredient_id, quantity, unit")
      .in("custom_recipe_id", customIds);

    if (error) throw error;
    lines.push(...((data ?? []) as IngredientLine[]));
  }

  const { data: fridgeRows, error: fridgeError } = await supabase
    .from("fridge_items")
    .select("ingredient_id")
    .eq("user_id", userId);

  if (fridgeError) throw fridgeError;
  const inFridge = new Set((fridgeRows ?? []).map((row) => row.ingredient_id));

  // One row per ingredient, since grocery_items is unique on
  // (user_id, ingredient_id) — so repeats have to be totalled here.
  const totals = new Map<string, { quantity: number | null; unit: string | null }>();

  for (const line of lines) {
    if (inFridge.has(line.ingredient_id)) continue;

    const existing = totals.get(line.ingredient_id);
    if (!existing) {
      totals.set(line.ingredient_id, { quantity: line.quantity, unit: line.unit });
      continue;
    }

    // Only add up amounts in the same unit — there's no conversion table, so
    // summing "lb" with "cups" would produce a meaningless number. Mismatches
    // keep the first amount rather than inventing one.
    if (
      existing.unit === line.unit &&
      existing.quantity !== null &&
      line.quantity !== null
    ) {
      existing.quantity += line.quantity;
    }
  }

  if (totals.size === 0) return 0;

  const { error } = await supabase.from("grocery_items").upsert(
    [...totals].map(([ingredientId, total]) => ({
      user_id: userId,
      ingredient_id: ingredientId,
      quantity: total.quantity,
      unit: total.unit,
      source: "meal_plan",
    })),
    { onConflict: "user_id,ingredient_id" },
  );

  if (error) throw error;

  return totals.size;
}

export async function removeMealPlanEntry(entryId: string): Promise<void> {
  const { error } = await supabase
    .from("meal_plan_entries")
    .delete()
    .eq("id", entryId);

  if (error) throw error;
}

export async function fetchFavoriteRecipes(user: { id: string }) {
  const { data, error } = await supabase
    .from("favorite_recipes")
    .select("recipe_id")
    .eq("user_id", user.id)
  if (error) console.log("Error fetching favorite recipes: ", error)
  return (data ?? []).map((row) => recipeKey({ id: row.recipe_id, isCustom: false }))
}

export async function fetchCustomFavoriteRecipes(user: { id: string }) {
  const { data, error } = await supabase
    .from("favorite_custom_recipes")
    .select("custom_recipe_id")
    .eq("user_id", user.id);

  if (error) throw error;
  return (data ?? []).map((row) => recipeKey({ id: row.custom_recipe_id, isCustom: true }));
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