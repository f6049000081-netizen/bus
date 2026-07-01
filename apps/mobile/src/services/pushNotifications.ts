import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getApiClient } from '@bus/shared';

export async function registerForPushNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  const tokenData = await Notifications.getExpoPushTokenAsync();
  if (!tokenData.data) return;

  try {
    await getApiClient().post('/api/notifications/token', { token: tokenData.data });
  } catch {
    // Non-fatal: push notifications are best-effort
  }
}

export function setupNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}
