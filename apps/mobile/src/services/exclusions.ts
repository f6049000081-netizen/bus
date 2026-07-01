import * as SecureStore from 'expo-secure-store';

const KEY = 'bus_excluded_contact_ids';

export async function getExcludedContactIds(): Promise<Set<string>> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export async function setExcludedContactIds(ids: Set<string>): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify([...ids]));
}

export async function toggleExclusion(contactId: string): Promise<boolean> {
  const ids = await getExcludedContactIds();
  if (ids.has(contactId)) {
    ids.delete(contactId);
  } else {
    ids.add(contactId);
  }
  await setExcludedContactIds(ids);
  return ids.has(contactId);
}
