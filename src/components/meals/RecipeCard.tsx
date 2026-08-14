import { View } from "react-native";
import { Button, Card, Text, IconButton, useTheme } from "react-native-paper";

import type { AppTheme } from "@/constants/paper-theme";
import type { Recipe } from "@/lib/meals/meals";
type RecipeCardProps = {
  recipe: Recipe,
  isFavorited: boolean,
  missingNames: String[],
  onToggleFavorite: () => void
  // Queues this recipe's missing ingredients onto the grocery list.
  onQuickAdd?: () => void;
  adding?: boolean;
  // Opens the day/meal picker to place this recipe on the plan.
  onAddToPlan?: () => void;
  // Opens the full recipe page.
  onOpen?: () => void;
};

export function RecipeCard({
  missingNames,
  recipe,
  onToggleFavorite,
  isFavorited,
  onQuickAdd,
  adding = false,
  onAddToPlan,
  onOpen,
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
        right={() => (
          <IconButton
            icon={isFavorited ? "star" : "star-outline"}
            iconColor={
              isFavorited ? theme.colors.primary : theme.colors.onSurfaceVariant
            }
            size={22}
            onPress={onToggleFavorite}
            accessibilityLabel={
              isFavorited
                ? `Remove ${recipe.name} from favorites`
                : `Add ${recipe.name} to favorites`
            }
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
      {(onQuickAdd || onAddToPlan) && (
        <Card.Actions>
          {/* Card.Actions right-aligns its children, so this row spans the
              full width to push "Add to plan" to the left edge while Quick
              add stays on the right. */}
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {onAddToPlan ? (
              <Button
                mode="outlined"
                icon="calendar-plus"
                onPress={onAddToPlan}
                style={{ borderRadius: 999 }}
                accessibilityLabel={`Add ${recipe.name} to meal plan`}
              >
                Add to plan
              </Button>
            ) : (
              // Keeps Quick add hard right when there's no left-hand button.
              <View />
            )}

            {onQuickAdd && (
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
            )}
          </View>
        </Card.Actions>
      )}
    </Card>
  );
}
