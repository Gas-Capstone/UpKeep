import { StyleSheet, View } from "react-native";
import { Button, Surface, Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardStickyView } from "react-native-keyboard-controller";

import { MaxContentWidth, Spacing } from "@/constants/theme";

type Props = {
  elapsedMilliseconds: number;
  status: string;
  active: boolean;
  idle: boolean;
  completed: boolean;
  saving: boolean;
  error: string;
  exercisesLoading: boolean;
  onToggle: () => void;
  onFinish: () => void;
  onBackToWorkouts: () => void;
  onHeightChange: (height: number) => void;
};

export function SessionTimerDock({
  elapsedMilliseconds,
  status,
  active,
  idle,
  completed,
  saving,
  error,
  exercisesLoading,
  onToggle,
  onFinish,
  onBackToWorkouts,
  onHeightChange,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const seconds = Math.floor(Math.max(0, elapsedMilliseconds) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const tail = `${(minutes % 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  const timerLabel = hours > 0 ? `${hours}:${tail}` : tail;

  return (
    <KeyboardStickyView style={styles.anchor} offset={{ opened: insets.bottom }}>
      <Surface
        elevation={0}
        onLayout={(event) => onHeightChange(event.nativeEvent.layout.height)}
        style={[styles.dock, {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outlineVariant,
          paddingBottom: insets.bottom + Spacing.two,
          paddingLeft: Math.max(insets.left, Spacing.four),
          paddingRight: Math.max(insets.right, Spacing.four),
        }]}
      >
        <View style={styles.content}>
          <View style={styles.row}>
            <View
              style={styles.time}
              accessible
              accessibilityLabel={`Elapsed time, ${hours} hours, ${minutes % 60} minutes, ${seconds % 60} seconds. ${status}`}
            >
              <Text variant="headlineSmall" style={styles.numerals}>{timerLabel}</Text>

              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{status}</Text>
            </View>

            {completed ? (
              <Button mode="contained" onPress={onBackToWorkouts} contentStyle={styles.button}>
                Back to workouts
              </Button>
            ) : (
              <View style={styles.actions}>
                <Button
                  mode="contained"
                  compact
                  disabled={saving}
                  onPress={onToggle}
                  style={styles.action}
                  contentStyle={styles.button}
                >
                  {active ? "Pause" : idle ? "Start" : "Resume"}
                </Button>

                <Button
                  mode="outlined"
                  compact
                  disabled={saving || idle || exercisesLoading}
                  loading={saving}
                  onPress={onFinish}
                  style={styles.action}
                  contentStyle={styles.button}
                >
                  Finish
                </Button>
              </View>
            )}
          </View>

          {!!error && <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.error }}>{error}</Text>}
        </View>
      </Surface>
    </KeyboardStickyView>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  dock: {
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  content: { width: "100%", maxWidth: MaxContentWidth, alignSelf: "center", gap: Spacing.two },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: Spacing.three },
  time: { flexGrow: 1, flexBasis: 100, gap: Spacing.one },
  numerals: { fontVariant: ["tabular-nums"] },
  actions: { flexDirection: "row", flexWrap: "wrap", flexGrow: 1, flexBasis: 180, gap: Spacing.two },
  action: { flexGrow: 1, flexBasis: 80 },
  button: { minHeight: 48 },
});
