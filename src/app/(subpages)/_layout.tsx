import { Stack } from "expo-router";

export default function SubpagesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="workouttimer"
        options={{
          title: "Workout Timer",
          presentation: "card",
        }}
      />

      <Stack.Screen
        name="recipe"
        options={{
          title: "Recipe",
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="edit-recipe"
        options={{ title: "Edit Recipe", presentation: "card" }}
      />
      <Stack.Screen
        name="edit-workout"
        options={{ title: "Edit Plan", presentation: "card" }}
      />
    </Stack>
  );
}
