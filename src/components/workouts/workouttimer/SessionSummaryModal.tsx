import { ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { Button, Card, Icon, Modal, Text, useTheme } from "react-native-paper";

import { styles as shared } from "@/constants/styles";
import { Spacing } from "@/constants/theme";
import type { SessionSummary } from "@/lib/sessionSummary";
import { SessionSummaryView } from "../SessionSummaryView";

type SessionSummaryModalProps = {
  visible: boolean;
  summary: SessionSummary;
  onDismiss: () => void;
  onBackToWorkouts: () => void;
};

/**
 * Shown once a session is saved: how it went, any new personal records, and
 * where the user's streak stands now. History reopens the same summary later.
 */
export function SessionSummaryModal({
  visible,
  summary,
  onDismiss,
  onBackToWorkouts,
}: SessionSummaryModalProps) {
  const theme = useTheme();
  const { height } = useWindowDimensions();

  return (
    <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={shared.modalContent}>
      <Card mode="contained" style={shared.modalCard}>
        <Card.Title
          title={
            <Text variant="titleLarge" accessibilityRole="header">
              Workout complete
            </Text>
          }
          subtitle={`${summary.planName} · saved to your history`}
          subtitleNumberOfLines={2}
          left={({ size }) => (
            <Icon source="check-circle-outline" size={size} color={theme.colors.primary} />
          )}
        />

        <Card.Content>
          {/* Capped so a long list of records scrolls instead of pushing the
              buttons off the screen. */}
          <ScrollView
            style={{ maxHeight: height * 0.6 }}
            contentContainerStyle={styles.scroll}
          >
            <SessionSummaryView summary={summary} context="finished" />
          </ScrollView>
        </Card.Content>

        <Card.Actions>
          <Button onPress={onDismiss}>Close</Button>
          <Button mode="contained" onPress={onBackToWorkouts}>
            Back to workouts
          </Button>
        </Card.Actions>
      </Card>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: Spacing.two,
  },
});
