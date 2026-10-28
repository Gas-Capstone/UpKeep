import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { track } from "@/lib/metrics";
import type { Reminder } from "@/lib/reminders";

const NOTIFICATION_CHANNEL_ID = "silent";
// Habit and meal reminders are time-sensitive, so they get their own channel
// that pops up as a banner (high importance). Like everything else in the app
// they stay silent. Android locks a channel's importance and sound once it's
// created, which is why this is a new channel rather than a change to the
// silent one.
const REMINDER_CHANNEL_ID = "reminders";

// Each kind is scheduled and cleared independently. The identifier is
// `${kind}:${reminder.key}`, so one kind can be replaced without touching
// the others.
export type ReminderKind = "daily-summary" | "habit" | "meal";

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

// Which reminder kind a tap came from. Scheduled reminders carry their kind in
// data; the test notification sent from Settings carries none.
function openedKind(response: Notifications.NotificationResponse): string {
  const kind: unknown = response.notification.request.content.data?.kind;
  return typeof kind === "string" ? kind : "other";
}

const countedOpens = new Set<string>();

function recordOpen(response: Notifications.NotificationResponse) {
  // The same tap can arrive through both paths below.
  const key = `${response.notification.request.identifier}:${response.notification.date}`;
  if (countedOpens.has(key)) return;
  countedOpens.add(key);
  track("notification_opened", {
    ok: true,
    props: { kind: openedKind(response) },
  });
}

if (Platform.OS !== "web") {
  // A tap while the app is running or in the background.
  Notifications.addNotificationResponseReceivedListener(recordOpen);

  // A tap that launched the app from closed — the usual way a reminder gets
  // opened. Cleared once counted: the OS keeps returning the last tap, so
  // without this every later launch would count it again.
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (!response) return;
      recordOpen(response);
      return Notifications.clearLastNotificationResponseAsync();
    })
    .catch(() => {});
}

function hasNotificationPermission(
  settings: Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>,
) {
  return (
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

/** Whether reminders can actually be shown — without asking for permission. */
export async function notificationPermissionGranted() {
  if (Platform.OS === "web") return false;
  return hasNotificationPermission(await Notifications.getPermissionsAsync());
}

async function ensureNotificationChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    name: "General",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
  });
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: "Reminders",
    importance: Notifications.AndroidImportance.HIGH,
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

/**
 * Replaces every scheduled notification of one kind with `reminders`. An empty
 * list just clears that kind, which is how a switched-off setting is applied.
 * Reminders already in the past are skipped.
 *
 * Returns how many were actually scheduled. That can be fewer than were
 * passed in — past ones are skipped, and without notification permission
 * none are, silently. The count is how that gets noticed.
 */
export async function replaceScheduled(
  kind: ReminderKind,
  reminders: Reminder[],
): Promise<number> {
  if (Platform.OS === "web") return 0;

  const prefix = `${kind}:`;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => request.identifier.startsWith(prefix))
      .map((request) =>
        Notifications.cancelScheduledNotificationAsync(request.identifier),
      ),
  );

  if (reminders.length === 0) return 0;

  const permissions = await Notifications.getPermissionsAsync();
  if (!hasNotificationPermission(permissions)) return 0;

  await ensureNotificationChannel();

  const now = new Date();
  let scheduledCount = 0;

  for (const reminder of reminders) {
    if (reminder.date <= now) continue;

    await Notifications.scheduleNotificationAsync({
      identifier: `${prefix}${reminder.key}`,
      content: {
        title: reminder.title,
        body: reminder.body,
        data: { kind },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder.date,
        channelId:
          kind === "daily-summary" ? NOTIFICATION_CHANNEL_ID : REMINDER_CHANNEL_ID,
      },
    });
    scheduledCount += 1;
  }

  return scheduledCount;
}
