import { Pressable, StyleSheet } from "react-native";

import { useThemeMode } from "@/components/context/ThemeContext";
import { ThemedText } from "@/components/themed-text";
import { Colors, Radius, Spacing } from "@/constants/theme";

interface ButtonProps {
  children: string;
  onPress?: () => void;
  isDisabled?: boolean;
}

export function Button({ children, onPress, isDisabled }: ButtonProps) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.wrapper,
        {
          backgroundColor: colors.brandStrong,
          borderColor: colors.brandStrong,
        },
        pressed && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      <ThemedText
        type="smallBold"
        style={{
          color: resolvedTheme === "dark" ? Colors.dark.background : "#FFFFFF",
        }}
      >
        {children}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.medium,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.45,
  },
});
