// Pure, synchronous fridge-matching logic. Kept free of I/O so it doesn't care
// whether Ingredient/Recipe data came from Supabase or a test fixture — see
// queries.ts for the Supabase reads/writes that feed this.

// Ids throughout this module are uuids in the database, so they're strings —
// never parse one as a number, which silently yields NaN and matches nothing.
export type Ingredient = {
  id: string;
  name: string;
  category: string;
  calories: number; // kcal per unit (see unit)
  // The `unit_type` column was renamed to `unit`, so this is a straight
  // passthrough now rather than a camelCase mapping.
  unit: string; // e.g. "lb", "cup", "oz"
};

// One line of the user's fridge: how much of an ingredient they have. The unit
// is stored per fridge row rather than read back off the catalog, so changing a
// catalog unit later can't silently reinterpret quantities already saved.
export type FridgeEntry = {
  quantity: number;
  unit: string;
};

// Mirrors the check constraint on grocery_items.source.
export type GrocerySource = "manual" | "recipe" | "meal_plan";

// A grocery list row. Either ingredient_id or custom_name is set — the table
// has a check constraint requiring at least one — so the display name falls
// back to custom_name when the item isn't a catalog ingredient.
export type GroceryItem = {
  id: string;
  ingredientId: string | null;
  customName: string | null;
  quantity: number | null;
  unit: string | null;
  checked: boolean;
  source: GrocerySource;
};

export type Recipe = {
  id: string;
  name: string;
  prepTimeMin: number;
  ingredientIds: string[];
  isCustom: boolean;
};

// Everything the recipe page shows, from whichever table the recipe lives in.
export type RecipeDetail = {
  id: string;
  name: string;
  prepTimeMin: number | null;
  calories: number | null;
  proteinG: number | null;
  instructions: string | null;
  isCustom: boolean;
  ingredients: {
    ingredientId: string;
    quantity: number | null;
    unit: string | null;
  }[];
};

/**
 * Splits the single `instructions` column into steps — one per line.
 *
 * Leading "1." / "2)" / "-" markers are stripped because the list renders its
 * own numbering; leaving them would double it up.
 */
export function parseInstructionSteps(instructions: string | null): string[] {
  if (!instructions) return [];
  return instructions
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^(\d+[.)]|[-*•])\s*/, "").trim())
    .filter((line) => line !== "");
}

/** Catalog and custom recipes have independent id spaces — never mix them as one key. */
export function recipeKey(recipe: Pick<Recipe, "id" | "isCustom">): string {
  return recipe.isCustom ? `custom:${recipe.id}` : `catalog:${recipe.id}`;
}

export type RecipeMatch = {
  recipe: Recipe;
  missingIds: string[];
};

export type IngredientGroup = {
  category: string;
  label: string;
  items: Ingredient[];
};

// Preferred display order + friendly labels. Includes common singular/plural
// variants since the live catalog's exact category values aren't pinned down.
const CATEGORY_ORDER = [
  "protein",
  "vegetable",
  "produce",
  "fruit",
  "grain",
  "grains",
  "dairy",
  "pantry",
  "condiment",
  "aromatic",
];

const CATEGORY_LABELS: Record<string, string> = {
  protein: "Proteins",
  vegetable: "Veggies",
  produce: "Produce",
  fruit: "Fruit",
  grain: "Grains",
  grains: "Grains",
  dairy: "Dairy",
  pantry: "Pantry",
  condiment: "Condiments",
  aromatic: "Aromatics",
};

function titleCase(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

// Group ingredients into ordered category sections. Known categories come first
// in CATEGORY_ORDER; any unrecognized category is appended (alphabetically, with
// a title-cased label); anything blank falls into a trailing "Other" bucket. This
// keeps the picker sensible no matter what categories the seed data actually uses.
export function groupIngredientsByCategory(ingredients: Ingredient[]): IngredientGroup[] {
  const byCategory = new Map<string, Ingredient[]>();
  for (const ing of ingredients) {
    const cat = ing.category?.trim() ? ing.category : "other";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(ing);
  }

  const known = CATEGORY_ORDER.filter((c) => byCategory.has(c));
  const unknown = [...byCategory.keys()]
    .filter((c) => c !== "other" && !CATEGORY_ORDER.includes(c))
    .sort();
  const ordered = [...known, ...unknown];
  if (byCategory.has("other")) ordered.push("other");

  return ordered.map((c) => ({
    category: c,
    label: c === "other" ? "Other" : (CATEGORY_LABELS[c] ?? titleCase(c)),
    items: byCategory.get(c)!.slice().sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

export function getMissingIngredientIds(recipe: Recipe, fridge: ReadonlySet<string>): string[] {
  return recipe.ingredientIds.filter((id) => !fridge.has(id));
}

export function matchRecipes(recipes: Recipe[], fridge: ReadonlySet<string>) {
  const ready: RecipeMatch[] = [];
  const almost: RecipeMatch[] = [];

  for (const recipe of recipes) {
    const missingIds = getMissingIngredientIds(recipe, fridge);
    (missingIds.length === 0 ? ready : almost).push({ recipe, missingIds });
  }

  return { ready, almost };
}

export function sortFavoritesFirst(
  recipes: Recipe[],
  favoriteIds: Set<string>,
): Recipe[] {
  return [...recipes].sort((a, b) => {
    const aFav = favoriteIds.has(recipeKey(a)) ? 1 : 0
    const bFav = favoriteIds.has(recipeKey(b)) ? 1 : 0
    return bFav - aFav
  })
}
