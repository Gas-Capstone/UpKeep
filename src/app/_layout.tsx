import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PaperProvider } from "react-native-paper";

import { supabase } from "@/lib/supabaseClient";

import { UserProvider } from "@/components/context/userContext";
import { WorkoutSessionProvider } from "@/components/context/workoutSessionContext";
import { WorkoutsDataProvider } from "@/components/context/workoutsDataContext";
import { HabitsProvider } from "@/components/context/habitsContext";
import { MealsDataProvider } from "@/components/context/mealsDataContext";
import { ProfileDataProvider } from "@/components/context/profileDataContext";
import { ThemeProvider, useThemeMode } from "@/components/context/ThemeContext";

import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";

import { paperDarkTheme, paperLightTheme } from "@/constants/paper-theme";

import "@/global.css";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          router.replace("/(tabs)");
        } else {
          router.replace("/(auth)/login");
        }

        setReady(true);
        await SplashScreen.hideAsync();
      } catch (err) {
        throw err;
      }
    };

    init();
  }, []);

  if (!ready) return null;

  return (
    <ThemeProvider>
      <RootContent />
    </ThemeProvider>
  );
}

function RootContent() {
  const { resolvedTheme } = useThemeMode();

  const curTheme = resolvedTheme === "dark" ? paperDarkTheme : paperLightTheme;

  return (
    <SafeAreaProvider>
      <UserProvider>
        {/* WorkoutsDataProvider, MealsDataProvider, and ProfileDataProvider
            all read the current user via userContext, so they must stay
            nested inside UserProvider. */}
        <WorkoutsDataProvider>
          <MealsDataProvider>
            <ProfileDataProvider>
              <HabitsProvider>
                <WorkoutSessionProvider>
                  <GluestackUIProvider mode={resolvedTheme}>
                    <PaperProvider theme={curTheme}>
                      <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="(auth)" />
                        <Stack.Screen name="(tabs)" />
                        <Stack.Screen name="(subpages)" />
                      </Stack>
                    </PaperProvider>
                  </GluestackUIProvider>
                </WorkoutSessionProvider>
              </HabitsProvider>
            </ProfileDataProvider>
          </MealsDataProvider>
        </WorkoutsDataProvider>
      </UserProvider>
    </SafeAreaProvider>
  );
}
