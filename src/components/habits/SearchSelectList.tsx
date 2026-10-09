import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Divider, List, Searchbar, Text } from "react-native-paper";

import { useThemeMode } from "@/components/context/ThemeContext";
import { Colors, Radius, Spacing } from "@/constants/theme";

export type SelectOption = {
  key: string;
  title: string;
  description?: string;
};

type SearchSelectListProps = {
  options: SelectOption[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  searchPlaceholder: string;
  emptyText: string;
};

/** Searchable, single-select list — used to pick a recipe or workout plan. */
export function SearchSelectList({
  options,
  selectedKey,
  onSelect,
  searchPlaceholder,
  emptyText,
}: SearchSelectListProps) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((option) => option.title.toLowerCase().includes(q))
    : options;

  return (
    <>
      <Searchbar
        placeholder={searchPlaceholder}
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
            {emptyText}
          </Text>
        ) : (
          filtered.map((option, index) => {
            const isSelected = option.key === selectedKey;
            return (
              <View key={option.key}>
                {index > 0 && <Divider />}
                <List.Item
                  title={option.title}
                  description={option.description}
                  onPress={() => onSelect(option.key)}
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
