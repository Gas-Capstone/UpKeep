import { Button, Card, Text, IconButton, useTheme } from "react-native-paper";

import { CardMenu } from "@/components/ui/CardMenu";
import type { AppTheme } from "@/constants/paper-theme";
import type { Recipe } from "@/lib/meals/meals";

// Shared by the star and the menu so both corners inset identically. Paper's
// own left/right slot defaults are not symmetric — see Card.Title below.
const ICON_SLOT_INSET = 8;
const ICON_SLOT = {
  width: 40,
  justifyContent: "center",
  alignItems: "center",
} as const;
type RecipeCardProps = {
  recipe: Recipe,
  isFavorited: boolean,
  missingNames: String[],
  onToggleFavorite: () => void
  // Queues this recipe's missing ingredients onto the grocery list.
  onQuickAdd?: () => void;
  adding?: boolean;
  // Opens the full recipe page.
  onOpen?: () => void;
  // Omitted for catalog recipes, which the user can't change.
  onEdit?: () => void;
  onDelete?: () => void;
  onAddToPlan?: () => void;
};

export function RecipeCard({
  missingNames,
  recipe,
  onToggleFavorite,
  isFavorited,
  onQuickAdd,
  adding = false,
  onOpen,
  onEdit,
  onDelete,
  onAddToPlan,
}: RecipeCardProps) {
  const theme = useTheme<AppTheme>();
  const ready = missingNames.length === 0;

  return (
    // Card's own onPress covers the title and content; the star and the
    // action buttons handle their own taps, so they don't trigger this.
    <Card mode="contained" onPress={onOpen}>
      <Card.Title
        title={recipe.name}
        subtitle={
          recipe.prepTimeMin
            ? `${recipe.prepTimeMin} min`
            : "Prep time not set"
        }
        // Paper insets the left slot (container paddingLeft + a 40dp box) but
        // gives the right slot no style at all, so the two corners end up
        // asymmetric. Matching boxes and equal padding put the star and the
        // menu the same distance from their edges.
        style={{ paddingLeft: ICON_SLOT_INSET, paddingRight: ICON_SLOT_INSET }}
        leftStyle={ICON_SLOT}
        rightStyle={ICON_SLOT}
        left={() => (
          <IconButton
            icon={isFavorited ? "star" : "star-outline"}
            iconColor={
              isFavorited ? theme.colors.primary : theme.colors.onSurfaceVariant
            }
            size={22}
            style={{ margin: 0 }}
            onPress={onToggleFavorite}
            accessibilityLabel={
              isFavorited
                ? `Remove ${recipe.name} from favorites`
                : `Add ${recipe.name} to favorites`
            }
          />
        )}
        right={() => (
          <CardMenu
            accessibilityLabel={`More options for ${recipe.name}`}
            actions={[
              ...(onAddToPlan
                ? [
                    {
                      key: "plan",
                      label: "Add to meal plan",
                      icon: "calendar-plus",
                      onPress: onAddToPlan,
                    },
                  ]
                : []),
              ...(onEdit
                ? [{ key: "edit", label: "Edit recipe", icon: "pencil", onPress: onEdit }]
                : []),
              ...(onDelete
                ? [
                    {
                      key: "delete",
                      label: "Delete recipe",
                      icon: "delete",
                      onPress: onDelete,
                      destructive: true,
                    },
                  ]
                : []),
            ]}
          />
        )}
      />
      <Card.Content>
        <Text
          style={{
            color: ready ? theme.colors.success : theme.colors.accentMeals,
          }}
        >
          {ready
            ? `You have all ${recipe.ingredientIds.length} ingredients`
            : `Need ${missingNames.length}: ${missingNames.join(", ")}`}
        </Text>
      </Card.Content>
      {onQuickAdd && (
        <Card.Actions>
          <Button
            mode="contained"
            icon="plus"
            loading={adding}
            disabled={adding}
            onPress={onQuickAdd}
            style={{ borderRadius: 999 }}
            accessibilityLabel={`Add missing ingredients for ${recipe.name} to grocery list`}
          >
            Quick add
          </Button>
        </Card.Actions>
      )}
    </Card>
  );
}
