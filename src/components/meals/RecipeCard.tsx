import { StyleSheet, View } from "react-native";
import { Button, Card, Icon, IconButton, Text } from "react-native-paper";

import { useThemeMode } from "@/components/context/ThemeContext";
import { BrandImagePlaceholder } from "@/components/ui/BrandImagePlaceholder";
import { Colors, Radius, Spacing } from "@/constants/theme";
import type { Recipe } from "@/lib/meals/meals";

type RecipeCardProps = {
  recipe: Recipe;
  isFavorited: boolean;
  missingNames: string[];
  onToggleFavorite: () => void;
  onQuickAdd?: () => void;
  adding?: boolean;
  onAddToPlan?: () => void;
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
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];
  const ready = missingNames.length === 0;

  return (
    <Card
      mode="contained"
      onPress={onOpen}
      style={[
        styles.card,
        {
          backgroundColor: colors.backgroundElement,
          borderColor: colors.border,
        },
      ]}
    >
      <Card.Content style={styles.content}>
        <BrandImagePlaceholder
          label="Recipe photo"
          icon="silverware-fork-knife"
          style={styles.imageSlot}
        />

        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                variant="titleMedium"
                numberOfLines={2}
                style={[styles.title, { color: colors.text }]}
              >
                {recipe.name}
              </Text>

              <View style={styles.metaRow}>
                <Icon
                  source="clock-outline"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text
                  variant="bodySmall"
                  style={{ color: colors.textSecondary }}
                >
                  {recipe.prepTimeMin
                    ? `${recipe.prepTimeMin} min`
                    : "Prep time not set"}
                </Text>
              </View>
            </View>

            <IconButton
              icon={isFavorited ? "star" : "star-outline"}
              iconColor={isFavorited ? colors.warning : colors.textSecondary}
              size={21}
              onPress={onToggleFavorite}
              style={styles.favoriteButton}
              accessibilityLabel={
                isFavorited
                  ? `Remove ${recipe.name} from favorites`
                  : `Add ${recipe.name} to favorites`
              }
            />
          </View>

          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: ready
                  ? resolvedTheme === "dark"
                    ? "#16382C"
                    : "#E7F5EC"
                  : resolvedTheme === "dark"
                    ? "#3B2C16"
                    : "#FFF1DE",
              },
            ]}
          >
            <Icon
              source={ready ? "check-circle-outline" : "basket-outline"}
              size={14}
              color={ready ? colors.success : colors.warning}
            />
            <Text
              variant="labelSmall"
              style={{
                color: ready ? colors.success : colors.warning,
                fontWeight: "800",
              }}
            >
              {ready
                ? "Ready to cook"
                : `Missing ${missingNames.length} ingredient${missingNames.length === 1 ? "" : "s"}`}
            </Text>
          </View>

          {!ready ? (
            <Text
              variant="bodySmall"
              numberOfLines={2}
              style={{ color: colors.textSecondary }}
            >
              {missingNames.join(", ")}
            </Text>
          ) : (
            <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
              You have all {recipe.ingredientIds.length} ingredients.
            </Text>
          )}
        </View>
      </Card.Content>

      {(onQuickAdd || onAddToPlan) && (
        <Card.Actions style={styles.actions}>
          {onAddToPlan ? (
            <Button
              compact
              mode="outlined"
              icon="calendar-plus"
              onPress={onAddToPlan}
              textColor={colors.brandStrong}
              style={[styles.actionButton, { borderColor: colors.border }]}
              accessibilityLabel={`Add ${recipe.name} to meal plan`}
            >
              Plan
            </Button>
          ) : (
            <View />
          )}

          {onQuickAdd ? (
            <Button
              compact
              mode="contained"
              icon="plus"
              loading={adding}
              disabled={adding}
              onPress={onQuickAdd}
              buttonColor={colors.brandStrong}
              textColor="#FFFFFF"
              style={styles.actionButton}
              accessibilityLabel={`Add missing ingredients for ${recipe.name} to grocery list`}
            >
              Quick add
            </Button>
          ) : null}
        </Card.Actions>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    flexDirection: "row",
    gap: Spacing.three,
  },
  imageSlot: {
    width: 92,
    minHeight: 104,
    alignSelf: "stretch",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.two,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.one,
  },
  title: {
    fontWeight: "800",
    lineHeight: 21,
  },
  favoriteButton: {
    margin: -6,
  },
  metaRow: {
    marginTop: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  actions: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    paddingTop: 0,
    justifyContent: "space-between",
  },
  actionButton: {
    borderRadius: Radius.pill,
  },
});
