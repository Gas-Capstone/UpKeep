import { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { PaperProvider, Text } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ThemeProvider, useThemeMode } from "@/components/context/ThemeContext";
import { ScreenView } from "@/components/ui/ScreenView";
import { paperDarkTheme, paperLightTheme } from "@/constants/paper-theme";

function ErrorContent() {
  const { resolvedTheme } = useThemeMode();

  useEffect(() => {
    // A startup render failure must not leave the fallback behind the splash.
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <PaperProvider
      theme={resolvedTheme === "dark" ? paperDarkTheme : paperLightTheme}
    >
      <ScreenView>
        <Text variant="headlineSmall">UpKeep couldn&apos;t open</Text>
        <Text variant="bodyLarge">Please close the app and open it again.</Text>
      </ScreenView>
    </PaperProvider>
  );
}

export function StartupErrorScreen() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
