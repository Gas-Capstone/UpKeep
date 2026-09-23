import { useThemeMode } from "@/components/context/ThemeContext";
import { Colors } from "@/constants/theme";

/**
 * Returns the same resolved palette used by Paper, ThemedView and ThemedText.
 * This replaces the old direct useColorScheme() path so the in-app theme
 * setting cannot disagree with individual screens.
 */
export function useTheme() {
  const { resolvedTheme } = useThemeMode();
  return Colors[resolvedTheme];
}
