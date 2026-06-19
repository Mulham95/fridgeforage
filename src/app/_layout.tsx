import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

import { useColors } from '@/theme/tokens';
import { initDatabase } from '@/engine/db';
import { setupNotifications } from '@/engine/notifications';
import { SHELF_LIFE_SEED_SQL } from '@/engine/seedData';

// Show reminders as a banner even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const c = useColors();

  useEffect(() => {
    // First-launch setup: open DB, seed shelf-life data, create the Android channel.
    initDatabase(SHELF_LIFE_SEED_SQL).catch((e) => console.error('DB init failed', e));
    setupNotifications().catch((e) => console.error('Notif setup failed', e));
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: c.bg },
            headerShadowVisible: false,
            headerTintColor: c.primary,
            headerTitleStyle: { color: c.text, fontWeight: '800' },
            contentStyle: { backgroundColor: c.bg },
          }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="inventory" options={{ title: 'Your pantry' }} />
          <Stack.Screen name="add" options={{ title: 'Add item', presentation: 'modal' }} />
          <Stack.Screen name="scan" options={{ title: 'Scan barcode', presentation: 'modal' }} />
          <Stack.Screen name="recipe" options={{ title: 'Cook something' }} />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
