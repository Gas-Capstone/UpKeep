import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Chip, Searchbar, Text } from "react-native-paper";

import { useThemeMode } from "@/components/context/ThemeContext";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { Ingredient, groupIngredientsByCategory } from "@/lib/meals/meals";

type IngredientPickerProps = {
  ingredients: Ingredient[];
  selectedIds: ReadonlySet<string>;
  onToggle: (ingredient: Ingredient) => void;
};

export function IngredientPicker({
  ingredients,
  selectedIds,
  onToggle,
}: IngredientPickerProps) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? ingredients.filter((ingredient) =>
          ingredient.name.toLowerCase().includes(q),
        )
      : ingredients;

    return groupIngredientsByCategory(filtered);
  }, [ingredients, query]);

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search ingredients"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        style={[
          styles.search,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
          },
        ]}
        inputStyle={{ color: colors.text }}
        iconColor={colors.textSecondary}
        placeholderTextColor={colors.textSecondary}
      />

      {groups.length === 0 ? (
        <View
          style={[
            styles.empty,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
        >
          <Text style={{ color: colors.textSecondary }}>
            No ingredients found.
          </Text>
        </View>
      ) : (
        groups.map((group) => (
          <View key={group.category} style={styles.group}>
            <Text
              variant="labelLarge"
              style={{ color: colors.textSecondary, fontWeight: "700" }}
            >
              {group.label}
            </Text>

            <View style={styles.chips}>
              {group.items.map((ingredient) => {
                const selected = selectedIds.has(ingredient.id);

                return (
                  <Chip
                    key={ingredient.id}
                    mode="outlined"
                    selected={selected}
                    showSelectedCheck={selected}
                    onPress={() => onToggle(ingredient)}
                    style={{
                      backgroundColor: selected
                        ? colors.backgroundSelected
                        : colors.background,
                      borderColor: selected ? colors.brand : colors.border,
                    }}
                    textStyle={{
                      color: selected ? colors.brandStrong : colors.text,
                      fontWeight: selected ? "700" : "500",
                    }}
                  >
                    {ingredient.name}
                  </Chip>
                );
              })}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "stretch",
    gap: Spacing.three,
  },
  search: {
    alignSelf: "stretch",
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 0,
  },
  group: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  empty: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    alignItems: "center",
  },
});
