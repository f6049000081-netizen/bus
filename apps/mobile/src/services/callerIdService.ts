import { NativeModules, Platform } from 'react-native';
import type { HashedContact } from './contacts';

const { BusCallerId } = NativeModules;

export type ScreeningRole = 'GRANTED' | 'DENIED' | 'UNSUPPORTED';

export async function requestCallScreeningRole(): Promise<ScreeningRole> {
  if (Platform.OS !== 'android' || !BusCallerId) return 'UNSUPPORTED';
  return BusCallerId.requestCallScreeningRole();
}

export async function isCallScreeningEnabled(): Promise<boolean> {
  if (Platform.OS !== 'android' || !BusCallerId) return false;
  return BusCallerId.isCallScreeningEnabled();
}

/** Writes hash→localName map to SharedPreferences for offline caller lookup. */
export async function updateCallerIdCache(contacts: HashedContact[]): Promise<void> {
  if (Platform.OS !== 'android' || !BusCallerId) return;
  const cache: Record<string, string> = {};
  for (const c of contacts) {
    if (c.hash && c.localName) cache[c.hash] = c.localName;
  }
  await BusCallerId.updateContactCache(JSON.stringify(cache));
}

/** Persists JWT + API URL so the service can do API lookups for unknown callers. */
export async function saveCallerIdCredentials(
  token: string,
  apiUrl: string,
  countryIso = 'ET'
): Promise<void> {
  if (Platform.OS !== 'android' || !BusCallerId) return;
  await BusCallerId.saveCredentials(token, apiUrl, countryIso);
}
