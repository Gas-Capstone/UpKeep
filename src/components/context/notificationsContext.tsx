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
import {
  cancelDailySummaries,
  requestNotificationPermission,
  scheduleDailySummaries,
  sendNotificationNow,
} from "@/lib/notifications";
import { useHabitsContext } from "./habitsContext";
import { useMealsData } from "./mealsDataContext";
import { useUserContext } from "./userContext";

const SETTINGS_STORAGE_KEY = "wellness-app-notification-settings";

type NotificationSettings = {
  enabled: boolean;
  hour: number;
  minute: number;
};

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  hour: DEFAULT_SUMMARY_HOUR,
  minute: DEFAULT_SUMMARY_MINUTE,
};

export type NotificationsContextType = {
  enabled: boolean;
  hour: number;
  minute: number;
  setEnabled: (enabled: boolean) => Promise<void>;
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
  const { habitArray } = useHabitsContext();
  const { mealPlanEntries } = useMealsData();
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

  const resync = useCallback(() => {
    const run = ++latestRun.current;

    queue.current = queue.current
      .then(async () => {
        if (run !== latestRun.current || !settingsLoaded) return;

        if (!user || !settings.enabled) {
          await cancelDailySummaries();
          return;
        }

        const summaries = await loadSummaries(getSummaryDays());
        if (run !== latestRun.current) return;

        await scheduleDailySummaries(summaries, settings.hour, settings.minute);
      })
      .catch((err) => console.log("Error syncing notifications: ", err));

    return queue.current;
  }, [user, settings, settingsLoaded, loadSummaries]);

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      if (enabled && !(await requestNotificationPermission())) {
        throw new Error(
          "Notification permission was not granted. Enable notifications in your device settings.",
        );
      }
      updateSettings({ enabled });
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
      setEnabled,
      setSummaryTime,
      sendTestSummary,
      resync,
    }),
    [settings, setEnabled, setSummaryTime, sendTestSummary, resync],
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
