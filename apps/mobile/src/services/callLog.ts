import { NativeModules, Platform, PermissionsAndroid } from 'react-native';

const { BusCallLog } = NativeModules;

export type CallType = 'incoming' | 'outgoing' | 'missed' | 'rejected' | 'unknown';

export interface RecentCall {
  number: string;
  date: number;
  type: CallType;
  duration: number;
  cachedName?: string;
}

export async function getRecentCalls(limit = 30): Promise<RecentCall[]> {
  if (Platform.OS !== 'android' || !BusCallLog) return [];
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
      { title: 'Call Log', message: 'Between Us needs call log access to show recent calls.', buttonPositive: 'Allow' }
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) return [];
    return BusCallLog.getRecentCalls(limit);
  } catch {
    return [];
  }
}
