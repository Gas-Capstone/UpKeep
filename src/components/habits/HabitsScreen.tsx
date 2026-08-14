import { styles } from "@/constants/styles";
import { ThemedView } from "../themed-view";
import { useTheme } from "@/hooks/use-theme";
import { useState } from "react";
import type { NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { Divider, Text, AnimatedFAB } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import { VStack } from "@/components/ui/vstack";
import { Center } from "../ui/center";
import { WeekStrip } from "./WeekStrip";
import { View } from "react-native";
import { HabitAnimatedFAB } from "./HabitAnimatedFAB";
import { HabitCard } from "./HabitCard";
import { isHabitDone, getHabitsForDate } from "@/lib/habits/habits";
import { AddHabitModal } from "./AddHabitModal";
import { ScreenView } from "../ui/ScreenView";
import { Spacing, TopBadgeInset } from "@/constants/theme";
import { useHabitsContext } from "../context/habitsContext";
import { createHabit, getHabitsByUser, getCompletedHabitsByUser, deleteHabit } from "@/lib/supabaseFunctions";
import { useUserContext } from "../context/userContext";

export default function HabitsScreen() {
  // habit state now lives in habitsContext so index.tsx can read the same data.
  const {
    selectedDate,
    setSelectedDate,
    habitArray,
    habitCompletions,
    addHabit,
    removeHabit,
    toggleHabit,
  } = useHabitsContext();
  const { user } = useUserContext()
  const [ habitsList, setHabitsList ] = useState([])
  const [ completedHabits, setCompletedHabits ] = useState([])
  const [fabExtended, setFabExtended] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const habitsForDay = getHabitsForDate(habitArray, selectedDate);
  const habitNumber = habitsForDay.length;
  // use .filter to grab number of habits complete based on result of isHabitDone() for given habit
  const habitsComplete = habitsForDay.filter((habit) =>
    isHabitDone(habit.id, selectedDate, habitCompletions),
  ).length;

  const onScroll = ({
    nativeEvent,
  }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentPos = Math.floor(nativeEvent?.contentOffset?.y) ?? 0;
    setFabExtended(currentPos <= 0);
  };

  return (
    <>
      <ScreenView
        onScroll={onScroll}
        overlay={
          <>
            <HabitAnimatedFAB
              extended={fabExtended}
              onPress={() => setModalVisible(true)}
            />
            <AddHabitModal
              visible={modalVisible}
              onDismiss={() => setModalVisible(false)}
              onSave={(habit) => {
                addHabit(habit);
              }}
            />
          </>
        }
        header={
          <>
            <VStack space="md" style={styles.headerStyle}>
              <Text variant="titleMedium" style={{ alignSelf: "flex-start" }}>
                {habitsComplete}/{habitNumber} complete
              </Text>
              <WeekStrip
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
              />
              <Divider bold style={{ width: "100%" }} />
            </VStack>
          </>
        }
      >
        <VStack space="md" style={{ alignSelf: "stretch" }}>
        {habitsForDay.length !== 0 &&
          habitsForDay.map((habit) => {
            return ( <HabitCard
              key={habit.id}
              title={habit.title}
              time={habit.time}
              isDone={isHabitDone(habit.id, selectedDate, habitCompletions)}
              onToggle={() =>
                toggleHabit({ habitId: habit.id, habitDate: selectedDate })
              }
              onDelete={() => removeHabit(habit.id)}
            />
            )
          })}
        {habitsForDay.length === 0 && (
          <Center>
            <Text>No habits for today...</Text>
          </Center>
        )}
        </VStack>
      </ScreenView>
    </>
  );
}
