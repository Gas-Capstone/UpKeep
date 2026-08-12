import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PaperProvider } from "react-native-paper";
import { ThemeProvider, DarkTheme, DefaultTheme } from "expo-router";

import { supabase } from "@/lib/supabaseClient";
import { UserProvider } from "@/components/context/userContext";
import { WorkoutSessionProvider } from "@/components/context/workoutSessionContext";
import { WorkoutsDataProvider } from "@/components/context/workoutsDataContext";
import { HabitsProvider } from "@/components/context/habitsContext";
import { MealsDataProvider } from "@/components/context/mealsDataContext";
import { ProfileDataProvider } from "@/components/context/profileDataContext";
import { GluestackUIProvider } from "@/components/ui/gluestack-ui-provider";
import { paperDarkTheme, paperLightTheme } from "@/constants/paper-theme";
import "@/global.css";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const curTheme = isDark ? paperDarkTheme : paperLightTheme;
  const themeProviderTheme = isDark ? DarkTheme : DefaultTheme;

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7505/ingest/3e833bab-0eef-4ca6-b95d-13fe03afcf14',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'faabf4'},body:JSON.stringify({sessionId:'faabf4',runId:'post-fix',hypothesisId:'C',location:'src/app/_layout.tsx:mount',message:'RootLayout mounted',data:{ready:false,colorScheme},timestamp:Date.now()})}).catch(()=>{});
  }, []);
  // #endregion

  useEffect(() => {
    const init = async () => {
      // #region agent log
      fetch('http://127.0.0.1:7505/ingest/3e833bab-0eef-4ca6-b95d-13fe03afcf14',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'faabf4'},body:JSON.stringify({sessionId:'faabf4',runId:'post-fix',hypothesisId:'C',location:'src/app/_layout.tsx:init-start',message:'RootLayout init started',data:{},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        // #region agent log
        fetch('http://127.0.0.1:7505/ingest/3e833bab-0eef-4ca6-b95d-13fe03afcf14',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'faabf4'},body:JSON.stringify({sessionId:'faabf4',runId:'post-fix',hypothesisId:'E',location:'src/app/_layout.tsx:session',message:'Auth session resolved',data:{hasSession:!!session},timestamp:Date.now()})}).catch(()=>{});
        // #endregion

        if (session) {
          router.replace("/(tabs)");
        } else {
          router.replace("/(auth)/login");
        }

        setReady(true);
        SplashScreen.hideAsync();
      } catch (err) {
        // #region agent log
        fetch('http://127.0.0.1:7505/ingest/3e833bab-0eef-4ca6-b95d-13fe03afcf14',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'faabf4'},body:JSON.stringify({sessionId:'faabf4',runId:'post-fix',hypothesisId:'C',location:'src/app/_layout.tsx:init-error',message:'RootLayout init threw',data:{error:String(err)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        throw err;
      }
    };

    init();
  }, []);

  if (!ready) return null;

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
                  <GluestackUIProvider mode="dark">
                    <PaperProvider theme={curTheme}>
                      <ThemeProvider value={themeProviderTheme}>
                        <Stack screenOptions={{ headerShown: false }}>
                          <Stack.Screen name="(auth)" />
                          <Stack.Screen name="(tabs)" />
                          <Stack.Screen name="(subpages)" />
                        </Stack>
                      </ThemeProvider>
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
