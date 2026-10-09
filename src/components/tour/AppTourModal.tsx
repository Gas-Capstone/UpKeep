import { Href, router, usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Avatar,
  Button,
  Card,
  Modal,
  Portal,
  ProgressBar,
  Text,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTour } from "@/components/context/tourContext";
import { styles } from "@/constants/styles";
import { BottomTabInset, Radius, Spacing } from "@/constants/theme";

type TourStep = {
  href: Href;
  icon: string;
  title: string;
  body: string;
};

const STEPS: TourStep[] = [
  {
    href: "/",
    icon: "hand-wave-outline",
    title: "Welcome to UpKeep",
    body: "Workouts, meals, and habits in one place. Here's a quick look around. It takes about 30 seconds.",
  },
  {
    href: "/",
    icon: "home-outline",
    title: "Home",
    body: "Your daily snapshot: your Wellness Score, workout streak, and today's habits. Tap the info icon to see how the score is calculated.",
  },
  {
    href: "/workouts",
    icon: "dumbbell",
    title: "Workouts",
    body: "Build workout plans, then start one to follow along with the guided timer. Finished sessions are saved to your history.",
  },
  {
    href: "/meals",
    icon: "silverware-fork-knife",
    title: "Meals",
    body: "Add what's in your fridge to see which recipes you can cook right now, and shop for the meals you've planned.",
  },
  {
    href: "/habits",
    icon: "check-circle-outline",
    title: "Habits & meal plan",
    body: "Your day's habits and planned meals, in time order. Add either one from here, check them off, and use the week strip to look back.",
  },
  {
    href: "/profile",
    icon: "account-outline",
    title: "Profile & settings",
    body: "Set your goal and biometrics for better calorie and recipe suggestions. Settings has theme, notifications, and a button to replay this tour.",
  },
];

/**
 * Step-by-step intro shown to each account once, the first time it opens Home.
 * Moves through each tab as it goes.
 */
export function AppTourModal() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { visible, startFirstVisitTour, finishTour } = useTour();
  const pathname = usePathname();
  const [stepIndex, setStepIndex] = useState(0);

  const step = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  // Re-runs when the "has this account seen it" check resolves, so a slow
  // check still opens the tour if the user is on Home by then.
  useEffect(() => {
    if (pathname === "/") startFirstVisitTour();
  }, [pathname, startFirstVisitTour]);

  useEffect(() => {
    if (visible) router.navigate(STEPS[stepIndex].href);
  }, [visible, stepIndex]);

  function close() {
    finishTour();
    setStepIndex(0);
    router.navigate("/");
  }

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={close}
        dismissable={false}
        dismissableBackButton
        style={local.wrapper}
        contentContainerStyle={[
          styles.modalContent,
          { paddingBottom: BottomTabInset + insets.bottom + Spacing.three },
        ]}
      >
        <Card
          mode="elevated"
          style={[
            styles.modalCard,
            local.card,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <Card.Title
            title={step.title}
            titleVariant="titleLarge"
            subtitle={`${stepIndex + 1} of ${STEPS.length}`}
            left={(props) => (
              <Avatar.Icon
                {...props}
                icon={step.icon}
                color={theme.colors.primary}
                style={{ backgroundColor: theme.colors.primaryContainer }}
              />
            )}
          />
          <Card.Content style={local.content}>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {step.body}
            </Text>
            <ProgressBar
              progress={(stepIndex + 1) / STEPS.length}
              style={local.progress}
            />
          </Card.Content>
          <Card.Actions>
            <View style={local.spacer}>
              {!isLast && (
                <Button mode="text" onPress={close} compact>
                  Skip
                </Button>
              )}
            </View>
            {!isFirst && (
              <Button mode="outlined" onPress={() => setStepIndex(stepIndex - 1)}>
                Back
              </Button>
            )}
            <Button
              mode="contained"
              onPress={isLast ? close : () => setStepIndex(stepIndex + 1)}
            >
              {isLast ? "Get started" : "Next"}
            </Button>
          </Card.Actions>
        </Card>
      </Modal>
    </Portal>
  );
}

const local = StyleSheet.create({
  wrapper: {
    justifyContent: "flex-end",
  },
  card: {
    borderRadius: Radius.large,
  },
  content: {
    gap: Spacing.three,
  },
  progress: {
    borderRadius: Radius.pill,
  },
  spacer: {
    flex: 1,
    alignItems: "flex-start",
  },
});
