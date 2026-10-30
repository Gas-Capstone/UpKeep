import { View } from "react-native";
import { Button, IconButton, Text, TextInput } from "react-native-paper";

import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type StepsEditorProps = {
  steps: string[];
  onChange: (steps: string[]) => void;
};

/**
 * Numbered list of a recipe's steps that can be typed into, added to,
 * reordered and removed. Steps are saved one per line, so line breaks typed
 * inside a step are turned into spaces rather than silently splitting it in
 * two.
 */
export function StepsEditor({ steps, onChange }: StepsEditorProps) {
  const theme = useTheme();

  const update = (index: number, text: string) =>
    onChange(steps.map((step, i) => (i === index ? text.replace(/\s*\n\s*/g, " ") : step)));

  const move = (index: number, offset: -1 | 1) => {
    const next = [...steps];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  };

  return (
    <VStack space="sm" style={{ alignSelf: "stretch" }}>
      {steps.length === 0 && (
        <Text variant="bodySmall" style={{ color: theme.textSecondary }}>
          No steps yet. Add them in the order you cook them.
        </Text>
      )}

      {steps.map((step, index) => (
        <View key={index}>
          <HStack style={{ alignItems: "flex-start" }}>
            <Text
              variant="labelLarge"
              style={{ width: 24, paddingTop: Spacing.three, color: theme.accentMeals }}
            >
              {index + 1}
            </Text>
            {/* The row stretches its children to the height of the stacked
                up/down arrows. This wrapper takes that stretch so the input
                inside keeps the height of its own text, centred, instead of
                becoming a tall box with one line pinned to the top. */}
            <View style={{ flex: 1, minWidth: 0, justifyContent: "center" }}>
              <TextInput
                mode="outlined"
                dense
                multiline
                placeholder="Describe this step"
                value={step}
                onChangeText={(text) => update(index, text)}
                contentStyle={{
                  textAlignVertical: "center",
                  paddingTop: Spacing.two,
                  paddingBottom: Spacing.two,
                }}
                accessibilityLabel={`Step ${index + 1}`}
              />
            </View>
            <VStack>
              <IconButton
                icon="chevron-up"
                size={18}
                style={{ margin: 0 }}
                disabled={index === 0}
                onPress={() => move(index, -1)}
                accessibilityLabel={`Move step ${index + 1} up`}
              />
              <IconButton
                icon="chevron-down"
                size={18}
                style={{ margin: 0 }}
                disabled={index === steps.length - 1}
                onPress={() => move(index, 1)}
                accessibilityLabel={`Move step ${index + 1} down`}
              />
            </VStack>
            <IconButton
              icon="close"
              size={18}
              style={{ margin: 0, marginTop: Spacing.one }}
              onPress={() => onChange(steps.filter((_, i) => i !== index))}
              accessibilityLabel={`Remove step ${index + 1}`}
            />
          </HStack>
        </View>
      ))}

      <Button
        compact
        icon="plus"
        style={{ alignSelf: "flex-start" }}
        onPress={() => onChange([...steps, ""])}
      >
        Add step
      </Button>
    </VStack>
  );
}
