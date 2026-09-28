import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance } from "react-native";

type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  resolvedTheme: "light" | "dark";
  ready: boolean;
}

const THEME_STORAGE_KEY = "wellness-app-theme";
const HYDRATION_FALLBACK_MS = 400;

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  setTheme: () => {},
  resolvedTheme: "light",
  ready: false,
});

function normalize(value: string | null | undefined): "light" | "dark" {
  return value === "dark" ? "dark" : "light";
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [ready, setReady] = useState(false);
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(
    normalize(Appearance.getColorScheme()),
  );

  useEffect(() => {
    let mounted = true;

    // Never allow theme hydration to hold the native splash forever.
    const fallback = setTimeout(() => {
      if (mounted) setReady(true);
    }, HYDRATION_FALLBACK_MS);

    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((storedTheme) => {
        if (mounted && isThemeMode(storedTheme)) {
          setThemeState(storedTheme);
        }
      })
      .catch(() => {
        // Fall back to the phone's appearance if storage cannot be read.
      })
      .finally(() => {
        clearTimeout(fallback);
        if (mounted) setReady(true);
      });

    return () => {
      mounted = false;
      clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    const listener = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemTheme(normalize(colorScheme));
    });

    return () => listener.remove();
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);

    AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch(() => {
      // Keep the visible theme working even if persistence fails.
    });
  }, []);

  const resolvedTheme = theme === "system" ? systemTheme : theme;

  const value = useMemo(
    () => ({ theme, setTheme, resolvedTheme, ready }),
    [theme, setTheme, resolvedTheme, ready],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useThemeMode() {
  return useContext(ThemeContext);
}
