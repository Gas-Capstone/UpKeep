import { Stack } from "expo-router";

import { useThemeMode } from "@/components/context/ThemeContext";
import { Colors } from "@/constants/theme";

export default function AuthLayout() {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="setupProfileScreen" />
    </Stack>
  );
}
