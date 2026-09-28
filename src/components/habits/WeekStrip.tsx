import { StyleSheet, View } from "react-native";

import { useThemeMode } from "@/components/context/ThemeContext";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { getWeekArray } from "@/lib/time_management/week";

import { WeekButton } from "./WeekButton";

type WeekStripProps = {
  selectedDate: string;
  onSelectDate: (date: string) => void;
};

export function WeekStrip({ selectedDate, onSelectDate }: WeekStripProps) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];
  const weekArray = getWeekArray();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.backgroundElement,
          borderColor: colors.border,
        },
      ]}
    >
      {weekArray.map((day) => (
        <WeekButton
          key={day.fullDate}
          day={day}
          isSelected={selectedDate === day.fullDate}
          onPress={() => onSelectDate(day.fullDate)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    width: "100%",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.large,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    gap: 2,
  },
});
