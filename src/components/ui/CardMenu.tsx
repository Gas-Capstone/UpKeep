import { useState } from "react";
import { IconButton, Menu, useTheme } from "react-native-paper";

export type CardMenuAction = {
  key: string;
  label: string;
  icon: string;
  onPress: () => void;
  // Renders in the error color — used for delete.
  destructive?: boolean;
};

type CardMenuProps = {
  actions: CardMenuAction[];
  accessibilityLabel: string;
};

/**
 * The burger menu in a card's top-right corner.
 *
 * Renders nothing when there are no actions, so cards the user doesn't own
 * (seeded plans, catalog recipes with nothing to offer) simply have no menu
 * rather than one full of disabled items.
 */
export function CardMenu({ actions, accessibilityLabel }: CardMenuProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  if (actions.length === 0) return null;

  return (
    <Menu
      visible={open}
      onDismiss={() => setOpen(false)}
      anchor={
        <IconButton
          icon="menu"
          size={22}
          iconColor={theme.colors.onSurfaceVariant}
          style={{ margin: 0 }}
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
          titleStyle={
            action.destructive ? { color: theme.colors.error } : undefined
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
