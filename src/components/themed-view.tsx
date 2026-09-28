import { View, type ViewProps } from "react-native";

import { Colors, ThemeColor } from "@/constants/theme";
import { useThemeMode } from "@/components/context/ThemeContext";

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor;
};

export function ThemedView({
  style,
  lightColor,
  darkColor,
  type,
  ...otherProps
}: ThemedViewProps) {
  const { resolvedTheme } = useThemeMode();
  const theme = Colors[resolvedTheme];

  return (
    <View
      style={[
        {
          backgroundColor: theme[type ?? "background"],
        },
        style,
      ]}
      {...otherProps}
    />
  );
}
