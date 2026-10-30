import { StyleSheet, View } from "react-native";
import { Button, Icon, IconButton, Text } from "react-native-paper";

import { useThemeMode } from "@/components/context/ThemeContext";
import type { Workout } from "@/components/context/workoutsDataContext";
import { BrandImage } from "@/components/ui/BrandImage";
import { CardMenu } from "@/components/ui/CardMenu";
import { Colors, Radius, Spacing } from "@/constants/theme";

type WorkoutCardProps = {
  workout: Workout;
  onPress: () => void;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  // Puts this plan on the Habits page schedule. Offered on every plan.
  onSchedule?: () => void;
  // Omitted for seeded plans, which the user can't change, so their menu
  // only offers scheduling.
  onEdit?: () => void;
  onDelete?: () => void;
  onChangePhoto?: () => void;
  // True while this plan's photo is uploading, so the menu item can say so.
  photoUploading?: boolean;
  // Already formatted ("Done 3 days ago"). Omitted for a plan never done,
  // rather than saying "never", which would read as a nag.
  lastDone?: string | null;
  // Already formatted ("Dumbbell, Bench"). Omitted when unknown.
  equipment?: string | null;
};

export function WorkoutCard({
  workout,
  onPress,
  isFavorited,
  onToggleFavorite,
  onSchedule,
  onEdit,
  onDelete,
  onChangePhoto,
  photoUploading = false,
  lastDone,
  equipment,
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
      <BrandImage
        uri={workout.image_url}
        label="No photo added"
        icon="dumbbell"
        accessibilityLabel={`Photo of ${workout.name}`}
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

          <CardMenu
            accessibilityLabel={`More options for ${workout.name}`}
            actions={[
              ...(onSchedule
                ? [
                    {
                      key: "schedule",
                      label: "Schedule",
                      icon: "calendar-plus",
                      onPress: onSchedule,
                    },
                  ]
                : []),
              ...(onChangePhoto
                ? [
                    {
                      key: "photo",
                      label: photoUploading
                        ? "Uploading photo…"
                        : workout.image_url
                          ? "Change photo"
                          : "Add photo",
                      icon: "image-plus",
                      onPress: onChangePhoto,
                      disabled: photoUploading,
                    },
                  ]
                : []),
              ...(onEdit
                ? [
                    {
                      key: "edit",
                      label: "Edit plan",
                      icon: "pencil",
                      onPress: onEdit,
                    },
                  ]
                : []),
              ...(onDelete
                ? [
                    {
                      key: "delete",
                      label: "Delete plan",
                      icon: "delete",
                      onPress: onDelete,
                      destructive: true,
                    },
                  ]
                : []),
            ]}
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

          {lastDone ? (
            <MetaPill
              icon="history"
              label={lastDone}
              backgroundColor={colors.brandSoft}
              textColor={colors.text}
              iconColor={colors.brand}
            />
          ) : null}
        </View>

        {/* Answers "can I do this here?" before the plan is opened. */}
        {equipment ? (
          <View style={styles.equipmentRow}>
            <Icon source="dumbbell" size={15} color={colors.textSecondary} />
            <Text
              variant="bodySmall"
              numberOfLines={1}
              style={{ color: colors.textSecondary, flex: 1 }}
            >
              {equipment}
            </Text>
          </View>
        ) : null}

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
  equipmentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    // Pulls the line up under the pills, so it reads as part of the same
    // block rather than a separate section.
    marginTop: -Spacing.two,
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
