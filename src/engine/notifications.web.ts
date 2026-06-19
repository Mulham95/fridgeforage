/**
 * Web no-op notifications. Browsers don't support scheduled local OS
 * notifications the way the native app does, so these resolve immediately.
 * Metro picks this over notifications.ts on web.
 */
export async function setupNotifications(): Promise<void> {}

export async function scheduleExpiryNotifications(): Promise<void> {}
