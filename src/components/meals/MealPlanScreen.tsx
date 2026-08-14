import { useCallback, useEffect, useMemo, useState } from "react";
import { format, isSameDay } from "date-fns";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Button,
  Card,
  Chip,
  Divider,
  IconButton,
  Text,
} from "react-native-paper";

import { useMealsData } from "@/components/context/mealsDataContext";
import { Center } from "@/components/ui/center";
import { HStack } from "@/components/ui/hstack";
import { ScreenView } from "@/components/ui/ScreenView";
import { VStack } from "@/components/ui/vstack";
import { Spacing, TopBadgeInset } from "@/constants/theme";
import { useSession } from "@/hooks/use-session";
import { useTheme } from "@/hooks/use-theme";
import { Recipe, recipeKey } from "@/lib/meals/meals";
import {
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  MealPlanEntry,
  MealType,
  getWeekDays,
  slotKey,
  toDateKey,
} from "@/lib/meals/mealPlan";
import {
  addMealPlanToGroceryList,
  fetchMealPlanEntries,
  removeMealPlanEntry,
  setMealPlanEntry,
} from "@/lib/meals/queries";

import { PickRecipeModal } from "./PickRecipeModal";

const ERROR_COLOR = "#ff4d4f";

/** How long a success message stays on screen before clearing itself. */
const STATUS_TIMEOUT_MS = 4000;

export default function MealPlanScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const { recipes } = useMealsData();

  const [weekOffset, setWeekOffset] = useState(0);
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // The slot awaiting a recipe choice, or null when the picker is closed.
  const [pendingSlot, setPendingSlot] = useState<{
    date: string;
    mealType: MealType;
  } | null>(null);
  // Date whose card is currently showing its meal-type chooser.
  const [addingDate, setAddingDate] = useState<string | null>(null);
  const [addingAll, setAddingAll] = useState(false);
  const [status, setStatus] = useState("");

  // The screen stays mounted while you're on other tabs, so this state would
  // otherwise survive navigating away and back. Clear it on a timer instead.
  useEffect(() => {
    if (status === "") return;
    const timer = setTimeout(() => setStatus(""), STATUS_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [status]);

  // Meals already eaten don't need shopping for, so today onward only. Counts
  // both weeks, not just the one on screen.
  const upcomingEntries = useMemo(() => {
    const todayKey = toDateKey(new Date());
    return entries.filter((entry) => entry.plannedDate >= todayKey);
  }, [entries]);

  const addAllToGroceryList = async () => {
    if (!user?.id) return;
    setError("");
    setStatus("");
    setAddingAll(true);
    try {
      const count = await addMealPlanToGroceryList(
        user.id,
        // Planned twice means buy twice, so entries aren't deduplicated here.
        upcomingEntries.map((entry) => ({
          id: entry.recipeId,
          isCustom: entry.isCustom,
        })),
      );
      setStatus(
        count === 0
          ? "Nothing to add — your fridge already covers these meals."
          : `Added ${count} ${count === 1 ? "ingredient" : "ingredients"} to your grocery list.`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't build your grocery list",
      );
    } finally {
      setAddingAll(false);
    }
  };

  const today = new Date();
  const days = useMemo(() => getWeekDays(weekOffset, today), [weekOffset]);

  // Keyed by recipeKey, not raw id — catalog and custom recipes have
  // independent id sequences and would otherwise collide.
  const recipeNameByKey = useMemo(
    () => new Map(recipes.map((r) => [recipeKey(r), r.name])),
    [recipes],
  );

  const refresh = useCallback(() => {
    if (!user?.id) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Fetch both weeks at once so toggling doesn't re-hit the network.
    const all = [...getWeekDays(0), ...getWeekDays(1)];
    fetchMealPlanEntries(user.id, toDateKey(all[0]), toDateKey(all[all.length - 1]))
      .then(setEntries)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user?.id]);

  useFocusEffect(refresh);

  const entryBySlot = useMemo(() => {
    const map = new Map<string, MealPlanEntry>();
    for (const entry of entries) {
      map.set(slotKey(entry.plannedDate, entry.mealType), entry);
    }
    return map;
  }, [entries]);

  const assignRecipe = async (recipe: Recipe) => {
    if (!user?.id || !pendingSlot) return;
    setError("");
    try {
      await setMealPlanEntry(
        user.id,
        recipe,
        pendingSlot.date,
        pendingSlot.mealType,
      );
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update your meal plan");
      throw err;
    }
  };

  const clearSlot = async (entry: MealPlanEntry) => {
    setError("");
    const previous = entries;
    setEntries((current) => current.filter((e) => e.id !== entry.id));
    try {
      await removeMealPlanEntry(entry.id);
    } catch (err) {
      setEntries(previous);
      setError(err instanceof Error ? err.message : "Couldn't remove that meal");
    }
  };

  const renderDay = (day: Date) => {
    const dateKey = toDateKey(day);
    const isToday = isSameDay(day, today);
    // yyyy-MM-dd sorts lexicographically, so a string compare is a safe
    // date-only comparison — no time-of-day or timezone to get wrong.
    const isPast = dateKey < toDateKey(today);

    // Kept in MEAL_TYPES order so rows always read breakfast → snack,
    // regardless of the order they were added in.
    const filled = MEAL_TYPES.flatMap((mealType) => {
      const entry = entryBySlot.get(slotKey(dateKey, mealType));
      return entry ? [{ mealType, entry }] : [];
    });
    const free = MEAL_TYPES.filter(
      (mealType) => !entryBySlot.has(slotKey(dateKey, mealType)),
    );

    return (
      <Card
        key={dateKey}
        mode="contained"
        // Dimming the whole card (text, rows, controls) is what marks the day
        // as gone — cheaper and more consistent than restyling each child.
        style={[{ alignSelf: "stretch" }, isPast && { opacity: 0.5 }]}>
        <Card.Title
          title={format(day, "EEEE")}
          subtitle={format(day, "MMM d")}
          titleVariant="titleMedium"
          right={() =>
            isToday ? (
              <Text
                variant="labelSmall"
                style={{ color: theme.accentMeals, marginRight: Spacing.four }}>
                Today
              </Text>
            ) : null
          }
        />
        <Card.Content>
          {/* Only filled slots are rendered, so a card is as tall as the day
              is busy rather than always reserving four rows. */}
          <VStack style={{ alignSelf: "stretch" }}>
            {filled.map(({ mealType, entry }, index) => {
              const recipeName =
                recipeNameByKey.get(
                  recipeKey({ id: entry.recipeId, isCustom: entry.isCustom }),
                ) ?? "Unknown recipe";

              return (
                <VStack key={mealType} style={{ alignSelf: "stretch" }}>
                  {index > 0 && <Divider />}
                  <HStack
                    style={{
                      alignItems: "center",
                      paddingVertical: Spacing.one,
                    }}>
                    {/* Sized to its own text rather than a fixed column, so
                        "Breakfast" and "Snack" each take only what they need. */}
                    <Text
                      variant="labelMedium"
                      style={{ color: theme.textSecondary, marginRight: Spacing.two }}>
                      {MEAL_TYPE_LABELS[mealType]}
                    </Text>
                    <Text
                      variant="bodyMedium"
                      numberOfLines={1}
                      style={{ flex: 1, minWidth: 0 }}>
                      {recipeName}
                    </Text>
                    <IconButton
                      icon="close"
                      size={18}
                      style={{ margin: 0 }}
                      onPress={() => clearSlot(entry)}
                      accessibilityLabel={`Remove ${recipeName} from ${format(day, "EEEE")} ${MEAL_TYPE_LABELS[mealType]}`}
                    />
                  </HStack>
                </VStack>
              );
            })}

            {filled.length === 0 && addingDate !== dateKey && (
              <Text variant="bodySmall" style={{ color: theme.textSecondary }}>
                {isPast ? "Nothing was planned." : "Nothing planned."}
              </Text>
            )}

            {/* Past days can't be planned, so the add affordance is dropped
                entirely rather than shown disabled. The meal-type choice
                appears only once "Add meal" is tapped, and only offers slots
                this day still has free. */}
            {isPast ? null : addingDate === dateKey ? (
              <HStack space="sm" style={{ flexWrap: "wrap", paddingTop: Spacing.two }}>
                {free.map((mealType) => (
                  <Chip
                    key={mealType}
                    onPress={() => {
                      setPendingSlot({ date: dateKey, mealType });
                      setAddingDate(null);
                    }}>
                    {MEAL_TYPE_LABELS[mealType]}
                  </Chip>
                ))}
                <Button compact onPress={() => setAddingDate(null)}>
                  Cancel
                </Button>
              </HStack>
            ) : (
              free.length > 0 && (
                <Button
                  compact
                  icon="plus"
                  onPress={() => setAddingDate(dateKey)}
                  style={{ alignSelf: "flex-start" }}
                  accessibilityLabel={`Add a meal to ${format(day, "EEEE")}`}>
                  Add meal
                </Button>
              )
            )}
          </VStack>
        </Card.Content>
      </Card>
    );
  };

  return (
    <ScreenView
      header={
        <VStack
          space="sm"
          style={{
            width: "100%",
            paddingHorizontal: Spacing.four,
            paddingTop: TopBadgeInset,
            paddingBottom: Spacing.two,
          }}>
          <HStack style={{ alignItems: "center" }}>
            <IconButton
              icon="arrow-left"
              size={24}
              style={{ margin: 0 }}
              onPress={() => router.navigate("/meals")}
              accessibilityLabel="Back to meals"
            />
            <Text variant="titleLarge" style={{ marginLeft: Spacing.two, flex: 1 }}>
              Meal plan
            </Text>
          </HStack>

          <HStack space="sm" style={{ alignSelf: "stretch" }}>
            <Button
              mode={weekOffset === 0 ? "contained" : "outlined"}
              style={{ flex: 1 }}
              onPress={() => setWeekOffset(0)}
              accessibilityState={{ selected: weekOffset === 0 }}>
              This week
            </Button>
            <Button
              mode={weekOffset === 1 ? "contained" : "outlined"}
              style={{ flex: 1 }}
              onPress={() => setWeekOffset(1)}
              accessibilityState={{ selected: weekOffset === 1 }}>
              Next week
            </Button>
          </HStack>

          <Button
            mode="contained"
            icon="cart-plus"
            loading={addingAll}
            disabled={addingAll || upcomingEntries.length === 0}
            onPress={addAllToGroceryList}>
            Add all to grocery list
          </Button>
        </VStack>
      }
      overlay={
        <PickRecipeModal
          visible={pendingSlot !== null}
          onDismiss={() => setPendingSlot(null)}
          recipes={recipes}
          slotLabel={
            pendingSlot
              ? `${format(new Date(`${pendingSlot.date}T00:00:00`), "EEEE, MMM d")} · ${MEAL_TYPE_LABELS[pendingSlot.mealType]}`
              : ""
          }
          onPick={assignRecipe}
        />
      }>
      <VStack space="md" style={{ alignSelf: "stretch" }}>
        {sessionLoading || loading ? (
          <Center style={{ paddingVertical: Spacing.five }}>
            <ActivityIndicator />
          </Center>
        ) : (
          <>
            {error !== "" && <Text style={{ color: ERROR_COLOR }}>{error}</Text>}
            {status !== "" && (
              <Text style={{ color: theme.accentMeals }}>{status}</Text>
            )}
            {days.map(renderDay)}
          </>
        )}
      </VStack>
    </ScreenView>
  );
}
