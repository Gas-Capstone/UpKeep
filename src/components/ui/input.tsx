import { StyleSheet, TextInput } from "react-native";
import { TextInputProps } from "react-native-paper";

import { useThemeMode } from "@/components/context/ThemeContext";
import { Colors, Radius, Spacing } from "@/constants/theme";

export function Input(props: TextInputProps) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  return (
    <TextInput
      {...props}
      placeholderTextColor={colors.textSecondary}
      selectionColor={colors.brand}
      style={[
        styles.input,
        {
          color: colors.text,
          backgroundColor: colors.backgroundElement,
          borderColor: colors.border,
        },
        props.style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: 1,
    fontSize: 16,
  },
});
