import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Divider, List, Searchbar, Text } from "react-native-paper";

import { useThemeMode } from "@/components/context/ThemeContext";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { Recipe, recipeKey } from "@/lib/meals/meals";

type RecipeSelectListProps = {
  recipes: Recipe[];
  selected: Recipe | null;
  onSelect: (recipe: Recipe) => void;
};

/** Searchable, single-select recipe list for planning a meal. */
export function RecipeSelectList({
  recipes,
  selected,
  onSelect,
}: RecipeSelectListProps) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? recipes.filter((recipe) => recipe.name.toLowerCase().includes(q))
    : recipes;
  const selectedKey = selected ? recipeKey(selected) : null;

  return (
    <>
      <Searchbar
        placeholder="Search recipes"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        style={{ backgroundColor: colors.background }}
      />
      <ScrollView
        nestedScrollEnabled
        style={[
          styles.list,
          { borderColor: colors.border, backgroundColor: colors.background },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {filtered.length === 0 ? (
          <Text
            variant="bodySmall"
            style={[styles.empty, { color: colors.textSecondary }]}
          >
            No recipes found.
          </Text>
        ) : (
          filtered.map((recipe, index) => {
            const isSelected = recipeKey(recipe) === selectedKey;
            return (
              <View key={recipeKey(recipe)}>
                {index > 0 && <Divider />}
                <List.Item
                  title={recipe.name}
                  description={`${recipe.prepTimeMin} min`}
                  onPress={() => onSelect(recipe)}
                  style={
                    isSelected
                      ? { backgroundColor: colors.backgroundSelected }
                      : undefined
                  }
                  right={(props) =>
                    isSelected ? (
                      <List.Icon
                        {...props}
                        icon="check-circle"
                        color={colors.brand}
                      />
                    ) : null
                  }
                  accessibilityState={{ selected: isSelected }}
                />
              </View>
            );
          })
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    maxHeight: 220,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
  },
  empty: {
    padding: Spacing.three,
  },
});
