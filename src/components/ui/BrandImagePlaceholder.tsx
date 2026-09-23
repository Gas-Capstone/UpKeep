import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Icon, Text } from "react-native-paper";

import { useThemeMode } from "@/components/context/ThemeContext";
import { Colors, Radius, Spacing } from "@/constants/theme";

type BrandImagePlaceholderProps = {
  label?: string;
  icon?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Reserved image area for workout/meal photography that has not arrived yet.
 * Keeping a stable box now prevents card layouts from changing later.
 */
export function BrandImagePlaceholder({
  label = "Photo coming soon",
  icon = "image-outline",
  style,
}: BrandImagePlaceholderProps) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.brandSoft,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <Icon source={icon} size={24} color={colors.brand} />
      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 96,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    overflow: "hidden",
  },
});
