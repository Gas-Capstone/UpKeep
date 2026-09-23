import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";

import { useThemeMode } from "@/components/context/ThemeContext";
import { Colors, Radius, Spacing } from "@/constants/theme";
import type { WeekDay } from "@/lib/time_management/week";

type WeekButtonProps = {
  day: WeekDay;
  isSelected: boolean;
  onPress?: () => void;
};

export function WeekButton({ day, isSelected, onPress }: WeekButtonProps) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${day.dayOfWeek}, ${day.dayNumber}${
        day.isToday ? ", today" : ""
      }`}
      style={({ pressed }) => [
        styles.root,
        isSelected && { backgroundColor: colors.brand },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text
        variant="labelSmall"
        style={{
          color: isSelected ? "#FFFFFF" : colors.textSecondary,
          fontWeight: isSelected ? "800" : "600",
        }}
      >
        {day.label}
      </Text>

      <Text
        variant="titleSmall"
        style={{
          color: isSelected ? "#FFFFFF" : colors.text,
          fontWeight: "800",
        }}
      >
        {day.dayNumber}
      </Text>

      <View
        style={[
          styles.todayDot,
          {
            backgroundColor: day.isToday
              ? isSelected
                ? "#FFFFFF"
                : colors.brand
              : "transparent",
          },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minWidth: 0,
    minHeight: 58,
    borderRadius: Radius.medium,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    paddingVertical: Spacing.one,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
});
