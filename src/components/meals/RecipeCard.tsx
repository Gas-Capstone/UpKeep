import { useState } from "react";
import { Card, Text, IconButton, useTheme } from "react-native-paper";

import type { AppTheme } from "@/constants/paper-theme";

type RecipeCardProps = {
  name: string;
  prepTimeMin: number;
  missingNames: string[];
  totalIngredients: number;
};

export function RecipeCard({ name, prepTimeMin, missingNames, totalIngredients }: RecipeCardProps) {
  const theme = useTheme<AppTheme>();
  const ready = missingNames.length === 0;
  const [isFavorited, setIsFavorited] = useState(false);

  return (
    <Card mode="contained">
      <Card.Title
        title={name}
        subtitle={`${prepTimeMin} min`}
        right={() => (
          <IconButton
            icon={isFavorited ? "star" : "star-outline"}
            iconColor={
              isFavorited ? theme.colors.primary : theme.colors.onSurfaceVariant
            }
            size={22}
            onPress={() => setIsFavorited((prev) => !prev)}
            accessibilityLabel={
              isFavorited
                ? `Remove ${name} from favorites`
                : `Add ${name} to favorites`
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
            ? `You have all ${totalIngredients} ingredients`
            : `Need ${missingNames.length}: ${missingNames.join(", ")}`}
        </Text>
      </Card.Content>
    </Card>
  );
}
