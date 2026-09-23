import { Pressable, StyleSheet } from "react-native";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Colors, Spacing } from "@/constants/theme";
import { useThemeMode } from "@/components/context/ThemeContext";

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
        pressed && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      <ThemedView
        type="backgroundSelected"
        style={[styles.inner, { backgroundColor: colors.backgroundSelected }]}
      >
        <ThemedText type="smallBold" style={{ color: colors.text }}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
  },

  inner: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.four,
    alignItems: "center",
    justifyContent: "center",
  },

  pressed: {
    opacity: 0.7,
  },

  disabled: {
    opacity: 0.4,
  },
});
