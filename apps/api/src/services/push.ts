import { Expo, ExpoPushMessage } from 'expo-server-sdk';

const expo = new Expo();

export async function sendPushToUser(userId: string, message: { title: string; body: string; data?: object }): Promise<void> {
  const { default: prisma } = await import('./prisma');
  const tokens = await prisma.pushToken.findMany({ where: { userId } });
  if (!tokens.length) return;

  const messages: ExpoPushMessage[] = tokens
    .filter(t => Expo.isExpoPushToken(t.token))
    .map(t => ({
      to: t.token,
      sound: 'default' as const,
      title: message.title,
      body: message.body,
      data: message.data ?? {},
    }));

  if (!messages.length) return;

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch {
      // Don't fail the comparison join if push fails
    }
  }
}
