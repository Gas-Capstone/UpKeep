import { router, Stack } from "expo-router";
import { Observe, ObserveRoot } from "expo-observe";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PaperProvider } from "react-native-paper";
import { en, registerTranslation } from "react-native-paper-dates";

import { HabitsProvider } from "@/components/context/habitsContext";
import { MealsDataProvider } from "@/components/context/mealsDataContext";
import { NotificationsProvider } from "@/components/context/notificationsContext";
import { ProfileDataProvider } from "@/components/context/profileDataContext";
import { ThemeProvider, useThemeMode } from "@/components/context/ThemeContext";
import { TourProvider } from "@/components/context/tourContext";
import { UserProvider } from "@/components/context/userContext";
import { StartupContext } from "@/components/context/startupContext";
import { WorkoutSessionProvider } from "@/components/context/workoutSessionContext";
import { WorkoutsDataProvider } from "@/components/context/workoutsDataContext";
import { BirthdayCelebration } from "@/components/profile/BirthdayCelebration";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { StartupErrorScreen } from "@/components/ui/StartupErrorScreen";
import { paperDarkTheme, paperLightTheme } from "@/constants/paper-theme";
import "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";
import "@/global.css";

SplashScreen.preventAutoHideAsync().catch(() => {});

Observe.configure({
  integrations: {
    // IDs can identify a user's custom recipes or workout plans.
    "expo-router": { filteredParams: ["id", "workoutId"] },
  },
});

// Strings for the react-native-paper-dates date and time pickers.
registerTranslation("en", en);

export default function RootLayout() {
  return (
    <ObserveRoot errorBoundaryFallback={<StartupErrorScreen />}>
      <ThemeProvider>
        <RootContent />
      </ThemeProvider>
    </ObserveRoot>
  );
}

function RootContent() {
  const [splashHidden, setSplashHidden] = useState(false);
  const { theme, resolvedTheme, ready: themeReady } = useThemeMode();
  const curTheme = resolvedTheme === "dark" ? paperDarkTheme : paperLightTheme;

  return (
    <KeyboardProvider>
      <SafeAreaProvider>
        <UserProvider>
        <WorkoutsDataProvider>
          <MealsDataProvider>
            <ProfileDataProvider>
              <HabitsProvider>
                <NotificationsProvider>
                  <WorkoutSessionProvider>
                    <TourProvider>
                      <GluestackUIProvider mode={theme}>
                        <PaperProvider theme={curTheme}>
                          <StartupContext.Provider value={splashHidden}>
                            <Stack
                              screenOptions={{
                                headerShown: false,
                                contentStyle: {
                                  backgroundColor: curTheme.colors.background,
                                },
                              }}
                            >
                              <Stack.Screen name="(auth)" />
                              <Stack.Screen name="(tabs)" />
                              <Stack.Screen name="(subpages)" />
                            </Stack>

                            <AuthBootstrap
                              themeReady={themeReady}
                              onSplashHidden={setSplashHidden}
                            />
                            <BirthdayCelebration />
                          </StartupContext.Provider>
                        </PaperProvider>
                      </GluestackUIProvider>
                    </TourProvider>
                  </WorkoutSessionProvider>
                </NotificationsProvider>
              </HabitsProvider>
            </ProfileDataProvider>
          </MealsDataProvider>
        </WorkoutsDataProvider>
      </UserProvider>
      </SafeAreaProvider>
    </KeyboardProvider>
  );
}

function AuthBootstrap({
  themeReady,
  onSplashHidden,
}: {
  themeReady: boolean;
  onSplashHidden: (hidden: boolean) => void;
}) {
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) throw error;

        if (!active) return;

        router.replace(session ? "/(tabs)" : "/(auth)/login");
      } catch (error) {
        // Do not dispatch auth messages that could contain personal data.
        Observe.reportError(new Error("Session bootstrap failed"));
        console.log("Session bootstrap failed:", error);

        if (active) {
          router.replace("/(auth)/login");
        }
      } finally {
        if (active) setAuthReady(true);
      }
    };

    initialize();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!authReady || !themeReady) return;

    // The Stack is already mounted when this component runs, so navigation is
    // ready and the native splash can safely disappear.
    let active = true;
    SplashScreen.hideAsync()
      .then(() => {
        if (active) onSplashHidden(true);
      })
      .catch(() => {
        Observe.reportError(new Error("Splash screen dismissal failed"));
      });
    return () => {
      active = false;
    };
  }, [authReady, themeReady, onSplashHidden]);

  return null;
}
