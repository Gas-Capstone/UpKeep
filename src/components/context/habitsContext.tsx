import { createContext, useCallback, useContext, useState, useEffect } from "react";
import {
  CompletionsByDate,
  Habit,
  Weekday,
  timeToMinutes,
  rowsToCompletionsByDate,
  removeHabitFromList,
} from "@/lib/habits/habits";
import { getTodaysDate } from "@/lib/time_management/week";
import { useUserContext } from "./userContext";
import { getHabitsByUser, createHabit, deleteHabit, 
  getCompletedHabitsByUser, completeHabit, uncompleteHabit } from "@/lib/supabaseFunctions";

// Lifted out of HabitsScreen's local useState so index.tsx can read the same data.

type ToggleHabitArgs = {
  habitId: string;
  habitDate: string;
};

type AddHabitArgs = {
  title: string;
  time: string;
  weekdays: Weekday[];
};

export type HabitsContextType = {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  habitArray: Habit[];
  habitCompletions: CompletionsByDate;
  addHabit: (habit: AddHabitArgs) => void;
  removeHabit: (habitId: string) => void;
  toggleHabit: (args: ToggleHabitArgs) => void;
};

export const habitsContext = createContext<HabitsContextType | null>(null);

type HabitsProviderProps = {
  children: React.ReactNode;
};

export const HabitsProvider = ({ children }: HabitsProviderProps) => {
  const [selectedDate, setSelectedDate] = useState(getTodaysDate());
  const { user } = useUserContext()
  const [habitArray, setHabitArray] = useState<Habit[]>([]);
  const [habitCompletions, setHabitCompletions] = useState<CompletionsByDate>(
    {},
  );

  useEffect(() => {
    if (!user) return

    Promise.all([
      getHabitsByUser(user),
      getCompletedHabitsByUser(user),
    ])
      .then(([habits, completions]) => {
        setHabitArray(habits ?? [])
        setHabitCompletions(rowsToCompletionsByDate(completions ?? []))
      })
      .catch((err) => console.log(err))
  }, [user])

  const toggleHabit = useCallback(({ habitId, habitDate }: ToggleHabitArgs) => {
    if (!user) return

    const isDone = habitCompletions[habitDate]?.includes(habitId) ?? false
    
    const request = isDone
      ? uncompleteHabit(user, habitId, habitDate)
      : completeHabit(user, habitId, habitDate)

    request
      .then((res) => {
        if (res) {
          setHabitCompletions((prev) => {
            const cur = prev[habitDate] ?? []
            const next = isDone
              ? cur.filter((id) => id !== habitId)
              : [...cur, habitId]
            return { ...prev, [habitDate]: next }
          })
        }
      })
      .catch(async (err) => {
        console.log("Error toggling habit completion: ", err)
        const completions = await getCompletedHabitsByUser(user)
        setHabitCompletions(rowsToCompletionsByDate(completions ?? []))
      })
  }, [user, habitCompletions]);

  const addHabit = useCallback(async ({ title, time, weekdays }: AddHabitArgs) => {
    if (!user) return

    const created = await createHabit(user, { title, time, weekdays })
    if (!created) return
    
    setHabitArray((prev) => 
      [...prev, created].sort(
        (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)
      ));
  }, [user]);

  const removeHabit = useCallback(async (habitId: string) => {
    if (!user) return

    deleteHabit(user, habitId)
      .then((res) => {
        if (res) {
          setHabitArray((prev) => removeHabitFromList(prev, habitId))
        }
      }
      ).catch(async (err) => {
        console.log("Error removing habit from array: ", err)
        const habits = await getHabitsByUser(user)
        setHabitArray(habits ?? [])
      })
  }, [user]);

  const contextValue: HabitsContextType = {
    selectedDate,
    setSelectedDate,
    habitArray,
    habitCompletions,
    addHabit,
    removeHabit,
    toggleHabit,
  };

  return (
    <habitsContext.Provider value={contextValue}>
      {children}
    </habitsContext.Provider>
  );
};

// Use this instead of `useContext(habitsContext)` — throws a clear error if <HabitsProvider> isn't mounted.
export function useHabitsContext() {
  const ctx = useContext(habitsContext);
  if (!ctx) {
    throw new Error("useHabitsContext must be used within a <HabitsProvider>");
  }
  return ctx;
}
