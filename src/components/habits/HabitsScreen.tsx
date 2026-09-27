import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { format, isToday, parseISO } from "date-fns";
import { Button, Icon, ProgressBar, Text } from "react-native-paper";

import { useHabitsContext } from "@/components/context/habitsContext";
import { useThemeMode } from "@/components/context/ThemeContext";
import { ScreenView } from "@/components/ui/ScreenView";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { getHabitsForDate, isHabitDone } from "@/lib/habits/habits";

import { AddHabitModal } from "./AddHabitModal";
import { HabitCard } from "./HabitCard";
import { WeekStrip } from "./WeekStrip";

export default function HabitsScreen() {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];
  const {
    selectedDate,
    setSelectedDate,
    habitArray,
    habitCompletions,
    addHabit,
    removeHabit,
    toggleHabit,
  } = useHabitsContext();

  const [modalVisible, setModalVisible] = useState(false);

  const habitsForDay = useMemo(
    () => getHabitsForDate(habitArray, selectedDate),
    [habitArray, selectedDate],
  );

  const habitsComplete = useMemo(
    () =>
      habitsForDay.filter((habit) =>
        isHabitDone(habit.id, selectedDate, habitCompletions),
      ).length,
    [habitsForDay, selectedDate, habitCompletions],
  );

  const total = habitsForDay.length;
  const progress = total > 0 ? habitsComplete / total : 0;
  const selectedDateObject = parseISO(selectedDate);
  const selectedLabel = isToday(selectedDateObject)
    ? "Today"
    : format(selectedDateObject, "EEEE, MMM d");

  return (
    <ScreenView
      contentContainerStyle={styles.content}
      overlay={
        <AddHabitModal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          onSave={addHabit}
        />
      }
      header={
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View
              style={[styles.titleIcon, { backgroundColor: colors.brandSoft }]}
            >
              <Icon
                source="check-circle-outline"
                size={22}
                color={colors.brand}
              />
            </View>

            <View style={styles.titleCopy}>
              <Text
                variant="headlineMedium"
                style={[styles.title, { color: colors.text }]}
              >
                Habits
              </Text>
              <Text
                variant="bodyMedium"
                style={{ color: colors.textSecondary }}
              >
                Small routines, kept consistent.
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.progressCard,
              {
                backgroundColor: colors.backgroundElement,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.progressTopRow}>
              <View>
                <Text
                  variant="labelMedium"
                  style={{ color: colors.textSecondary }}
                >
                  {selectedLabel.toUpperCase()}
                </Text>
                <Text
                  variant="titleLarge"
                  style={[styles.progressValue, { color: colors.text }]}
                >
                  {total === 0
                    ? "No habits"
                    : `${habitsComplete}/${total} complete`}
                </Text>
              </View>

              {total > 0 ? (
                <View
                  style={[
                    styles.percentBadge,
                    { backgroundColor: colors.brandSoft },
                  ]}
                >
                  <Text
                    variant="labelLarge"
                    style={{ color: colors.brandStrong, fontWeight: "800" }}
                  >
                    {Math.round(progress * 100)}%
                  </Text>
                </View>
              ) : null}
            </View>

            <ProgressBar
              progress={progress}
              color={colors.brand}
              style={[styles.progressBar, { backgroundColor: colors.border }]}
            />
          </View>

          <WeekStrip
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </View>
      }
    >
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text
            variant="titleLarge"
            style={{ color: colors.text, fontWeight: "800" }}
          >
            {selectedLabel}
          </Text>
          <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
            {total === 0
              ? "Nothing scheduled for this day yet."
              : `${total} ${total === 1 ? "habit" : "habits"} scheduled`}
          </Text>
        </View>
      </View>

      <View style={styles.list}>
        {habitsForDay.map((habit) => (
          <HabitCard
            key={habit.id}
            title={habit.title}
            time={habit.time}
            weekdays={habit.weekdays}
            isDone={isHabitDone(habit.id, selectedDate, habitCompletions)}
            onToggle={() =>
              toggleHabit({ habitId: habit.id, habitDate: selectedDate })
            }
            onDelete={() => removeHabit(habit.id)}
          />
        ))}

        {total === 0 ? (
          <View
            style={[
              styles.emptyState,
              {
                backgroundColor: colors.backgroundElement,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[styles.emptyIcon, { backgroundColor: colors.brandSoft }]}
            >
              <Icon
                source="calendar-check-outline"
                size={28}
                color={colors.brand}
              />
            </View>
            <Text
              variant="titleMedium"
              style={{ color: colors.text, fontWeight: "800" }}
            >
              Nothing scheduled
            </Text>
            <Text
              variant="bodyMedium"
              style={[styles.emptyCopy, { color: colors.textSecondary }]}
            >
              Add a habit and choose the days you want it to appear.
            </Text>
          </View>
        ) : null}
      </View>

      <Button
        mode="contained"
        icon="plus"
        onPress={() => setModalVisible(true)}
        buttonColor={colors.brandStrong}
        textColor="#FFFFFF"
        contentStyle={styles.addButtonContent}
        style={styles.addButton}
      >
        Add habit
      </Button>
    </ScreenView>
  );
}

const styles = StyleSheet.create({
  header: {
    width: "100%",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
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
  titleCopy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  progressCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.large,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  progressTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  progressValue: {
    marginTop: 2,
    fontWeight: "900",
  },
  percentBadge: {
    minWidth: 54,
    height: 36,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  progressBar: {
    height: 8,
    borderRadius: Radius.pill,
    overflow: "hidden",
  },
  content: {
    gap: Spacing.three,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  list: {
    gap: Spacing.two,
  },
  emptyState: {
    minHeight: 190,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.large,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.one,
  },
  emptyCopy: {
    textAlign: "center",
    maxWidth: 290,
    lineHeight: 20,
  },
  addButton: {
    borderRadius: Radius.pill,
    marginTop: Spacing.one,
  },
  addButtonContent: {
    minHeight: 50,
  },
});
