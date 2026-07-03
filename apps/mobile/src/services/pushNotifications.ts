import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getApiClient } from '@bus/shared';

const isExpoGo = Constants.executionEnvironment === 'storeClient';

export async function registerForPushNotifications(): Promise<void> {
  if (Platform.OS === 'web' || isExpoGo) return;

  const Notifications = await import('expo-notifications');
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
  if (isExpoGo) return;

  import('expo-notifications').then((Notifications) => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  });
}
