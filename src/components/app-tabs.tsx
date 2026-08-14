import { usePathname } from "expo-router";
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

import { MaxContentWidth, Spacing } from "@/constants/theme";

// ---- Config -----------------------------------------------------------
// `icon` is a MaterialCommunityIcons name rendered via Paper's <Icon>.
// No more ios/android/web split — one name per tab. `href` is typed
// directly off TabTrigger's own prop, so no `as any` cast is needed.

type TabHref = React.ComponentProps<typeof TabTrigger>["href"];

type TabConfig = {
  name: string;
  href: TabHref;
  label: string;
  icon: string;
  // "bar"      — shown in the bottom bar (default).
  // "hidden"   — route lives in (tabs) and still needs a TabTrigger to stay
  //              navigable, but isn't drawn in the bar. Per the expo-router
  //              docs, not rendering a trigger removes the route and its
  //              navigation state entirely.
  // "external" — route lives outside (tabs); listed only so the top badge can
  //              label it. Rendering a trigger for it would point at a tab
  //              route that doesn't exist.
  placement?: "bar" | "hidden" | "external";
};

const TABS: TabConfig[] = [
  { name: "index", href: "/", label: "Home", icon: "home" },
  { name: "workouts", href: "/workouts", label: "Workouts", icon: "dumbbell" },
  {
    name: "meals",
    href: "/meals",
    label: "Meals",
    icon: "silverware-fork-knife",
  },
  { name: "habits", href: "/habits", label: "Habits", icon: "timer-outline" },
  { name: "profile", href: "/profile", label: "Profile", icon: "account" },
  {
    name: "settings",
    href: "/settings",
    label: "Settings",
    icon: "cog",
    placement: "external",
  },
  // Reached from the Meals page, not the bottom bar.
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
    icon: "calendar-month",
    placement: "hidden",
  },
];

// ---- Root ---------------------------------------------------------------

export default function AppTabs() {
  const pathname = usePathname() ?? "";
  const activeTab =
    TABS.find((t) =>
      t.href === "/" ? pathname === "/" : pathname.startsWith(t.href as string),
    ) ?? TABS[0];

  return (
    <View style={styles.root}>
      <Tabs>
        <TabSlot style={{ height: "100%" }} />
        <TabList asChild>
          <BottomBar>
            {TABS.filter((t) => t.placement !== "external").map((tab) =>
              tab.placement === "hidden" ? (
                // Absolutely positioned so it keeps the route registered
                // without taking a slot in the bar's space-evenly layout.
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
                  <TabIcon tab={tab} />
                </TabTrigger>
              ),
            )}
          </BottomBar>
        </TabList>
      </Tabs>

      <TopBadge activeTab={activeTab} />
    </View>
  );
}

// ---- Top badge: fixed at the very top of the screen ---------------------

function TopBadge({ activeTab }: { activeTab: TabConfig }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="none"
      style={[styles.topBadgeContainer, { top: insets.top + Spacing.two }]}
    >
      <Surface elevation={3} style={styles.topBadgeInner}>
        <Icon
          source={activeTab.icon}
          size={14}
          color={theme.colors.onSurface}
        />
        <Text variant="labelMedium" style={styles.topBadgeLabel}>
          {activeTab.label}
        </Text>
      </Surface>
    </View>
  );
}

// ---- Bottom bar: TabList wrapper, holds one TabTrigger per tab ----------

function BottomBar(props: TabListProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      {...props}
      style={[
        styles.bottomBarContainer,
        { paddingBottom: (insets.bottom ?? 0) + Spacing.two },
      ]}
    >
      <Surface elevation={4} style={styles.bottomBarInner}>
        {props.children}
      </Surface>
    </View>
  );
}

// ---- Individual tab icon: raises itself above the bar when focused -----

// TabTriggerSlotProps (Pressable-style) allows `null` on its event
// handlers/`disabled`; Paper's TouchableRipple only accepts `undefined`.
// This strips `null` -> `undefined` at both the runtime and type level
// for the whole props object at once, rather than patching one handler
// at a time as TypeScript flags each one.
type StripNull<T> = { [K in keyof T]: Exclude<T[K], null> };

function stripNulls<T extends Record<string, unknown>>(obj: T): StripNull<T> {
  const result: Record<string, unknown> = { ...obj };
  for (const key in result) {
    if (result[key] === null) result[key] = undefined;
  }
  return result as StripNull<T>;
}

function TabIcon({
  tab,
  isFocused,
  ...props
}: TabTriggerSlotProps & { tab: TabConfig }) {
  const theme = useTheme();
  const rippleProps = stripNulls(props);

  return (
    <TouchableRipple
      {...rippleProps}
      borderless
      rippleColor={theme.colors.primary}
      style={[styles.tabIconWrapper, isFocused && styles.tabIconWrapperRaised]}
    >
      <Surface
        elevation={isFocused ? 4 : 0}
        style={[
          styles.tabIconInner,
          isFocused && styles.tabIconInnerRaised,
          {
            backgroundColor: isFocused
              ? theme.colors.secondaryContainer
              : "transparent",
          },
        ]}
      >
        <Icon
          source={tab.icon}
          size={isFocused ? 22 : 18}
          color={
            isFocused
              ? theme.colors.onSecondaryContainer
              : theme.colors.onSurfaceVariant
          }
        />
      </Surface>
    </TouchableRipple>
  );
}

// ---- Styles ---------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // Top badge
  topBadgeContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  topBadgeInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
  },
  topBadgeLabel: {
    marginLeft: Spacing.one,
  },

  // Bottom bar
  bottomBarContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: Spacing.three,
  },
  bottomBarInner: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-evenly",
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
    width: "100%",
    maxWidth: MaxContentWidth,
  },

  // Individual icons
  tabIconWrapper: {
    borderRadius: Spacing.four,
  },
  tabIconWrapperRaised: {
    transform: [{ translateY: -Spacing.four }],
  },
  tabIconInner: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.four,
  },
  tabIconInnerRaised: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
});
