import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Icon, Menu, Text, useTheme } from "react-native-paper";

import { useThemeMode } from "@/components/context/ThemeContext";
import { Colors, Radius, Spacing } from "@/constants/theme";

type FilterMenuChipProps = {
  /** What the chip filters by, e.g. "Difficulty". Shown while nothing is picked. */
  label: string;
  /** Option values, already in display order. */
  options: string[];
  /** The picked value, or null for "any". */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Turns an option value into its label. */
  formatOption?: (value: string) => string;
};

/**
 * A filter chip that opens a menu of values. Styled like WorkoutFilterChip so
 * the two sit together in one row; used where the choices are too many to lay
 * out as chips of their own.
 *
 * Shows the picked value once one is chosen, and "Any" in the menu clears it.
 */
export function FilterMenuChip({
  label,
  options,
  value,
  onChange,
  formatOption = (option) => option,
}: FilterMenuChipProps) {
  const theme = useTheme();
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];
  const [open, setOpen] = useState(false);

  const active = value !== null;
  const shown = active ? formatOption(value) : label;

  const choose = (next: string | null) => {
    // Closed first, as CardMenu does, so the menu never lingers behind the
    // re-render the change causes.
    setOpen(false);
    onChange(next);
  };

  return (
    <Menu
      visible={open}
      onDismiss={() => setOpen(false)}
      contentStyle={[
        styles.content,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outlineVariant,
        },
      ]}
      anchor={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            active ? `${label}: ${shown}. Change filter` : `Filter by ${label.toLowerCase()}`
          }
          accessibilityState={{ selected: active, expanded: open }}
          onPress={() => setOpen(true)}
          style={({ pressed }) => [
            styles.chip,
            {
              backgroundColor: active ? colors.brandStrong : colors.backgroundElement,
              borderColor: active ? colors.brandStrong : colors.border,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text
            variant="labelMedium"
            style={{
              color: active ? theme.colors.onPrimary : colors.textSecondary,
              fontWeight: active ? "700" : "600",
            }}
          >
            {shown}
          </Text>
          <Icon
            source="chevron-down"
            size={16}
            color={active ? theme.colors.onPrimary : colors.textSecondary}
          />
        </Pressable>
      }
    >
      <Menu.Item
        title={`Any ${label.toLowerCase()}`}
        leadingIcon={active ? undefined : "check"}
        rippleColor={theme.colors.primaryContainer}
        onPress={() => choose(null)}
      />
      {options.map((option) => (
        <Menu.Item
          key={option}
          title={formatOption(option)}
          leadingIcon={option === value ? "check" : undefined}
          rippleColor={theme.colors.primaryContainer}
          onPress={() => choose(option)}
        />
      ))}
    </Menu>
  );
}

const styles = StyleSheet.create({
  // Same footprint as WorkoutFilterChip.
  chip: {
    minHeight: 36,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.half,
  },
  content: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.one,
  },
});
