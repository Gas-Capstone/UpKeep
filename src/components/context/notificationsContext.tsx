import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import {
  DEFAULT_SUMMARY_HOUR,
  DEFAULT_SUMMARY_MINUTE,
  EMPTY_SUMMARY_BODY,
  SUMMARY_TITLE,
  buildDailySummaries,
  formatSummaryBody,
  getSummaryDays,
} from "@/lib/dailySummary";
import { recipeKey } from "@/lib/meals/meals";
import {
  replaceScheduled,
  requestNotificationPermission,
  sendNotificationNow,
} from "@/lib/notifications";
import {
  buildHabitReminders,
  buildMealReminders,
  buildSummaryReminders,
} from "@/lib/reminders";
import { useHabitsContext } from "./habitsContext";
import { useMealsData } from "./mealsDataContext";
import { useUserContext } from "./userContext";

const SETTINGS_STORAGE_KEY = "wellness-app-notification-settings";

type NotificationSettings = {
  enabled: boolean; // daily summary
  hour: number;
  minute: number;
  habitReminders: boolean;
  mealReminders: boolean;
};

// The on/off switches, each of which needs permission before turning on.
export type NotificationToggle = "enabled" | "habitReminders" | "mealReminders";

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  hour: DEFAULT_SUMMARY_HOUR,
  minute: DEFAULT_SUMMARY_MINUTE,
  habitReminders: false,
  mealReminders: false,
};

export type NotificationsContextType = {
  enabled: boolean;
  hour: number;
  minute: number;
  habitReminders: boolean;
  mealReminders: boolean;
  setToggle: (toggle: NotificationToggle, value: boolean) => Promise<void>;
  setSummaryTime: (hour: number, minute: number) => void;
  sendTestSummary: () => Promise<void>;
  resync: () => Promise<void>;
};

export const notificationsContext = createContext<NotificationsContextType | null>(null);

type NotificationsProviderProps = {
  children: React.ReactNode;
};

export const NotificationsProvider = ({ children }: NotificationsProviderProps) => {
  const { user } = useUserContext();
  const { habitArray, habitCompletions } = useHabitsContext();
  const { recipes, mealPlanEntries, mealCompletions } = useMealsData();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // notification "runs" are chained so multiple notifs don't cause conflict
  const queue = useRef<Promise<void>>(Promise.resolve());
  const latestRun = useRef(0);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_STORAGE_KEY)
      .then((stored) => {
        if (stored) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      })
      .catch((err) => console.log("Error loading notification settings: ", err))
      .finally(() => setSettingsLoaded(true));
  }, []);

  const updateSettings = useCallback((changes: Partial<NotificationSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...changes };
      AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next)).catch((err) =>
        console.log("Error saving notification settings: ", err),
      );
      return next;
    });
  }, []);

  // Changes to habits or planned meals rebuild this, which re-runs resync.
  const loadSummaries = useCallback(
    async (days: Date[]) => buildDailySummaries(days, habitArray, mealPlanEntries),
    [habitArray, mealPlanEntries],
  );

  // Keyed by recipeKey — catalog and custom recipe ids can collide.
  const recipeNameByKey = useMemo(
    () => new Map(recipes.map((recipe) => [recipeKey(recipe), recipe.name])),
    [recipes],
  );

  const resync = useCallback(() => {
    const run = ++latestRun.current;

    queue.current = queue.current
      .then(async () => {
        if (run !== latestRun.current || !settingsLoaded) return;

        // Logged out means nothing should stay scheduled.
        const summaryOn = Boolean(user) && settings.enabled;
        const habitsOn = Boolean(user) && settings.habitReminders;
        const mealsOn = Boolean(user) && settings.mealReminders;

        const days = getSummaryDays();
        const summaries = await loadSummaries(days);
        if (run !== latestRun.current) return;

        await replaceScheduled(
          "daily-summary",
          summaryOn
            ? buildSummaryReminders(summaries, settings.hour, settings.minute)
            : [],
        );
        await replaceScheduled(
          "habit",
          habitsOn ? buildHabitReminders(days, habitArray, habitCompletions) : [],
        );
        await replaceScheduled(
          "meal",
          mealsOn
            ? buildMealReminders(
                days,
                mealPlanEntries,
                mealCompletions,
                (entry) =>
                  recipeNameByKey.get(
                    recipeKey({ id: entry.recipeId, isCustom: entry.isCustom }),
                  ) ?? "a planned recipe",
              )
            : [],
        );
      })
      .catch((err) => console.log("Error syncing notifications: ", err));

    return queue.current;
  }, [
    user,
    settings,
    settingsLoaded,
    loadSummaries,
    habitArray,
    habitCompletions,
    mealPlanEntries,
    mealCompletions,
    recipeNameByKey,
  ]);

  const setToggle = useCallback(
    async (toggle: NotificationToggle, value: boolean) => {
      if (value && !(await requestNotificationPermission())) {
        throw new Error(
          "Notification permission was not granted. Enable notifications in your device settings.",
        );
      }
      updateSettings({ [toggle]: value });
    },
    [updateSettings],
  );

  const setSummaryTime = useCallback(
    (hour: number, minute: number) => updateSettings({ hour, minute }),
    [updateSettings],
  );

  const sendTestSummary = useCallback(async () => {
    if (!user) throw new Error("You must be logged in.");
    const [today] = await loadSummaries(getSummaryDays().slice(0, 1));
    await sendNotificationNow(SUMMARY_TITLE, formatSummaryBody(today) ?? EMPTY_SUMMARY_BODY);
  }, [user, loadSummaries]);

  useEffect(() => {
    resync();
  }, [resync]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") resync();
    });
    return () => subscription.remove();
  }, [resync]);

  const contextValue = useMemo(
    () => ({
      enabled: settings.enabled,
      hour: settings.hour,
      minute: settings.minute,
      habitReminders: settings.habitReminders,
      mealReminders: settings.mealReminders,
      setToggle,
      setSummaryTime,
      sendTestSummary,
      resync,
    }),
    [settings, setToggle, setSummaryTime, sendTestSummary, resync],
  );

  return (
    <notificationsContext.Provider value={contextValue}>
      {children}
    </notificationsContext.Provider>
  );
};

export function useNotifications() {
  const ctx = useContext(notificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within a <NotificationsProvider>");
  }
  return ctx;
}
