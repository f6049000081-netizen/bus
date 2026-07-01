/**
 * Converts call-log data into frequency buckets and per-period counts.
 * Raw call logs never leave this module — only aggregate counts are used.
 */
import { Platform } from 'react-native';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { getCallFrequencies } from '../../modules/call-log/index';

export type FrequencyBucket = 'frequent' | 'occasional' | 'rare' | 'unknown';

export interface ContactFrequency {
  bucket: FrequencyBucket;
  weekCount: number;
  monthCount: number;
  totalCount: number;
}

function normalizeForLookup(raw: string, country = 'ET'): string | null {
  try {
    if (!isValidPhoneNumber(raw, country as never)) return null;
    return parsePhoneNumber(raw, country as never).format('E.164');
  } catch {
    return null;
  }
}

export async function buildFrequencyMap(defaultCountry = 'ET'): Promise<Map<string, ContactFrequency>> {
  const map = new Map<string, ContactFrequency>();
  if (Platform.OS !== 'android') return map;

  let frequencies: Awaited<ReturnType<typeof getCallFrequencies>>;
  try {
    frequencies = await getCallFrequencies();
  } catch {
    return map;
  }

  const totals = new Map<string, { week: number; month: number; total: number }>();

  for (const { number, weekCount, monthCount, totalCount } of frequencies) {
    const normalized = normalizeForLookup(number, defaultCountry);
    if (!normalized) continue;
    const existing = totals.get(normalized) ?? { week: 0, month: 0, total: 0 };
    totals.set(normalized, {
      week: existing.week + weekCount,
      month: existing.month + monthCount,
      total: existing.total + totalCount,
    });
  }

  for (const [number, { week, month, total }] of totals) {
    const bucket: FrequencyBucket = total >= 5 ? 'frequent' : total >= 1 ? 'occasional' : 'rare';
    map.set(number, { bucket, weekCount: week, monthCount: month, totalCount: total });
  }

  return map;
}
