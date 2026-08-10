import { supabase } from "./supabaseClient";

export async function getWorkouts() {
    const {data, error} = await supabase
        .from("workout_plans")
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