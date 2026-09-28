import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { parseISO } from "date-fns";

import { DailySummary, SUMMARY_TITLE, formatSummaryBody } from "@/lib/dailySummary";

const NOTIFICATION_CHANNEL_ID = "silent";
const DAILY_SUMMARY_PREFIX = "daily-summary:";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function hasNotificationPermission(
  settings: Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>,
) {
  return (
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

async function ensureNotificationChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    name: "General",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
  });
}

export async function requestNotificationPermission() {
  if (Platform.OS === "web") return false;

  // android 13+ only offers the prompt once a channel exists
  await ensureNotificationChannel();

  let permissions = await Notifications.getPermissionsAsync();
  if (!hasNotificationPermission(permissions)) {
    permissions = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: false,
      },
    });
  }
  return hasNotificationPermission(permissions);
}

export async function sendNotificationNow(title: string, body: string) {
  if (Platform.OS === "web") {
    throw new Error("Notifications are only available on Android and iOS.");
  }

  if (!(await requestNotificationPermission())) {
    throw new Error(
      "Notification permission was not granted. Enable notifications in your device settings.",
    );
  }

  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });
}

export async function cancelDailySummaries() {
  if (Platform.OS === "web") return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => request.identifier.startsWith(DAILY_SUMMARY_PREFIX))
      .map((request) =>
        Notifications.cancelScheduledNotificationAsync(request.identifier),
      ),
  );
}

export async function scheduleDailySummaries(
  summaries: DailySummary[],
  hour: number,
  minute: number,
) {
  if (Platform.OS === "web") return;

  const permissions = await Notifications.getPermissionsAsync();
  if (!hasNotificationPermission(permissions)) return;

  await ensureNotificationChannel();
  await cancelDailySummaries();

  const now = new Date();

  for (const summary of summaries) {
    const body = formatSummaryBody(summary);
    if (!body) continue;

    const date = parseISO(summary.dateKey);
    date.setHours(hour, minute, 0, 0);
    if (date <= now) continue;

    await Notifications.scheduleNotificationAsync({
      identifier: `${DAILY_SUMMARY_PREFIX}${summary.dateKey}`,
      content: {
        title: SUMMARY_TITLE,
        body,
        data: { kind: "daily-summary", date: summary.dateKey },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: NOTIFICATION_CHANNEL_ID,
      },
    });
  }
}
