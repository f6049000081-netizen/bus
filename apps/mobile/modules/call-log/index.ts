import { NativeModules, Platform } from 'react-native';

export interface CallFrequency {
  number: string;
  weekCount: number;
  monthCount: number;
  totalCount: number;
}

/**
 * Returns call + SMS frequency counts per contact for the last 90 days.
 * Requires READ_CALL_LOG (and optionally READ_SMS) permissions.
 * Falls back to [] on iOS, Expo Go, or when permissions are denied.
 */
export async function getCallFrequencies(): Promise<CallFrequency[]> {
  if (Platform.OS !== 'android') return [];
  const mod = NativeModules.BusCallLog;
  if (!mod) return []; // Expo Go or dev build without native module
  try {
    return (await mod.getFrequencies()) as CallFrequency[];
  } catch {
    return [];
  }
}
