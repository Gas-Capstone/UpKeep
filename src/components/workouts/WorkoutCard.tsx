import { StyleSheet, View } from "react-native";
import { Button, Icon, IconButton, Text } from "react-native-paper";

import { useThemeMode } from "@/components/context/ThemeContext";
import type { Workout } from "@/components/context/workoutsDataContext";
import { BrandImagePlaceholder } from "@/components/ui/BrandImagePlaceholder";
import { Colors, Radius, Spacing } from "@/constants/theme";

type WorkoutCardProps = {
  workout: Workout;
  onPress: () => void;
  isFavorited: boolean;
  onToggleFavorite: () => void;
};

export function WorkoutCard({
  workout,
  onPress,
  isFavorited,
  onToggleFavorite,
}: WorkoutCardProps) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  const difficultyDisplay = workout.difficulty
    ? workout.difficulty.charAt(0).toUpperCase() + workout.difficulty.slice(1)
    : null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.backgroundElement,
          borderColor: colors.border,
        },
      ]}
    >
      <BrandImagePlaceholder
        label="Workout photo"
        icon="dumbbell"
        style={styles.imageSlot}
      />

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text
              variant="titleLarge"
              numberOfLines={2}
              style={{ color: colors.text, fontWeight: "800" }}
            >
              {workout.name}
            </Text>
            {workout.target ? (
              <Text
                variant="bodySmall"
                numberOfLines={1}
                style={{ color: colors.textSecondary, marginTop: 2 }}
              >
                {workout.target}
              </Text>
            ) : null}
          </View>

          <IconButton
            icon={isFavorited ? "star" : "star-outline"}
            iconColor={isFavorited ? colors.warning : colors.textSecondary}
            size={22}
            onPress={onToggleFavorite}
            accessibilityLabel={
              isFavorited
                ? `Remove ${workout.name} from favorites`
                : `Add ${workout.name} to favorites`
            }
            style={{ margin: 0 }}
          />
        </View>

        <View style={styles.metaRow}>
          <MetaPill
            icon="clock-outline"
            label={`${workout.duration_min} min`}
            backgroundColor={colors.brandSoft}
            textColor={colors.text}
            iconColor={colors.brand}
          />

          {difficultyDisplay ? (
            <MetaPill
              icon="signal"
              label={difficultyDisplay}
              backgroundColor={colors.brandSoft}
              textColor={colors.text}
              iconColor={colors.brand}
            />
          ) : null}
        </View>

        <Button
          mode="contained"
          icon="play"
          onPress={onPress}
          buttonColor={colors.brandStrong}
          textColor="#FFFFFF"
          contentStyle={{ minHeight: 44 }}
          style={{ borderRadius: Radius.pill }}
        >
          Start Workout
        </Button>
      </View>
    </View>
  );
}

type MetaPillProps = {
  icon: string;
  label: string;
  backgroundColor: string;
  textColor: string;
  iconColor: string;
};

function MetaPill({
  icon,
  label,
  backgroundColor,
  textColor,
  iconColor,
}: MetaPillProps) {
  return (
    <View style={[styles.metaPill, { backgroundColor }]}>
      <Icon source={icon} size={15} color={iconColor} />
      <Text
        variant="labelMedium"
        style={{ color: textColor, fontWeight: "600" }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  imageSlot: {
    minHeight: 132,
    borderWidth: 0,
    borderRadius: 0,
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.two,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  metaPill: {
    minHeight: 30,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
});
