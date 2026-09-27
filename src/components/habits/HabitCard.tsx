import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon, IconButton, Menu, Text } from "react-native-paper";

import { useThemeMode } from "@/components/context/ThemeContext";
import { Colors, Radius, Spacing } from "@/constants/theme";
import type { Weekday } from "@/lib/habits/habits";

type HabitCardProps = {
  title: string;
  time: string;
  weekdays: Weekday[];
  isDone?: boolean;
  onToggle: () => void;
  onDelete: () => void;
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function getScheduleLabel(weekdays: Weekday[]) {
  if (!weekdays || weekdays.length === 0 || weekdays.length === 7) {
    return "Every day";
  }

  return [...weekdays]
    .sort((a, b) => a - b)
    .map((day) => DAY_LABELS[day])
    .join(", ");
}

export function HabitCard({
  title,
  time,
  weekdays,
  isDone = false,
  onToggle,
  onDelete,
}: HabitCardProps) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.backgroundElement,
          borderColor: isDone ? colors.brand : colors.border,
        },
      ]}
    >
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isDone }}
        accessibilityLabel={`${isDone ? "Mark" : "Mark"} ${title} ${
          isDone ? "incomplete" : "complete"
        }`}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.checkButton,
          {
            backgroundColor: isDone ? colors.brand : colors.background,
            borderColor: isDone ? colors.brand : colors.border,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        {isDone ? <Icon source="check" size={18} color="#FFFFFF" /> : null}
      </Pressable>

      <View style={styles.copy}>
        <Text
          variant="titleMedium"
          numberOfLines={2}
          style={[
            styles.title,
            {
              color: colors.text,
              opacity: isDone ? 0.68 : 1,
              textDecorationLine: isDone ? "line-through" : "none",
            },
          ]}
        >
          {title}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Icon
              source="clock-outline"
              size={15}
              color={colors.textSecondary}
            />
            <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
              {time}
            </Text>
          </View>

          <View style={[styles.metaDot, { backgroundColor: colors.border }]} />

          <Text
            variant="bodySmall"
            numberOfLines={1}
            style={[styles.schedule, { color: colors.textSecondary }]}
          >
            {getScheduleLabel(weekdays)}
          </Text>
        </View>
      </View>

      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={
          <IconButton
            icon="dots-horizontal"
            size={21}
            iconColor={colors.textSecondary}
            style={styles.menuButton}
            onPress={() => setMenuVisible(true)}
            accessibilityLabel={`More options for ${title}`}
          />
        }
      >
        <Menu.Item
          leadingIcon="delete-outline"
          title="Delete habit"
          onPress={() => {
            setMenuVisible(false);
            onDelete();
          }}
        />
      </Menu>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 86,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.large,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  checkButton: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.one,
  },
  title: {
    fontWeight: "800",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    minWidth: 0,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    marginHorizontal: 2,
  },
  schedule: {
    flex: 1,
    minWidth: 0,
  },
  menuButton: {
    margin: 0,
  },
});
