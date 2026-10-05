import { useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Button,
  Card,
  Checkbox,
  Divider,
  IconButton,
  ProgressBar,
  Text,
  TouchableRipple,
} from "react-native-paper";

import { Center } from "@/components/ui/center";
import { HStack } from "@/components/ui/hstack";
import { ScreenView } from "@/components/ui/ScreenView";
import { VStack } from "@/components/ui/vstack";
import { Spacing, TopBadgeInset } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  clearCookingProgress,
  loadCookingProgress,
  saveCookingProgress,
} from "@/lib/meals/cooking";
import { RecipeDetail, parseInstructionSteps } from "@/lib/meals/meals";
import { fetchRecipeDetail } from "@/lib/meals/queries";

const ERROR_COLOR = "#ff4d4f";

/**
 * Step-by-step cooking: one checkbox per step. Checks are saved as they're
 * made, so leaving this screen pauses cooking and coming back resumes it.
 * Checking the last step shows the finished message; "Done" clears the saved
 * progress so the next cook starts fresh.
 */
export default function CookingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id, isCustom } = useLocalSearchParams<{ id: string; isCustom: string }>();

  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [checked, setChecked] = useState<ReadonlySet<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const steps = parseInstructionSteps(recipe?.instructions ?? null);
  const finished = steps.length > 0 && checked.size === steps.length;

  useEffect(() => {
    if (!id) {
      setError("That recipe couldn't be found.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchRecipeDetail(id, isCustom === "true")
      .then(async (detail) => {
        const saved = await loadCookingProgress(
          detail,
          parseInstructionSteps(detail.instructions).length,
        );
        if (cancelled) return;
        setRecipe(detail);
        setChecked(saved);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isCustom]);

  const updateChecked = (next: ReadonlySet<number>) => {
    setChecked(next);
    if (recipe) {
      saveCookingProgress(recipe, steps.length, next).catch((err) =>
        console.log("Error saving cooking progress: ", err),
      );
    }
  };

  const toggleStep = (index: number) => {
    const next = new Set(checked);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    updateChecked(next);
  };

  const finishCooking = async () => {
    if (recipe) await clearCookingProgress(recipe).catch(() => {});
    router.back();
  };

  return (
    <ScreenView
      header={
        <VStack
          style={{
            width: "100%",
            paddingHorizontal: Spacing.four,
            paddingTop: TopBadgeInset,
            paddingBottom: Spacing.two,
          }}
        >
          <HStack style={{ alignItems: "center" }}>
            <IconButton
              icon="arrow-left"
              size={24}
              style={{ margin: 0 }}
              onPress={() => router.back()}
              accessibilityLabel="Back"
            />
            <Text
              variant="titleLarge"
              numberOfLines={1}
              style={{ marginLeft: Spacing.two, flex: 1 }}
            >
              {recipe?.name ?? "Cooking"}
            </Text>
          </HStack>
        </VStack>
      }
    >
      <VStack space="md" style={{ alignSelf: "stretch" }}>
        {loading ? (
          <Center style={{ paddingVertical: Spacing.five }}>
            <ActivityIndicator />
          </Center>
        ) : error !== "" || !recipe ? (
          <Text style={{ color: ERROR_COLOR }}>
            {error || "That recipe couldn't be found."}
          </Text>
        ) : steps.length === 0 ? (
          <Text style={{ color: theme.textSecondary }}>
            This recipe has no steps to follow.
          </Text>
        ) : (
          <>
            <VStack space="xs" style={{ alignSelf: "stretch" }}>
              <Text variant="labelLarge" style={{ color: theme.textSecondary }}>
                {checked.size} of {steps.length} steps done
              </Text>
              <ProgressBar progress={checked.size / steps.length} />
            </VStack>

            {finished && (
              <Card mode="contained">
                <Card.Title
                  title="Finished!"
                  subtitle={`You made ${recipe.name}. Enjoy your meal.`}
                  titleVariant="titleLarge"
                />
                <Card.Actions>
                  <Button mode="contained" onPress={finishCooking}>
                    Done
                  </Button>
                </Card.Actions>
              </Card>
            )}

            <VStack style={{ alignSelf: "stretch" }}>
              {steps.map((step, index) => {
                const done = checked.has(index);
                return (
                  <View key={index}>
                    {index > 0 && <Divider />}
                    {/* The whole row is the tap target, not just the box —
                        easier with messy hands. */}
                    <TouchableRipple
                      onPress={() => toggleStep(index)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: done }}
                      accessibilityLabel={`Step ${index + 1}: ${step}`}
                    >
                      <HStack
                        style={{
                          alignItems: "flex-start",
                          paddingVertical: Spacing.two,
                        }}
                      >
                        <Checkbox
                          status={done ? "checked" : "unchecked"}
                          onPress={() => toggleStep(index)}
                        />
                        <VStack
                          style={{ flex: 1, minWidth: 0, paddingLeft: Spacing.two }}
                        >
                          <Text
                            variant="labelLarge"
                            style={{ color: theme.accentMeals }}
                          >
                            Step {index + 1}
                          </Text>
                          <Text
                            variant="bodyLarge"
                            style={
                              done
                                ? {
                                    textDecorationLine: "line-through",
                                    color: theme.textSecondary,
                                  }
                                : undefined
                            }
                          >
                            {step}
                          </Text>
                        </VStack>
                      </HStack>
                    </TouchableRipple>
                  </View>
                );
              })}
            </VStack>

            {checked.size > 0 && !finished && (
              <Button mode="text" onPress={() => updateChecked(new Set())}>
                Start over
              </Button>
            )}
          </>
        )}
      </VStack>
    </ScreenView>
  );
}
