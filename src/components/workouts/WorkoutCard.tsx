import { Card, Text, Button, Chip, IconButton, useTheme } from "react-native-paper";
import { HStack } from "../ui/hstack";
import { VStack } from "../ui/vstack";
import { styles } from "@/constants/styles";
import { CardMenu } from "../ui/CardMenu";
import type { Workout } from "../context/workoutsDataContext";

// Shared by the star and the menu so both corners inset identically. Paper's
// own left/right slot defaults are not symmetric — see Card.Title below.
const ICON_SLOT_INSET = 8;
const ICON_SLOT = {
  width: 40,
  justifyContent: "center",
  alignItems: "center",
} as const;

// `user` was previously a required-but-unused prop, which caused the "Property 'user' is missing" error.
type workoutCardProps = {
  workout: Workout;
  onPress: () => void;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  // Omitted for seeded plans, which the user can't change — the card then
  // renders no menu at all rather than disabled items.
  onEdit?: () => void;
  onDelete?: () => void;
};

export function WorkoutCard({
  workout,
  onPress,
  isFavorited,
  onToggleFavorite,
  onEdit,
  onDelete,
}: workoutCardProps) {
  const theme = useTheme();
  // User-created plans can leave target blank, and older rows may have a null
  // difficulty — guard both so a missing value hides the chip instead of
  // throwing on .charAt of undefined.
  const difficultyDisplay = workout.difficulty
    ? workout.difficulty.charAt(0).toUpperCase() + workout.difficulty.slice(1)
    : "";
  return (
    <Card mode="contained" style={{ width: "100%", alignSelf: "stretch" }}>
      <Card.Title
        title={<Text variant="titleMedium">{workout.name}</Text>}
        // Paper insets the left slot (container paddingLeft + a 40dp box) but
        // gives the right slot no style at all, so the two corners end up
        // asymmetric. Matching boxes and equal padding put the star and the
        // menu the same distance from their edges.
        style={{ paddingLeft: ICON_SLOT_INSET, paddingRight: ICON_SLOT_INSET }}
        leftStyle={ICON_SLOT}
        rightStyle={ICON_SLOT}
        left={() => (
          <IconButton
            icon={isFavorited ? "star" : "star-outline"}
            iconColor={
              isFavorited ? theme.colors.primary : theme.colors.onSurfaceVariant
            }
            size={22}
            style={{ margin: 0 }}
            onPress={onToggleFavorite}
            accessibilityLabel={
              isFavorited
                ? `Remove ${workout.name} from favorites`
                : `Add ${workout.name} to favorites`
            }
          />
        )}
        // Card.Title's `right` slot puts this in the card's top-right corner
        // without absolute positioning fighting the title layout. Menu is a
        // placeholder for now — no handler wired up yet.
        right={() => (
          <CardMenu
            accessibilityLabel={`More options for ${workout.name}`}
            actions={[
              ...(onEdit
                ? [{ key: "edit", label: "Edit plan", icon: "pencil", onPress: onEdit }]
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
        )}
      />
      <Card.Content>
        <HStack style={{ width: "100%", flexWrap: "wrap" }} space="sm">
          <Chip mode="outlined" compact>
            <Text variant="labelSmall">{workout.duration_min} mins</Text>
          </Chip>
          {difficultyDisplay !== "" && (
            <Chip mode="outlined" compact>
              <Text variant="labelSmall">{difficultyDisplay}</Text>
            </Chip>
          )}
          {workout.target ? (
            <Chip mode="outlined" compact>
              <Text variant="labelSmall">{workout.target}</Text>
            </Chip>
          ) : null}
        </HStack>
      </Card.Content>
      <Card.Actions>
        <Button onPress={onPress}>Start Workout</Button>
      </Card.Actions>
    </Card>
  );
}
