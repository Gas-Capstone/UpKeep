import { MD3DarkTheme, MD3LightTheme } from "react-native-paper";

import { Brand, Colors } from "@/constants/theme";

export const paperLightTheme = {
  ...MD3LightTheme,
  roundness: 4,
  colors: {
    ...MD3LightTheme.colors,

    primary: Brand.tealStrong,
    onPrimary: "#FFFFFF",
    primaryContainer: "#DFF4F1",
    onPrimaryContainer: "#0A4642",

    secondary: Brand.teal,
    onSecondary: "#FFFFFF",
    secondaryContainer: "#E7F7F5",
    onSecondaryContainer: "#0A4642",

    tertiary: Brand.aqua,
    onTertiary: "#062C29",
    tertiaryContainer: "#D6F7F3",
    onTertiaryContainer: "#083C38",

    background: Colors.light.background,
    onBackground: Colors.light.text,
    surface: Colors.light.card,
    onSurface: Colors.light.text,
    surfaceVariant: "#EAF4F2",
    onSurfaceVariant: "#536763",
    outline: "#82948F",
    outlineVariant: Colors.light.border,

    error: Colors.light.danger,
    onError: "#FFFFFF",
    errorContainer: "#FDEBED",
    onErrorContainer: "#6F101B",

    inverseSurface: "#263B38",
    inverseOnSurface: "#F4F7F6",
    inversePrimary: Brand.aqua,

    // App-specific additions used by existing components.
    accentWorkouts: Colors.light.accentWorkouts,
    accentMeals: Colors.light.accentMeals,
    accentHabits: Colors.light.accentHabits,
    success: Colors.light.success,
  },
};

export const paperDarkTheme = {
  ...MD3DarkTheme,
  roundness: 4,
  colors: {
    ...MD3DarkTheme.colors,

    primary: Brand.aqua,
    onPrimary: "#062C29",
    primaryContainer: "#0C5F59",
    onPrimaryContainer: "#D6F8F4",

    secondary: "#75D9D2",
    onSecondary: "#072B28",
    secondaryContainer: "#164E4A",
    onSecondaryContainer: "#CFF3EF",

    tertiary: "#A1E9E4",
    onTertiary: "#082B28",
    tertiaryContainer: "#1C4F4A",
    onTertiaryContainer: "#D4F7F3",

    background: Colors.dark.background,
    onBackground: Colors.dark.text,
    surface: Colors.dark.card,
    onSurface: Colors.dark.text,
    surfaceVariant: "#15332F",
    onSurfaceVariant: Colors.dark.textSecondary,
    outline: "#78918C",
    outlineVariant: Colors.dark.border,

    error: Colors.dark.danger,
    onError: "#4B0710",
    errorContainer: "#64131D",
    onErrorContainer: "#FFD9DC",

    inverseSurface: "#E2E8E6",
    inverseOnSurface: "#17302D",
    inversePrimary: Brand.tealStrong,

    // App-specific additions used by existing components.
    accentWorkouts: Colors.dark.accentWorkouts,
    accentMeals: Colors.dark.accentMeals,
    accentHabits: Colors.dark.accentHabits,
    success: Colors.dark.success,
  },
};

export type AppTheme = typeof paperLightTheme;
