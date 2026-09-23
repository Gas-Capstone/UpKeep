import {
  TabList,
  TabListProps,
  Tabs,
  TabSlot,
  TabTrigger,
  TabTriggerSlotProps,
} from "expo-router/ui";
import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Icon,
  Surface,
  Text,
  TouchableRipple,
  useTheme,
} from "react-native-paper";

import {
  MaxContentWidth,
  Radius,
  Spacing,
  TabBarFloatMargin,
} from "@/constants/theme";

type TabHref = React.ComponentProps<typeof TabTrigger>["href"];

type TabConfig = {
  name: string;
  href: TabHref;
  label: string;
  icon: string;
  placement?: "bar" | "hidden";
};

const TABS: TabConfig[] = [
  { name: "index", href: "/", label: "Home", icon: "home-outline" },
  { name: "workouts", href: "/workouts", label: "Workouts", icon: "dumbbell" },
  {
    name: "meals",
    href: "/meals",
    label: "Meals",
    icon: "silverware-fork-knife",
  },
  {
    name: "habits",
    href: "/habits",
    label: "Habits",
    icon: "check-circle-outline",
  },
  {
    name: "profile",
    href: "/profile",
    label: "Profile",
    icon: "account-outline",
  },
  {
    name: "grocery",
    href: "/grocery",
    label: "Grocery list",
    icon: "cart-outline",
    placement: "hidden",
  },
  {
    name: "mealplan",
    href: "/mealplan",
    label: "Meal plan",
    icon: "calendar-month-outline",
    placement: "hidden",
  },
];

export default function AppTabs() {
  return (
    <View style={styles.root}>
      <Tabs>
        <TabSlot style={{ height: "100%" }} />
        <TabList asChild>
          <BottomBar>
            {TABS.map((tab) =>
              tab.placement === "hidden" ? (
                <TabTrigger
                  key={tab.name}
                  name={tab.name}
                  href={tab.href}
                  asChild
                >
                  <View
                    style={{ position: "absolute", width: 0, height: 0 }}
                    pointerEvents="none"
                  />
                </TabTrigger>
              ) : (
                <TabTrigger
                  key={tab.name}
                  name={tab.name}
                  href={tab.href}
                  asChild
                >
                  <TabItem tab={tab} />
                </TabTrigger>
              ),
            )}
          </BottomBar>
        </TabList>
      </Tabs>
    </View>
  );
}

function BottomBar(props: TabListProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <View
      {...props}
      style={[
        styles.bottomBarContainer,
        {
          paddingBottom:
            Math.max(insets.bottom, Spacing.two) + TabBarFloatMargin,
        },
      ]}
    >
      <Surface
        elevation={2}
        style={[
          styles.bottomBarInner,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outlineVariant,
          },
        ]}
      >
        {props.children}
      </Surface>
    </View>
  );
}

type StripNull<T> = { [K in keyof T]: Exclude<T[K], null> };

function stripNulls<T extends Record<string, unknown>>(obj: T): StripNull<T> {
  const result: Record<string, unknown> = { ...obj };
  for (const key in result) {
    if (result[key] === null) result[key] = undefined;
  }
  return result as StripNull<T>;
}

function TabItem({
  tab,
  isFocused,
  ...props
}: TabTriggerSlotProps & { tab: TabConfig }) {
  const theme = useTheme();
  const rippleProps = stripNulls(props);
  const activeColor = theme.colors.primary;
  const inactiveColor = theme.colors.onSurfaceVariant;

  return (
    <TouchableRipple
      {...rippleProps}
      borderless
      rippleColor={theme.colors.primaryContainer}
      style={styles.tabItem}
    >
      <View style={styles.tabItemInner}>
        <View
          style={[
            styles.iconPill,
            isFocused && {
              backgroundColor: theme.colors.primaryContainer,
            },
          ]}
        >
          <Icon
            source={isFocused ? focusedIcon(tab.icon) : tab.icon}
            size={21}
            color={isFocused ? activeColor : inactiveColor}
          />
        </View>
        <Text
          numberOfLines={1}
          style={[
            styles.tabLabel,
            {
              color: isFocused ? activeColor : inactiveColor,
              fontWeight: isFocused ? "700" : "500",
            },
          ]}
        >
          {tab.label}
        </Text>
      </View>
    </TouchableRipple>
  );
}

function focusedIcon(icon: string) {
  const replacements: Record<string, string> = {
    "home-outline": "home",
    "check-circle-outline": "check-circle",
    "account-outline": "account",
  };

  return replacements[icon] ?? icon;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  bottomBarContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    pointerEvents: "box-none",
  },
  bottomBarInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    width: "100%",
    maxWidth: MaxContentWidth,
    minHeight: 64,
    paddingVertical: 7,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  tabItem: {
    flex: 1,
    borderRadius: Radius.medium,
  },
  tabItemInner: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  iconPill: {
    minWidth: 36,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 10,
    lineHeight: 13,
  },
});
