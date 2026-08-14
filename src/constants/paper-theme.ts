import { MD3DarkTheme, MD3LightTheme } from "react-native-paper";

import { Colors } from "@/constants/theme";

/** Green used for “ready / success” status text (e.g. recipe fully stocked). */
const SUCCESS_LIGHT = "#4CAF50";
const SUCCESS_DARK = "#81C784";

export const paperLightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    accentMeals: Colors.light.accentMeals,
    success: SUCCESS_LIGHT,
  },
};

export const paperDarkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    accentMeals: Colors.dark.accentMeals,
    success: SUCCESS_DARK,
  },
};

export type AppTheme = typeof paperLightTheme;
