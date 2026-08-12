import { supabase } from "./supabaseClient";

// Seeded plans have a null created_by and are visible to everyone; user-made
// plans are only visible to their author.
export async function getWorkouts(user: { id: string }) {
    const {data, error} = await supabase
        .from("workout_plans")
        .select("*")
        .or(`created_by.is.null,created_by.eq.${user.id}`)
    if (error) console.log("Error fetching workouts from database: ", error)
    return data
}

/* --------------
    WORKOUT PLAN CREATION
------------- */
// The `workouts` table holds the individual exercises a plan is built from —
// distinct from `workout_plans`, which is what the workouts page displays.
export async function getAvailableWorkouts() {
    const {data, error} = await supabase
        .from("workouts")
        .select("id, name, muscle_group, equipment")
        .order("name", { ascending: true })
    if (error) console.log("Error fetching available workouts: ", error)
    return data
}

export async function createWorkoutPlan(
    user: { id: string },
    plan: { name: string; difficulty: string; target: string; duration_min: number },
    selections: { workout_id: string; sets: number; reps: number }[],
) {
    const {data, error} = await supabase
        .from("workout_plans")
        .insert({
            name: plan.name,
            difficulty: plan.difficulty,
            target: plan.target,
            duration_min: plan.duration_min,
            created_by: user.id,
        })
        .select()
        .single()
    if (error) {
        console.log("Error creating workout plan: ", error)
        return null
    }

    if (selections.length > 0) {
        // `position` preserves the order the user arranged the workouts in,
        // since row order coming back from Postgres isn't guaranteed.
        const rows = selections.map((selection, index) => ({
            workout_plan_id: data.id,
            workout_id: selection.workout_id,
            sets: selection.sets,
            reps: selection.reps,
            position: index,
        }))
        const { error: linkError } = await supabase
            .from("workout_plan_workouts")
            .insert(rows)
        if (linkError) {
            console.log("Error adding workouts to plan: ", linkError)
            // There's no transaction across these two inserts, so undo the plan
            // rather than leaving a nameless empty plan stranded in the list.
            await supabase.from("workout_plans").delete().eq("id", data.id)
            return null
        }
    }

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
            workout_plans ( name )
        `)
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false })
    if (error) console.log("Error fetching completed workouts: ", error)

    
    return (data ?? []).map((session) => ({
        id: session.id,
        duration_min: session.duration_min,
        completed_at: session.completed_at,
        name: (session.workout_plans as any)?.name
    }))
}

/* --------------
    FAVORITE WORKOUTS
------------- */
// favorite_workouts is a join table keyed on (user_id, workout_plan_id) — no
// surrogate id column. Note the FK is workout_plan_id here, while
// workout_sessions uses workout_id for the same table.
export async function getFavoriteWorkouts(user: { id: string }) {
    const {data, error} = await supabase
        .from("favorite_workouts")
        .select("workout_plan_id")
        .eq("user_id", user.id)
    if (error) console.log("Error fetching favorite workouts: ", error)
    return (data ?? []).map((row) => String(row.workout_plan_id))
}

export async function addFavoriteWorkout(user: { id: string }, workoutId: string) {
    const { error } = await supabase
        .from("favorite_workouts")
        .insert({ user_id: user.id, workout_plan_id: workoutId })
    if (error) {
        console.log("Error favoriting workout: ", error)
        return false
    }
    return true
}

export async function removeFavoriteWorkout(user: { id: string }, workoutId: string) {
    const { error } = await supabase
        .from("favorite_workouts")
        .delete()
        .eq("user_id", user.id)
        .eq("workout_plan_id", workoutId)
    if (error) {
        console.log("Error unfavoriting workout: ", error)
        return false
    }
    return true
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
