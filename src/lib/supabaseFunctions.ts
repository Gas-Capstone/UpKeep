import { supabase } from "./supabaseClient";

export async function getWorkouts() {
    const {data, error} = await supabase
        .from("workouts")
        .select("*")
    if (error) console.log("Error fetching workouts from database: ", error)
    return data
}

export async function setWorkoutComplete(user, workout, durationMin){
    const {data, error} = await supabase
        .from("workout_sessions")
        .insert({ user_id: user.id, workout_id: workout.id, duration_min: durationMin })
    if (error) console.log("Error setting workout as complete: ", error)
}

export async function getCompletedWorkouts(user){
    const {data, error} = await supabase
        .from("workout_sessions")
        .select(`
            id,
            duration_min,
            completed_at,
            workouts ( name )
        `)
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false })
    if (error) console.log("Error fetching completed workouts: ", error)

    
    return (data ?? []).map((session) => ({
        id: session.id,
        duration_min: session.duration_min,
        completed_at: session.completed_at,
        name: session.workouts?.name
    }))
}

/* --------------
    HABITS
------------- */
export async function getHabitsByUser(user) {
    const {data, error} = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", user.id)
        .order("time", { ascending: false })
    if (error) console.log("Error fetching habits from database: ", error)
    return data
}

export async function deleteHabit(user, habitId) {
    const {data, error} = await supabase
        .from("habits")
        .delete()
        .eq("user_id", user.id)
        .eq("id", habitId)
    if (error){ 
        console.log("Error deleting habit: ", error)
        return false
    }
    return true
}

export async function getCompletedHabitsByUser(user){
    const {data, error} = await supabase
        .from("habit_completions")
        .select("*")
        .eq("user_id", user.id)
    if (error) console.log("Error fetching completed habits from database: ", error)
    return data
}

export async function createHabit(user, habit){
    const {data, error} = await supabase
        .from("habits")
        .insert({
            user_id: user.id,
            title: habit.title,
            time: habit.time,
            weekdays: habit.weekdays
        })
        .select()
        .single()
        if (error) console.log("Error creating habit: ", error)
        return data
}

export async function completeHabit(user, habitId, completedOn) {
    const { error } = await supabase
        .from("habit_completions")
        .insert({
            user_id: user.id,
            habit_id: habitId,
            completed_on: completedOn,
        })
        if (error){
            console.log("Error completing habit: ", error)
            return false
        }
        return true
}

export async function uncompleteHabit(user, habitId, completedOn) {
    const { error } = await supabase
        .from("habit_completions")
        .delete()
        .eq("user_id", user.id)
        .eq("habit_id", habitId)
        .eq("completed_on", completedOn)
    if (error) {
        console.log("Error uncompleting habit: ", error)
        return false
    }
    return true
}
