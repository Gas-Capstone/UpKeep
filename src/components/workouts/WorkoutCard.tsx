import { Card, Text, Button, Chip, IconButton, useTheme } from "react-native-paper";
import { HStack } from "../ui/hstack";
import { VStack } from "../ui/vstack";
import { styles } from "@/constants/styles";
import type { Workout } from "../context/workoutsDataContext";

// `user` was previously a required-but-unused prop, which caused the "Property 'user' is missing" error.
type workoutCardProps = {
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
        // Card.Title's `right` slot puts the star in the card's top-right
        // corner without absolute positioning fighting the title layout.
        right={() => (
          <IconButton
            icon={isFavorited ? "star" : "star-outline"}
            iconColor={
              isFavorited ? theme.colors.primary : theme.colors.onSurfaceVariant
            }
            size={22}
            onPress={onToggleFavorite}
            accessibilityLabel={
              isFavorited
                ? `Remove ${workout.name} from favorites`
                : `Add ${workout.name} to favorites`
            }
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
