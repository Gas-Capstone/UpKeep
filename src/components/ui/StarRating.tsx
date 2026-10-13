import { StyleSheet, View } from "react-native";
import { Icon, TouchableRipple } from "react-native-paper";

import { useThemeMode } from "@/components/context/ThemeContext";
import { Colors, Spacing } from "@/constants/theme";

type StarRatingProps = {
  // 0 (nothing picked) or 0.5–5 in half steps.
  value: number;
  onChange: (value: number) => void;
  size?: number;
  disabled?: boolean;
};

const STARS = [1, 2, 3, 4, 5];

function starIcon(star: number, value: number) {
  if (value >= star) return "star";
  if (value >= star - 0.5) return "star-half-full";
  return "star-outline";
}

/**
 * Five tappable stars in half steps: the left half of a star picks x.5, the
 * right half picks the whole star.
 */
export function StarRating({
  value,
  onChange,
  size = 36,
  disabled = false,
}: StarRatingProps) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  return (
    <View style={styles.row} accessibilityRole="adjustable">
      {STARS.map((star) => (
        <View key={star} style={{ width: size, height: size }}>
          <Icon
            source={starIcon(star, value)}
            size={size}
            color={value >= star - 0.5 ? colors.warning : colors.textSecondary}
          />
          <View style={StyleSheet.absoluteFill}>
            <View style={styles.halves}>
              {[star - 0.5, star].map((rating) => (
                <TouchableRipple
                  key={rating}
                  disabled={disabled}
                  onPress={() => onChange(rating)}
                  borderless
                  style={styles.half}
                  accessibilityRole="button"
                  accessibilityLabel={`Rate ${rating} out of 5 stars`}
                  accessibilityState={{ selected: value === rating }}
                >
                  <View />
                </TouchableRipple>
              ))}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: Spacing.one,
  },
  halves: {
    flex: 1,
    flexDirection: "row",
  },
  half: {
    flex: 1,
  },
});
