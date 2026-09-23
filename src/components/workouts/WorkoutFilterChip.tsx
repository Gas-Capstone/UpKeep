import { Pressable, StyleSheet } from "react-native";
import { Text } from "react-native-paper";

import { useThemeMode } from "@/components/context/ThemeContext";
import { Colors, Radius } from "@/constants/theme";

type WorkoutFilterChipProps = {
  tag: string;
  isSelected: boolean;
  onSelect: (tag: string) => void;
};

export function WorkoutFilterChip({
  tag,
  isSelected,
  onSelect,
}: WorkoutFilterChipProps) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];
  const label = tag.charAt(0).toUpperCase() + tag.slice(1);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={() => onSelect(tag)}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: isSelected
            ? colors.brandStrong
            : colors.backgroundElement,
          borderColor: isSelected ? colors.brandStrong : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text
        variant="labelMedium"
        style={{
          color: isSelected ? "#FFFFFF" : colors.textSecondary,
          fontWeight: isSelected ? "700" : "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
});
