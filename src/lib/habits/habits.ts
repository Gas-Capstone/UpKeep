import { getDay, parse, parseISO } from "date-fns";

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

// Habit ids are UUIDs from Postgres — keep as string
export type Habit = {
    title: string;
    time: string;
    weekdays: Weekday[]; // if weekdays is empty, it means habit is scheduled for every day
    id: string;
  }


export type HabitCompletion = {
    habitId: string;
    habitDate: string;
}

/* Record<> allows for storage
   similar to a dictionary datatype
   Example:
   {
   "2026-07-01": ["uuid-1", "uuid-2"]
   "2026-07-02": ["uuid-3"]
   }
*/
export type CompletionsByDate = Record<string, string[]>

export function isHabitDone(habitId: string, habitDate: string, completions: CompletionsByDate){
    return (completions[habitDate]?.includes(habitId) ?? false)
}

export function addHabitToList(
    habits: Habit[],
    title: string,
    time: string,
    weekdays: Weekday[]
) {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return habits;

    const newHabit = {
        id: String(Date.now()),
        title: trimmedTitle,
        time,
        weekdays
    }
    return [...habits, newHabit].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))
}

export function removeHabitFromList(habits: Habit[], habitId: string) {
    return habits.filter((habit) => habit.id !== habitId)
}

export function isHabitOnDate(habit: Habit, date: string){
    if (!habit.weekdays || habit.weekdays.length === 0) return true;
    return habit.weekdays.includes(getDay(parseISO(date)) as Weekday)
}

export function timeToMinutes(time: string){
    const parsed = parse(time, "h:mm aa", new Date())
    return parsed.getHours() * 60 + parsed.getMinutes()
}

export function getHabitsForDate(habits: Habit[], date: string){
    return habits.filter((habit) => isHabitOnDate(habit, date))
        .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))
}

export function rowsToCompletionsByDate(rows: { habit_id: string, completed_on: string }[]){
    return (rows ?? []).reduce<CompletionsByDate>((acc, row) => {
        const date = row.completed_on
        const ids = acc[date] ?? []
        return { ...acc, [date]: [...ids, row.habit_id] }
    }, {})
}
