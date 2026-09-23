import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  Button,
  HelperText,
  Icon,
  Modal,
  Portal,
  Text,
  TextInput,
} from "react-native-paper";

import { useThemeMode } from "@/components/context/ThemeContext";
import { Colors, Radius, Spacing } from "@/constants/theme";
import type { Ingredient } from "@/lib/meals/meals";
import { IngredientPicker } from "./IngredientPicker";

type RecipeIngredientInput = {
  ingredient_id: string;
};

export type CreateRecipeInput = {
  name: string;
  prep_time_min: number;
  ingredients: RecipeIngredientInput[];
};

type AddRecipeModalProps = {
  visible: boolean;
  availableIngredients: Ingredient[];
  onDismiss: () => void;
  onCreate: (input: CreateRecipeInput) => void | Promise<void>;
};

export function AddRecipeModal({
  visible,
  availableIngredients,
  onDismiss,
  onCreate,
}: AddRecipeModalProps) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  const [name, setName] = useState("");
  const [prepTime, setPrepTime] = useState("10");
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleDismiss = () => {
    if (saving) return;
    setError("");
    onDismiss();
  };

  const toggleIngredient = (ingredient: Ingredient) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(ingredient.id)) next.delete(ingredient.id);
      else next.add(ingredient.id);
      return next;
    });
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    const ingredientIds = Array.from(selectedIds);

    if (!trimmedName) {
      setError("Please enter a recipe name.");
      return;
    }

    if (ingredientIds.length === 0) {
      setError("Please select at least one ingredient.");
      return;
    }

    const availableIds = new Set(
      availableIngredients.map((ingredient) => ingredient.id),
    );
    const hasUnknownIngredient = ingredientIds.some(
      (id) => !availableIds.has(id),
    );

    if (hasUnknownIngredient) {
      setError("One or more selected ingredients are no longer available.");
      return;
    }

    const prepTimeMin = Number(prepTime.trim());
    if (
      !prepTime.trim() ||
      !Number.isFinite(prepTimeMin) ||
      !Number.isInteger(prepTimeMin) ||
      prepTimeMin <= 0
    ) {
      setError("Prep time must be a positive whole number.");
      return;
    }

    const input: CreateRecipeInput = {
      name: trimmedName,
      prep_time_min: prepTimeMin,
      ingredients: ingredientIds.map((id) => ({ ingredient_id: id })),
    };

    try {
      setError("");
      setSaving(true);
      await onCreate(input);
      setName("");
      setPrepTime("10");
      setSelectedIds(new Set());
      onDismiss();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not create the recipe.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleDismiss}
        contentContainerStyle={styles.modalOuter}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardWrap}
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.backgroundElement,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <View
                  style={[
                    styles.titleIcon,
                    { backgroundColor: colors.brandSoft },
                  ]}
                >
                  <Icon source="chef-hat" size={21} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    variant="titleLarge"
                    style={[styles.title, { color: colors.text }]}
                  >
                    Create recipe
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={{ color: colors.textSecondary, marginTop: 2 }}
                  >
                    Add the basics now. A photo can be added later.
                  </Text>
                </View>
              </View>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.detailsSection}>
                <TextInput
                  label="Recipe name"
                  mode="outlined"
                  value={name}
                  onChangeText={setName}
                  outlineColor={colors.border}
                  activeOutlineColor={colors.brand}
                />

                <TextInput
                  label="Prep time (minutes)"
                  mode="outlined"
                  value={prepTime}
                  onChangeText={setPrepTime}
                  keyboardType="number-pad"
                  outlineColor={colors.border}
                  activeOutlineColor={colors.brand}
                />
              </View>

              <View
                style={[
                  styles.ingredientsSection,
                  { borderTopColor: colors.border },
                ]}
              >
                <View style={styles.sectionHeadingRow}>
                  <View>
                    <Text
                      variant="titleMedium"
                      style={{ color: colors.text, fontWeight: "800" }}
                    >
                      Ingredients
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{ color: colors.textSecondary, marginTop: 2 }}
                    >
                      Choose everything this recipe needs.
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.countBadge,
                      { backgroundColor: colors.brandSoft },
                    ]}
                  >
                    <Text
                      variant="labelMedium"
                      style={{ color: colors.brandStrong, fontWeight: "800" }}
                    >
                      {selectedIds.size} selected
                    </Text>
                  </View>
                </View>

                <IngredientPicker
                  ingredients={availableIngredients}
                  selectedIds={selectedIds}
                  onToggle={toggleIngredient}
                />
              </View>
            </ScrollView>

            {error ? (
              <HelperText type="error" visible style={styles.errorText}>
                {error}
              </HelperText>
            ) : null}

            <View style={[styles.actions, { borderTopColor: colors.border }]}>
              <Button
                mode="text"
                onPress={handleDismiss}
                disabled={saving}
                textColor={colors.textSecondary}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                icon="check"
                onPress={handleCreate}
                loading={saving}
                disabled={saving}
                buttonColor={colors.brandStrong}
                textColor="#FFFFFF"
                style={{ borderRadius: Radius.pill }}
              >
                Create recipe
              </Button>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalOuter: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
  },
  keyboardWrap: {
    width: "100%",
    alignItems: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: 680,
    maxHeight: "88%",
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  titleIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.medium,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontWeight: "800",
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  detailsSection: {
    gap: Spacing.three,
  },
  ingredientsSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
  sectionHeadingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.three,
  },
  countBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
  },
  errorText: {
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.one,
  },
  actions: {
    minHeight: 70,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: Spacing.two,
  },
});
