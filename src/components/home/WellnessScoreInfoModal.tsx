import { StyleSheet } from "react-native";
import { Button, Card, Modal, Portal, Text } from "react-native-paper";

import { styles } from "@/constants/styles";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

type WellnessScoreInfoModalProps = {
  visible: boolean;
  onDismiss: () => void;
};

/** Explains how the home screen's Wellness Score is calculated. */
export function WellnessScoreInfoModal({
  visible,
  onDismiss,
}: WellnessScoreInfoModalProps) {
  const theme = useTheme();

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContent}
      >
        <Card
          mode="contained"
          style={[
            styles.modalCard,
            local.card,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}
        >
          <Card.Title
            title={
              <Text style={[local.title, { color: theme.text }]}>
                How your score works
              </Text>
            }
          />
          <Card.Content>
            <Text style={[local.body, { color: theme.textSecondary }]}>
              Your score is the average of up to three equally weighted parts:
              habit completion over the last 7 days, workouts this week against
              a goal of 4, and the share of your matched recipes that are ready
              to cook with what&apos;s in your fridge (needs your biometrics
              set). Parts without enough data yet are left out rather than
              counted as zero, so a new account isn&apos;t penalized.
            </Text>
          </Card.Content>
          <Card.Actions>
            <Button mode="contained" onPress={onDismiss}>
              Got it
            </Button>
          </Card.Actions>
        </Card>
      </Modal>
    </Portal>
  );
}

const local = StyleSheet.create({
  card: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "800",
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
    opacity: 0.8,
  },
});
