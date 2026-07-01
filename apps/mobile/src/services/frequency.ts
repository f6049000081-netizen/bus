/**
 * Converts call-log data into frequency buckets.
 * Raw call logs never leave this module — only bucket labels are used.
 */
import { Platform } from 'react-native';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { getCallFrequencies, CallFrequency } from '../../modules/call-log/index';

export type FrequencyBucket = 'frequent' | 'occasional' | 'rare' | 'unknown';

function normalizeForLookup(raw: string, country = 'ET'): string | null {
  try {
    if (!isValidPhoneNumber(raw, country as never)) return null;
    return parsePhoneNumber(raw, country as never).format('E.164');
  } catch {
    return null;
  }
}

/**
 * Build a map from normalized E.164 phone → FrequencyBucket.
 * Returns empty map on iOS or when permission is denied.
 */
export async function buildFrequencyMap(defaultCountry = 'ET'): Promise<Map<string, FrequencyBucket>> {
  const map = new Map<string, FrequencyBucket>();
  if (Platform.OS !== 'android') return map;

  let frequencies: CallFrequency[];
  try {
    frequencies = await getCallFrequencies();
  } catch {
    return map;
  }

  const totalCounts = new Map<string, number>();

  for (const { number, count } of frequencies) {
    const normalized = normalizeForLookup(number, defaultCountry);
    if (!normalized) continue;
    // getCallFrequencies already filters to last 90 days; counts are per normalized number
    totalCounts.set(normalized, (totalCounts.get(normalized) ?? 0) + count);
  }

  for (const [number, count] of totalCounts) {
    if (count >= 5) {
      map.set(number, 'frequent');
    } else if (count >= 1) {
      map.set(number, 'occasional');
    }
  }

  return map;
}

/**
 * If freqMap is non-empty (call log was accessible), contacts with no calls are 'rare'.
 * If freqMap is empty (no access — iOS or permission denied), fall back to 'unknown'.
 */
export function assignBucket(
  normalizedPhone: string,
  freqMap: Map<string, FrequencyBucket>
): FrequencyBucket {
  return freqMap.get(normalizedPhone) ?? (freqMap.size > 0 ? 'rare' : 'unknown');
}
