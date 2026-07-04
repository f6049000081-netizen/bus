import * as FileSystem from 'expo-file-system/legacy';
import { HashedContact } from './contacts';
import { getApiClient } from '@bus/shared';

const STATE_PATH = FileSystem.documentDirectory + 'bus_sync_state.json';

type SyncState = Record<string, string>; // hash → fingerprint

function fp(h: HashedContact): string {
  return `${h.frequencyBucket}:${h.weekCount}:${h.monthCount}:${h.totalCount}`;
}

async function loadState(): Promise<SyncState> {
  try {
    const info = await FileSystem.getInfoAsync(STATE_PATH);
    if (!info.exists) return {};
    const raw = await FileSystem.readAsStringAsync(STATE_PATH);
    return JSON.parse(raw) as SyncState;
  } catch {
    return {};
  }
}

async function saveState(contacts: HashedContact[]): Promise<void> {
  try {
    const state: SyncState = {};
    for (const h of contacts) state[h.hash] = fp(h);
    await FileSystem.writeAsStringAsync(STATE_PATH, JSON.stringify(state));
  } catch {
    // Non-fatal: next sync will just do a full replace
  }
}

export async function syncContacts(contacts: HashedContact[]): Promise<{ upserted: number; removed: number }> {
  const stored = await loadState();
  const isFirstSync = Object.keys(stored).length === 0;

  if (isFirstSync) {
    // Full replace on first sync
    const { data } = await getApiClient().post<{ synced: number }>('/api/contacts/sync', {
      hashes: contacts.map((h) => ({
        hash: h.hash,
        frequencyBucket: h.frequencyBucket,
        weekCount: h.weekCount,
        monthCount: h.monthCount,
        totalCount: h.totalCount,
      })),
    });
    await saveState(contacts);
    return { upserted: data.synced, removed: 0 };
  }

  // Incremental diff
  const currentMap = new Map(contacts.map((h) => [h.hash, h]));
  const upsert = contacts.filter((h) => stored[h.hash] !== fp(h));
  const remove = Object.keys(stored).filter((h) => !currentMap.has(h));

  if (upsert.length === 0 && remove.length === 0) {
    return { upserted: 0, removed: 0 };
  }

  const { data } = await getApiClient().patch<{ upserted: number; removed: number }>('/api/contacts/sync', {
    upsert: upsert.map((h) => ({
      hash: h.hash,
      frequencyBucket: h.frequencyBucket,
      weekCount: h.weekCount,
      monthCount: h.monthCount,
      totalCount: h.totalCount,
    })),
    remove,
  });

  await saveState(contacts);
  return data;
}

export async function clearSyncState(): Promise<void> {
  try { await FileSystem.deleteAsync(STATE_PATH, { idempotent: true }); } catch { /* ignore */ }
}
