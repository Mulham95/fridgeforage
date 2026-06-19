import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  SplineSans_400Regular,
  SplineSans_500Medium,
  SplineSans_600SemiBold,
  SplineSans_700Bold,
} from '@expo-google-fonts/spline-sans';

import { useColors, font } from '@/theme/tokens';
import { initDatabase } from '@/engine/db';
import { setupNotifications } from '@/engine/notifications';
import { scheduleExpiryNotifications } from '@/engine/notifications';
import { SHELF_LIFE_SEED_SQL } from '@/engine/seedData';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Show reminders as a banner even when the app is foregrounded (native only).
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const c = useColors();
  const appState = useRef(AppState.currentState);

  const [fontsLoaded] = useFonts({
    SplineSans_400Regular,
    SplineSans_500Medium,
    SplineSans_600SemiBold,
    SplineSans_700Bold,
  });

  useEffect(() => {
    // First-launch setup: open DB, seed shelf-life data, create the Android channel.
    initDatabase(SHELF_LIFE_SEED_SQL).catch((e) => console.error('DB init failed', e));
    setupNotifications().catch((e) => console.error('Notif setup failed', e));
  }, []);

  // Re-schedule notifications every time the app returns to foreground
  // so the "soonest N" window slides forward.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        scheduleExpiryNotifications().catch(() => {});
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: c.bg },
              headerShadowVisible: false,
              headerTintColor: c.primary,
              headerTitleStyle: { color: c.text, fontFamily: font.bold },
              contentStyle: { backgroundColor: c.bg },
            }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="inventory" options={{ title: 'Your pantry' }} />
            <Stack.Screen name="add" options={{ title: 'Add item', presentation: 'modal' }} />
            <Stack.Screen name="edit" options={{ title: 'Edit item', presentation: 'modal' }} />
            <Stack.Screen name="scan" options={{ title: 'Scan barcode', presentation: 'modal' }} />
            <Stack.Screen name="fridge" options={{ title: 'Scan your fridge', presentation: 'modal' }} />
            <Stack.Screen name="recipe" options={{ title: 'Cook something' }} />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
