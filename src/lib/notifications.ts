import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { format } from "date-fns";

const NOTIFICATION_CHANNEL_ID = "silent";

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

export async function sendTestNotification() {
  if (Platform.OS === "web") {
    throw new Error("Notifications are only available on Android and iOS.");
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(
      NOTIFICATION_CHANNEL_ID,
      {
        name: "General",
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: null,
      },
    );
  }

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

  if (!hasNotificationPermission(permissions)) {
    throw new Error(
      "Notification permission was not granted. Enable notifications in your device settings.",
    );
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Wellness App",
      body: "hello world",
    },
    trigger: null,
  });
}

export async function scheduleTimeNotification(time: Date) {
  if (Platform.OS === "web") {
    throw new Error("Notifications are only available on Android and iOS.");
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(
      NOTIFICATION_CHANNEL_ID,
      {
        name: "General",
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: null,
      },
    );
  }

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

  if (!hasNotificationPermission(permissions)) {
    throw new Error(
      "Notification permission was not granted. Enable notifications in your device settings.",
    );
  }

  const scheduledDate = new Date();
  scheduledDate.setHours(time.getHours(), time.getMinutes(), 0, 0);

  if (scheduledDate <= new Date()) {
    scheduledDate.setDate(scheduledDate.getDate() + 1);
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Wellness App",
      body: `hello world at ${format(time, "h:mm aa")}`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: scheduledDate,
      channelId: NOTIFICATION_CHANNEL_ID,
    },
  });
}
