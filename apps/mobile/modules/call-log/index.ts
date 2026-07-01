import { Platform } from 'react-native';

export interface CallFrequency {
  number: string;
  count: number;
}

export async function getCallFrequencies(): Promise<CallFrequency[]> {
  if (Platform.OS !== 'android') return [];
  try {
    const { requireNativeModule } = require('expo-modules-core');
    const mod = requireNativeModule('ExpoCallLog');
    return await mod.getCallFrequencies();
  } catch {
    return [];
  }
}
