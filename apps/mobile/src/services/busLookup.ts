import { getApiClient } from '@bus/shared';
import { hashContactPhone } from './hashing';

export interface BusLookupResult {
  displayName: string;
  phoneHint: string;
  source: 'bus_user' | 'in_contacts';
  savedBy: string[];
}

/**
 * Hash up to 50 raw phone numbers and ask the API who they are in BUS.
 * Returns a map keyed by the original raw number string.
 */
export async function bulkLookupNumbers(numbers: string[]): Promise<Map<string, BusLookupResult>> {
  if (!numbers.length) return new Map();

  const entries = await Promise.all(
    numbers.map(async (num) => ({ num, hash: await hashContactPhone(num) }))
  );
  const valid = entries.filter((e): e is { num: string; hash: string } => e.hash !== null);
  if (!valid.length) return new Map();

  const uniqueHashes = [...new Set(valid.map((e) => e.hash))].slice(0, 50);

  const { data } = await getApiClient().post<Record<string, BusLookupResult>>(
    '/api/contacts/bulk-lookup',
    { hashes: uniqueHashes }
  );

  const result = new Map<string, BusLookupResult>();
  for (const { num, hash } of valid) {
    if (data[hash]) result.set(num, data[hash]);
  }
  return result;
}
