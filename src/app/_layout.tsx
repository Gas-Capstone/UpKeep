import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from "react-native-paper";

import { supabase } from "@/lib/supabaseClient";

import { UserProvider } from "@/components/context/userContext";
import { WorkoutSessionProvider } from "@/components/context/workoutSessionContext";
import { WorkoutsDataProvider } from "@/components/context/workoutsDataContext";
import { HabitsProvider } from "@/components/context/habitsContext";
import { MealsDataProvider } from "@/components/context/mealsDataContext";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";

import { ThemeProvider, useThemeMode } from "@/components/context/ThemeContext";
import "@/global.css";

SplashScreen.preventAutoHideAsync();

function AppContainer() {
  const [ready, setReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<
    "/(tabs)" | "/(auth)/login" | null
  >(null);

  const { resolvedTheme } = useThemeMode();
  const isDark = resolvedTheme === "dark";

  const curTheme = isDark ? MD3DarkTheme : MD3LightTheme;

  function getOrdinal(n: number) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("birthdate, display_name")
          .eq("id", session.user.id)
          .single();

        if (profile?.birthdate) {
          const today = new Date();

          // Parse YYYY-MM-DD manually to avoid timezone shift
          const [year, month, day] = profile.birthdate.split("-").map(Number);

          const isBirthday =
            today.getMonth() + 1 === month && today.getDate() === day;

          if (isBirthday) {
            const age = today.getFullYear() - year;
            const ordinalAge = getOrdinal(age);

            alert(
              `🎉 Happy ${ordinalAge} Birthday, ${
                profile.display_name || "friend"
              }! Hope you have a fantastic and productive day ahead!`,
            );

            setInitialRoute("/(tabs)");
            setReady(true);
            SplashScreen.hideAsync();

            setTimeout(() => {
              router.replace("/(tabs)");
            }, 600);

            return;
          }
        }

        setInitialRoute("/(tabs)");
      } else {
        setInitialRoute("/(auth)/login");
      }

      setReady(true);
      SplashScreen.hideAsync();

      setTimeout(() => {
        if (initialRoute) router.replace(initialRoute);
      }, 600);
    };

    init();
  }, [initialRoute]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <UserProvider>
        <WorkoutsDataProvider>
          <MealsDataProvider>
            <HabitsProvider>
              <WorkoutSessionProvider>
                <GluestackUIProvider mode={isDark ? "dark" : "light"}>
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
          </MealsDataProvider>
        </WorkoutsDataProvider>
      </UserProvider>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppContainer />
    </ThemeProvider>
  );
}
