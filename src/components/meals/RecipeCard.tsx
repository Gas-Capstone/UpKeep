import { useState } from "react";
import { Card, Text, IconButton, useTheme } from "react-native-paper";

import type { AppTheme } from "@/constants/paper-theme";
import type { Recipe } from "@/lib/meals/meals";
type RecipeCardProps = {
  recipe: Recipe,
  isFavorited: boolean,
  missingNames: String[],
  onToggleFavorite: () => void
};

export function RecipeCard({ missingNames, recipe, onToggleFavorite, isFavorited }: RecipeCardProps) {
  const theme = useTheme<AppTheme>();
  const ready = missingNames.length === 0;

  return (
    <Card mode="contained">
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
    </Card>
  );
}
