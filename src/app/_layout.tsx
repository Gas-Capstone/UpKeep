import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
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
import { WorkoutSessionProvider } from "@/components/context/workoutSessionContext";
import { WorkoutsDataProvider } from "@/components/context/workoutsDataContext";
import { BirthdayCelebration } from "@/components/profile/BirthdayCelebration";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { paperDarkTheme, paperLightTheme } from "@/constants/paper-theme";
import "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";
import "@/global.css";

SplashScreen.preventAutoHideAsync().catch(() => {});

// Strings for the react-native-paper-dates date and time pickers.
registerTranslation("en", en);

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootContent />
    </ThemeProvider>
  );
}

function RootContent() {
  const { theme, resolvedTheme, ready: themeReady } = useThemeMode();
  const curTheme = resolvedTheme === "dark" ? paperDarkTheme : paperLightTheme;

  return (
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

                          <AuthBootstrap themeReady={themeReady} />
                          <BirthdayCelebration />
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
  );
}

function AuthBootstrap({ themeReady }: { themeReady: boolean }) {
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active) return;

        router.replace(session ? "/(tabs)" : "/(auth)/login");
      } catch (error) {
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
    SplashScreen.hideAsync().catch(() => {});
  }, [authReady, themeReady]);

  return null;
}
