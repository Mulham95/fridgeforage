// Local expiry notifications. Fire at `expires_at - 24h`, and only ever schedule
// the soonest N (iOS caps pending notifications at 64), rescheduling on app
// foreground so the window slides forward.
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { getDb, type InventoryItem } from "./db";
import { isHighRisk } from "./safetyLimits";

const LEAD_TIME_MS = 24 * 3_600_000; // notify 24h before expiry
const MAX_SCHEDULED = 60; // stay safely under iOS's 64 cap (leave headroom)
const CHANNEL_ID = "expiry";

/**
 * One-time setup: Android requires a notification channel (API 26+) for
 * scheduled local notifications to surface with the right importance.
 * Call once at app start.
 */
export async function setupNotifications(): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Expiry reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

export async function scheduleExpiryNotifications(): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    if (req.status !== "granted") return;
  }

  // Reschedule from scratch so the soonest-N window always reflects current data.
  await Notifications.cancelAllScheduledNotificationsAsync();

  const db = await getDb();
  const now = Date.now();
  // Only future fire-times, soonest first, capped.
  const items = await db.getAllAsync<InventoryItem>(
    `SELECT * FROM inventory_items
       WHERE expires_at > ?
       ORDER BY expires_at ASC
       LIMIT ?`,
    now + 60_000, // at least a minute out
    MAX_SCHEDULED
  );

  for (const it of items) {
    let fireAt = it.expires_at - LEAD_TIME_MS;
    // For short-shelf-life / high-risk items the 24h lead may already be in the
    // past; fall back to "soon" so the user still gets a heads-up.
    if (fireAt <= now) fireAt = now + 60 * 60_000; // in 1 hour
    if (fireAt <= now) continue;

    const urgent = isHighRisk(it.normalized_name);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: urgent ? "⚠️ Use it or toss it" : "🍴 Expiring soon",
        body: urgent
          ? `${it.normalized_name} is high-risk and should be used or thrown out today.`
          : `${it.normalized_name} expires soon — cook it before it's wasted.`,
        data: { itemId: it.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(fireAt),
        channelId: CHANNEL_ID,
      },
    });
  }
}
