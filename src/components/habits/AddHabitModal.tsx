import DateTimePicker from "@react-native-community/datetimepicker";
import { format, parse, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  Button,
  Chip,
  Icon,
  Modal,
  Portal,
  SegmentedButtons,
  Text,
  TextInput,
} from "react-native-paper";

import { useMealsData } from "@/components/context/mealsDataContext";
import { useThemeMode } from "@/components/context/ThemeContext";
import { Colors, MaxContentWidth, Radius, Spacing } from "@/constants/theme";
import type { Weekday } from "@/lib/habits/habits";
import type { Recipe } from "@/lib/meals/meals";
import {
  DEFAULT_MEAL_TIMES,
  MEAL_TYPES,
  MEAL_TYPE_LABELS,
  MealSchedule,
  MealType,
  toDateKey,
} from "@/lib/meals/mealPlan";
import { getTodaysDate } from "@/lib/time_management/week";

import { RecipeSelectList } from "./RecipeSelectList";

type ItemKind = "habit" | "meal";
type RepeatMode = "weekly" | "once";

type AddHabitModalProps = {
  visible: boolean;
  onDismiss: () => void;
  onSave?: (habit: {
    title: string;
    time: string;
    weekdays: Weekday[];
  }) => void | Promise<void>;
  onSaveMeal?: (recipe: Recipe, schedule: MealSchedule) => Promise<void>;
  // Day a one-off meal starts on (yyyy-MM-dd). Read once on mount, so
  // callers mount this modal only while it's open.
  defaultDate?: string;
  // Opens straight into meal mode with this recipe picked, and hides the
  // habit/meal switch. Used by "Add to meal plan" on the Meals tab.
  initialRecipe?: Recipe | null;
};

const WEEKDAYS: { label: string; longLabel: string; value: Weekday }[] = [
  { label: "Su", longLabel: "Sunday", value: 0 },
  { label: "Mo", longLabel: "Monday", value: 1 },
  { label: "Tu", longLabel: "Tuesday", value: 2 },
  { label: "We", longLabel: "Wednesday", value: 3 },
  { label: "Th", longLabel: "Thursday", value: 4 },
  { label: "Fr", longLabel: "Friday", value: 5 },
  { label: "Sa", longLabel: "Saturday", value: 6 },
];

const DEFAULT_MEAL_TYPE: MealType = "dinner";

function mealTimeAsDate(mealType: MealType) {
  return parse(DEFAULT_MEAL_TIMES[mealType], "h:mm aa", new Date());
}

/** Adds a habit or plans a meal. Both share the time-of-day and repeat schedule. */
export function AddHabitModal({
  visible,
  onDismiss,
  onSave,
  onSaveMeal,
  defaultDate = getTodaysDate(),
  initialRecipe = null,
}: AddHabitModalProps) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];
  const { recipes } = useMealsData();
  const mealOnly = initialRecipe !== null;

  const [kind, setKind] = useState<ItemKind>(mealOnly ? "meal" : "habit");
  const [time, setTime] = useState(() =>
    mealOnly ? mealTimeAsDate(DEFAULT_MEAL_TYPE) : new Date(),
  );
  const [showPicker, setShowPicker] = useState(false);
  const [habitTitle, setHabitTitle] = useState("");
  const [weekdays, setWeekdays] = useState<Weekday[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [recipe, setRecipe] = useState<Recipe | null>(initialRecipe);
  const [mealType, setMealType] = useState<MealType>(DEFAULT_MEAL_TYPE);
  // Meals default to a single day, matching how the old meal plan worked.
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("once");
  const [mealDate, setMealDate] = useState(() => parseISO(defaultDate));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const isMeal = kind === "meal";
  const isWeekly = !isMeal || repeatMode === "weekly";
  const isEveryDay = weekdays.length === 0;
  const scheduleSummary = useMemo(() => {
    if (isEveryDay) return "Every day";
    return WEEKDAYS.filter((day) => weekdays.includes(day.value))
      .map((day) => day.longLabel.slice(0, 3))
      .join(", ");
  }, [isEveryDay, weekdays]);

  const canSave = isMeal ? recipe !== null : habitTitle.trim().length > 0;

  const resetForm = () => {
    setHabitTitle("");
    setTime(new Date());
    setWeekdays([]);
    setShowPicker(false);
    setSaving(false);
    setError("");
  };

  const handleDismiss = () => {
    resetForm();
    onDismiss();
  };

  const changeKind = (next: ItemKind) => {
    setKind(next);
    setError("");
    setTime(next === "meal" ? mealTimeAsDate(mealType) : new Date());
  };

  const changeMealType = (next: MealType) => {
    setMealType(next);
    setTime(mealTimeAsDate(next));
  };

  const toggleWeekday = (weekday: Weekday) => {
    setWeekdays((current) => {
      if (current.includes(weekday)) {
        return current.filter((day) => day !== weekday);
      }
      return [...current, weekday].sort((a, b) => a - b);
    });
  };

  const handleTimeValueChange = (_event: unknown, selectedDate: Date) => {
    setTime(selectedDate);
    if (Platform.OS === "android") {
      setShowPicker(false);
    }
  };

  const handleDateValueChange = (_event: unknown, selectedDate: Date) => {
    setMealDate(selectedDate);
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
  };

  const handleSave = async () => {
    const title = habitTitle.trim();
    if (!isMeal && !title) {
      setError("Give your habit a name first.");
      return;
    }
    if (isMeal && !recipe) {
      setError("Pick a recipe first.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const formattedTime = format(time, "h:mm aa");
      if (isMeal && recipe) {
        await onSaveMeal?.(recipe, {
          mealType,
          time: formattedTime,
          weekdays: repeatMode === "weekly" ? weekdays : null,
          plannedDate: repeatMode === "once" ? toDateKey(mealDate) : null,
        });
      } else {
        await onSave?.({ title, time: formattedTime, weekdays });
      }
      resetForm();
      onDismiss();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : isMeal
            ? "Could not plan that meal."
            : "Could not add that habit.",
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
                  <Icon
                    source={
                      isMeal ? "silverware-fork-knife" : "check-circle-outline"
                    }
                    size={22}
                    color={colors.brand}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    variant="titleLarge"
                    style={[styles.title, { color: colors.text }]}
                  >
                    {isMeal ? "Plan a meal" : "Add habit"}
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={{ color: colors.textSecondary, marginTop: 2 }}
                  >
                    Choose what, when, and how often.
                  </Text>
                </View>
              </View>

              {mealOnly ? null : (
                <SegmentedButtons
                  value={kind}
                  onValueChange={(value) => changeKind(value as ItemKind)}
                  style={styles.kindSwitch}
                  buttons={[
                    {
                      value: "habit",
                      label: "Habit",
                      icon: "check-circle-outline",
                    },
                    {
                      value: "meal",
                      label: "Meal",
                      icon: "silverware-fork-knife",
                    },
                  ]}
                />
              )}
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {isMeal ? (
                <>
                  <View style={styles.section}>
                    <Text
                      variant="titleMedium"
                      style={{ color: colors.text, fontWeight: "800" }}
                    >
                      Recipe
                    </Text>
                    {mealOnly && recipe ? (
                      <Text variant="bodyLarge" style={{ color: colors.text }}>
                        {recipe.name}
                      </Text>
                    ) : (
                      <RecipeSelectList
                        recipes={recipes}
                        selected={recipe}
                        onSelect={setRecipe}
                      />
                    )}
                  </View>

                  <View
                    style={[
                      styles.section,
                      styles.dividedSection,
                      { borderTopColor: colors.border },
                    ]}
                  >
                    <Text
                      variant="titleMedium"
                      style={{ color: colors.text, fontWeight: "800" }}
                    >
                      Meal
                    </Text>
                    <View style={styles.weekdayRow}>
                      {MEAL_TYPES.map((type) => {
                        const selected = mealType === type;
                        return (
                          <Chip
                            key={type}
                            selected={selected}
                            showSelectedCheck={false}
                            onPress={() => changeMealType(type)}
                            style={{
                              backgroundColor: selected
                                ? colors.backgroundSelected
                                : colors.background,
                              borderColor: selected
                                ? colors.brand
                                : colors.border,
                            }}
                            textStyle={{
                              color: selected
                                ? colors.brandStrong
                                : colors.text,
                              fontWeight: selected ? "800" : "600",
                            }}
                          >
                            {MEAL_TYPE_LABELS[type]}
                          </Chip>
                        );
                      })}
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.section}>
                  <TextInput
                    label="Habit name"
                    mode="outlined"
                    value={habitTitle}
                    onChangeText={setHabitTitle}
                    placeholder="Drink water"
                    outlineColor={colors.border}
                    activeOutlineColor={colors.brand}
                    returnKeyType="done"
                  />
                </View>
              )}

              <View
                style={[
                  styles.section,
                  styles.dividedSection,
                  { borderTopColor: colors.border },
                ]}
              >
                <View style={styles.sectionHeader}>
                  <View>
                    <Text
                      variant="titleMedium"
                      style={{ color: colors.text, fontWeight: "800" }}
                    >
                      Time of day
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{ color: colors.textSecondary, marginTop: 2 }}
                    >
                      {isMeal
                        ? "When do you plan to eat this?"
                        : "When do you want this habit on your list?"}
                    </Text>
                  </View>
                </View>

                <Button
                  mode="outlined"
                  icon="clock-outline"
                  onPress={() => setShowPicker(true)}
                  textColor={colors.brandStrong}
                  style={[styles.timeButton, { borderColor: colors.border }]}
                  contentStyle={styles.timeButtonContent}
                >
                  {format(time, "h:mm aa")}
                </Button>

                {showPicker ? (
                  <View
                    style={[
                      styles.pickerWrap,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <DateTimePicker
                      value={time}
                      mode="time"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      is24Hour={false}
                      onValueChange={handleTimeValueChange}
                      onDismiss={() => setShowPicker(false)}
                    />
                    {Platform.OS === "ios" ? (
                      <Button compact onPress={() => setShowPicker(false)}>
                        Done
                      </Button>
                    ) : null}
                  </View>
                ) : null}
              </View>

              <View
                style={[
                  styles.section,
                  styles.dividedSection,
                  { borderTopColor: colors.border },
                ]}
              >
                <View style={styles.sectionHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text
                      variant="titleMedium"
                      style={{ color: colors.text, fontWeight: "800" }}
                    >
                      Repeat
                    </Text>
                    <Text
                      variant="bodySmall"
                      style={{ color: colors.textSecondary, marginTop: 2 }}
                    >
                      {isWeekly
                        ? scheduleSummary
                        : format(mealDate, "EEEE, MMM d")}
                    </Text>
                  </View>

                  {isWeekly ? (
                    <Chip
                      selected={isEveryDay}
                      showSelectedCheck={false}
                      onPress={() => setWeekdays([])}
                      style={{
                        backgroundColor: isEveryDay
                          ? colors.backgroundSelected
                          : colors.background,
                        borderColor: isEveryDay ? colors.brand : colors.border,
                      }}
                      textStyle={{
                        color: isEveryDay ? colors.brandStrong : colors.text,
                        fontWeight: isEveryDay ? "800" : "600",
                      }}
                    >
                      Every day
                    </Chip>
                  ) : null}
                </View>

                {isMeal ? (
                  <SegmentedButtons
                    value={repeatMode}
                    onValueChange={(value) => setRepeatMode(value as RepeatMode)}
                    buttons={[
                      { value: "once", label: "One day", icon: "calendar" },
                      { value: "weekly", label: "Weekly", icon: "repeat" },
                    ]}
                  />
                ) : null}

                {isWeekly ? (
                  <View style={styles.weekdayRow}>
                    {WEEKDAYS.map((day) => {
                      const selected = weekdays.includes(day.value);
                      return (
                        <Chip
                          key={day.value}
                          compact
                          selected={selected}
                          showSelectedCheck={false}
                          onPress={() => toggleWeekday(day.value)}
                          style={[
                            styles.weekdayChip,
                            {
                              backgroundColor: selected
                                ? colors.backgroundSelected
                                : colors.background,
                              borderColor: selected
                                ? colors.brand
                                : colors.border,
                            },
                          ]}
                          textStyle={{
                            color: selected ? colors.brandStrong : colors.text,
                            fontWeight: selected ? "800" : "600",
                          }}
                        >
                          {day.label}
                        </Chip>
                      );
                    })}
                  </View>
                ) : (
                  <>
                    <Button
                      mode="outlined"
                      icon="calendar"
                      onPress={() => setShowDatePicker(true)}
                      textColor={colors.brandStrong}
                      style={[
                        styles.timeButton,
                        { borderColor: colors.border },
                      ]}
                      contentStyle={styles.timeButtonContent}
                    >
                      {format(mealDate, "EEEE, MMM d")}
                    </Button>

                    {showDatePicker ? (
                      <View
                        style={[
                          styles.pickerWrap,
                          {
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <DateTimePicker
                          value={mealDate}
                          mode="date"
                          minimumDate={parseISO(getTodaysDate())}
                          display={Platform.OS === "ios" ? "inline" : "default"}
                          onValueChange={handleDateValueChange}
                          onDismiss={() => setShowDatePicker(false)}
                        />
                        {Platform.OS === "ios" ? (
                          <Button
                            compact
                            onPress={() => setShowDatePicker(false)}
                          >
                            Done
                          </Button>
                        ) : null}
                      </View>
                    ) : null}
                  </>
                )}
              </View>

              {error ? (
                <View
                  style={[
                    styles.errorBox,
                    {
                      backgroundColor:
                        resolvedTheme === "dark" ? "#3A2023" : "#FDECEE",
                      borderColor: colors.danger,
                    },
                  ]}
                >
                  <Icon
                    source="alert-circle-outline"
                    size={18}
                    color={colors.danger}
                  />
                  <Text
                    variant="bodySmall"
                    style={{ color: colors.danger, flex: 1 }}
                  >
                    {error}
                  </Text>
                </View>
              ) : null}
            </ScrollView>

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
                icon="plus"
                onPress={handleSave}
                loading={saving}
                disabled={saving || !canSave}
                buttonColor={colors.brandStrong}
                textColor="#FFFFFF"
                style={styles.saveButton}
              >
                {isMeal ? "Plan meal" : "Add habit"}
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
    justifyContent: "flex-end",
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  keyboardWrap: {
    width: "100%",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    maxHeight: "90%",
  },
  sheet: {
    width: "100%",
    maxHeight: "100%",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.large,
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  titleIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.medium,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontWeight: "900",
  },
  kindSwitch: {
    alignSelf: "stretch",
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
  },
  section: {
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  dividedSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  timeButton: {
    borderRadius: Radius.medium,
  },
  timeButtonContent: {
    minHeight: 48,
    justifyContent: "flex-start",
  },
  pickerWrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    padding: Spacing.two,
  },
  weekdayRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  weekdayChip: {
    minWidth: 48,
    alignItems: "center",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    marginTop: Spacing.one,
  },
  actions: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: Spacing.two,
  },
  saveButton: {
    borderRadius: Radius.pill,
  },
});
