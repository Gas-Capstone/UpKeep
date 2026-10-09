// Which steps of a recipe have been checked off while cooking. Saved on the
// device per recipe, so leaving the cooking screen (or closing the app) is
// how cooking pauses, and opening it again resumes where you left off.

import AsyncStorage from "@react-native-async-storage/async-storage";

import { recipeKey, type Recipe } from "./meals";

type RecipeRef = Pick<Recipe, "id" | "isCustom">;

type SavedProgress = {
  // The step count when this was saved. If the recipe's instructions change
  // since, the saved indexes no longer line up, so the progress is dropped.
  stepCount: number;
  checked: number[];
};

function storageKey(recipe: RecipeRef) {
  return `cooking-progress:${recipeKey(recipe)}`;
}

export async function loadCookingProgress(
  recipe: RecipeRef,
  stepCount: number,
): Promise<Set<number>> {
  try {
    const stored = await AsyncStorage.getItem(storageKey(recipe));
    if (!stored) return new Set();
    const progress: SavedProgress = JSON.parse(stored);
    return progress.stepCount === stepCount ? new Set(progress.checked) : new Set();
  } catch {
    return new Set();
  }
}

export async function saveCookingProgress(
  recipe: RecipeRef,
  stepCount: number,
  checked: ReadonlySet<number>,
): Promise<void> {
  if (checked.size === 0) return clearCookingProgress(recipe);
  const progress: SavedProgress = { stepCount, checked: [...checked] };
  await AsyncStorage.setItem(storageKey(recipe), JSON.stringify(progress));
}

export async function clearCookingProgress(recipe: RecipeRef): Promise<void> {
  await AsyncStorage.removeItem(storageKey(recipe));
}
