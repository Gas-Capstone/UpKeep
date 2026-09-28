import "@/global.css";

import { Platform } from "react-native";

/**
 * Brand palette based on the uK logo.
 *
 * The stronger teal is used for light-mode primary actions because it keeps
 * white text readable. The original logo teal/aqua remain the visual brand
 * accents throughout the app.
 */
export const Brand = {
  teal: "#1B9E96",
  tealStrong: "#167C76",
  aqua: "#4ACBC1",
  warmWhite: "#FAF7F2",
  ink: "#122321",
  darkBackground: "#071A18",
} as const;

export const Colors = {
  light: {
    text: "#122321",
    background: "#F7FAF9",
    backgroundElement: "#FFFFFF",
    backgroundSelected: "#DFF4F1",
    textSecondary: "#607471",

    card: "#FFFFFF",
    border: "#D7E7E4",
    brand: Brand.teal,
    brandStrong: Brand.tealStrong,
    brandSoft: "#DFF4F1",
    aqua: Brand.aqua,

    accentWorkouts: Brand.tealStrong,
    accentMeals: "#B86A1B",
    accentHabits: Brand.teal,

    success: "#2F7D5A",
    warning: "#A86117",
    danger: "#B4232F",
  },
  dark: {
    text: "#FAF7F2",
    background: "#071A18",
    backgroundElement: "#0D2421",
    backgroundSelected: "#164E4A",
    textSecondary: "#AEC2BE",

    card: "#0D2421",
    border: "#294A45",
    brand: Brand.aqua,
    brandStrong: Brand.teal,
    brandSoft: "#164E4A",
    aqua: "#75D9D2",

    accentWorkouts: Brand.aqua,
    accentMeals: "#F3B45A",
    accentHabits: "#75D9D2",

    success: "#77C79A",
    warning: "#F3B45A",
    danger: "#FF8A93",
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  small: 10,
  medium: 16,
  large: 22,
  pill: 999,
} as const;

export const TabBarFloatMargin = 12;
export const BottomTabInset = 76;

// Kept for existing screens while the old floating top badge is removed.
// Screens that already use this constant now receive normal breathing room.
export const TopBadgeInset = Spacing.three;

export const MaxContentWidth = 800;
