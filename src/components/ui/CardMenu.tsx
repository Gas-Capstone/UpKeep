import { useState } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { IconButton, Menu, useTheme } from "react-native-paper";

import { Radius, Spacing } from "@/constants/theme";

export type CardMenuAction = {
  key: string;
  label: string;
  icon: string;
  onPress: () => void;
  // Renders in the error color — used for delete.
  destructive?: boolean;
  disabled?: boolean;
};

type CardMenuProps = {
  actions: CardMenuAction[];
  accessibilityLabel: string;
  // Match these to the sibling the menu sits beside — cards give their star a
  // negative margin, and the two only line up if this does the same.
  size?: number;
  anchorStyle?: StyleProp<ViewStyle>;
  // Trigger icon. Defaults to the burger used on recipe and workout cards.
  icon?: string;
};

/**
 * The burger menu in a card's top-right corner.
 *
 * Renders nothing when there are no actions, so cards the user doesn't own
 * (seeded plans, catalog recipes with nothing to offer) simply have no menu
 * rather than one full of disabled items.
 */
export function CardMenu({
  actions,
  accessibilityLabel,
  size = 22,
  anchorStyle,
  icon = "menu",
}: CardMenuProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  if (actions.length === 0) return null;

  return (
    <Menu
      visible={open}
      onDismiss={() => setOpen(false)}
      // Styled like the cards it opens from, rather than Paper's default sheet.
      contentStyle={[
        styles.content,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outlineVariant,
        },
      ]}
      anchor={
        <IconButton
          icon={icon}
          size={size}
          iconColor={theme.colors.onSurfaceVariant}
          style={anchorStyle ?? { margin: 0 }}
          // Cards can be pressable themselves, so this has to claim the tap
          // rather than letting it fall through to the card.
          onPress={() => setOpen(true)}
          accessibilityLabel={accessibilityLabel}
        />
      }
    >
      {actions.map((action) => (
        <Menu.Item
          key={action.key}
          leadingIcon={action.icon}
          title={action.label}
          disabled={action.disabled}
          rippleColor={theme.colors.primaryContainer}
          titleStyle={
            action.destructive ? { color: theme.colors.error } : undefined
          }
          // Menu.Item colors its icon from onSurfaceVariant, so this is how the
          // icon turns red alongside the title.
          theme={
            action.destructive
              ? { colors: { onSurfaceVariant: theme.colors.error } }
              : undefined
          }
          onPress={() => {
            // Close first: leaving the menu open behind a navigation or a
            // dialog leaves it stranded on screen when you come back.
            setOpen(false);
            action.onPress();
          }}
        />
      ))}
    </Menu>
  );
}

const styles = StyleSheet.create({
  content: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    paddingVertical: Spacing.one,
  },
});
