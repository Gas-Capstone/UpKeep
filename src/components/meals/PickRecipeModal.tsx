import { useEffect, useMemo, useState } from "react";
import { ScrollView } from "react-native";
import {
  Button,
  Card,
  Divider,
  HelperText,
  Modal,
  Portal,
  Searchbar,
  Text,
  TouchableRipple,
} from "react-native-paper";

import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { styles } from "@/constants/styles";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { Recipe, recipeKey } from "@/lib/meals/meals";

type PickRecipeModalProps = {
  visible: boolean;
  onDismiss: () => void;
  recipes: Recipe[];
  // Which slot this will fill, e.g. "Monday, Aug 18 · Dinner".
  slotLabel: string;
  onPick: (recipe: Recipe) => Promise<void>;
};

/** Searchable recipe list for filling one meal plan slot. */
export function PickRecipeModal({
  visible,
  onDismiss,
  recipes,
  slotLabel,
  onPick,
}: PickRecipeModalProps) {
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setQuery("");
    setError("");
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? recipes.filter((r) => r.name.toLowerCase().includes(q)) : recipes;
  }, [recipes, query]);

  const handlePick = async (recipe: Recipe) => {
    setError("");
    setSaving(true);
    try {
      await onPick(recipe);
      onDismiss();
    } catch {
      setError("Couldn't save that. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContent}>
        <Card mode="contained" style={styles.modalCard}>
          <Card.Title
            title={<Text variant="titleLarge">Pick a recipe</Text>}
            subtitle={slotLabel}
          />
          <Card.Content>
            <VStack space="sm" style={{ alignSelf: "stretch" }}>
              <Searchbar
                placeholder="Search recipes"
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
              />

              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                {filtered.length === 0 ? (
                  <Text style={{ color: theme.textSecondary }}>No recipes found.</Text>
                ) : (
                  <VStack style={{ alignSelf: "stretch" }}>
                    {filtered.map((recipe, index) => (
                      <VStack key={recipeKey(recipe)} style={{ alignSelf: "stretch" }}>
                        {index > 0 && <Divider />}
                        <TouchableRipple
                          disabled={saving}
                          onPress={() => handlePick(recipe)}>
                          <VStack style={{ paddingVertical: Spacing.two }}>
                            <Text variant="bodyLarge">{recipe.name}</Text>
                            <Text
                              variant="labelSmall"
                              style={{ color: theme.textSecondary }}>
                              {recipe.prepTimeMin} min
                            </Text>
                          </VStack>
                        </TouchableRipple>
                      </VStack>
                    ))}
                  </VStack>
                )}
              </ScrollView>

              {error !== "" && (
                <HelperText type="error" visible>
                  {error}
                </HelperText>
              )}
            </VStack>
          </Card.Content>
          <Card.Actions>
            <HStack style={styles.rowBox}>
              <Button onPress={onDismiss} disabled={saving}>
                Cancel
              </Button>
            </HStack>
          </Card.Actions>
        </Card>
      </Modal>
    </Portal>
  );
}
