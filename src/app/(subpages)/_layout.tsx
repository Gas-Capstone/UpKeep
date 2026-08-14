import { Stack } from "expo-router";
import { UserProvider } from "@/components/context/userContext";
import { WorkoutSessionProvider } from "@/components/context/workoutSessionContext";
import { SafeAreaProvider } from "react-native-safe-area-context";
export default function SubpagesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="workouttimer"
        options={{ title: "Workout Timer", presentation: "card" }}
      />
      <Stack.Screen
        name="recipe"
        options={{ title: "Recipe", presentation: "card" }}
      />
    </Stack>

  );
}