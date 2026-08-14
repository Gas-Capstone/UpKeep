import { useMemo, useState } from "react";
import { View } from "react-native";
import { Chip, Searchbar, Text } from "react-native-paper";

import { VStack } from "@/components/ui/vstack";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { Ingredient, groupIngredientsByCategory } from "@/lib/meals/meals";

type IngredientPickerProps = {
  ingredients: Ingredient[];
  selectedIds: ReadonlySet<string>;
  onToggle: (ingredient: Ingredient) => void;
};

/** Searchable, category-grouped ingredient chips. Tap a chip to toggle it. */
export function IngredientPicker({ ingredients, selectedIds, onToggle }: IngredientPickerProps) {
  const theme = useTheme();
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? ingredients.filter((i) => i.name.toLowerCase().includes(q)) : ingredients;
    return groupIngredientsByCategory(filtered);
  }, [ingredients, query]);

  return (
    <VStack space="md" style={{ alignSelf: "stretch" }}>
      <Searchbar
        placeholder="Search ingredients"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        style={{ alignSelf: "stretch" }}
      />

      {groups.length === 0 ? (
        <Text style={{ color: theme.textSecondary }}>No ingredients found.</Text>
      ) : (
        groups.map((group) => (
          <VStack key={group.category} space="sm" style={{ alignSelf: "stretch" }}>
            <Text variant="labelLarge" style={{ color: theme.textSecondary }}>
              {group.label}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Spacing.two }}>
              {group.items.map((ing) => {
                const selected = selectedIds.has(ing.id);
                return (
                  <Chip
                    key={ing.id}
                    mode={selected ? "flat" : "outlined"}
                    selected={selected}
                    showSelectedCheck={false}
                    onPress={() => onToggle(ing)}
                    textStyle={selected ? { color: theme.accentMeals } : undefined}>
                    {selected ? `✓ ${ing.name}` : ing.name}
                  </Chip>
                );
              })}
            </View>
          </VStack>
        ))
      )}
    </VStack>
  );
}
