import { TextInput, StyleSheet } from "react-native";
import { ThemedView } from "@/components/themed-view";
import { Colors, Spacing } from "@/constants/theme";
import { TextInputProps } from "react-native-paper";
import { useThemeMode } from "@/components/context/ThemeContext";

export function Input(props: TextInputProps) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  return (
    <ThemedView type="backgroundElement" style={styles.container}>
      <TextInput
        {...props}
        placeholderTextColor={colors.text}
        style={[styles.input, { color: colors.text }, props.style]}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.four,
  },

  input: {
    fontSize: 16,
  },
});
