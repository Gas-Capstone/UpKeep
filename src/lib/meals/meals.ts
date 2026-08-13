// Pure, synchronous fridge-matching logic. Kept free of I/O so it doesn't care
// whether Ingredient/Recipe data came from Supabase or a test fixture — see
// queries.ts for the Supabase reads/writes that feed this.

export type Ingredient = {
  id: number;
  name: string;
  category: string;
};

export type Recipe = {
  id: number;
  name: string;
  prepTimeMin: number;
  ingredientIds: number[];
  isCustom?: boolean;
};

export type RecipeMatch = {
  recipe: Recipe;
  missingIds: number[];
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

export function getMissingIngredientIds(recipe: Recipe, fridge: ReadonlySet<number>): number[] {
  return recipe.ingredientIds.filter((id) => !fridge.has(id));
}

export function matchRecipes(recipes: Recipe[], fridge: ReadonlySet<number>) {
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
  favoriteIds: Set<String>,
): Recipe[] {
  return [...recipes].sort((a, b) => {
    const aFav = favoriteIds.has(String(a.id)) ? 1 : 0
    const bFav = favoriteIds.has(String(b.id)) ? 1 : 0
    return bFav - aFav
  })
}
