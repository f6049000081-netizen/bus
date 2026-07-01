/**
 * Reads device contacts, normalizes phone numbers to E.164,
 * hashes them on-device, and returns the hash set for syncing.
 * Raw numbers and contact names never leave this module.
 */
import * as Contacts from 'expo-contacts';
import { hashPhoneWithSalt, normalizePhone } from './hashing';
import { buildFrequencyMap, assignBucket } from './frequency';

export interface HashedContact {
  hash: string;
  frequencyBucket: 'frequent' | 'occasional' | 'rare' | 'unknown';
  localName?: string;
}

export async function requestContactsPermission(): Promise<boolean> {
  const { status } = await Contacts.requestPermissionsAsync();
  return status === 'granted';
}

export async function hashAllContacts(
  salt: string,
  defaultCountry = 'ET'
): Promise<HashedContact[]> {
  const [{ data }, freqMap] = await Promise.all([
    Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
    }),
    buildFrequencyMap(defaultCountry),
  ]);

  const results: HashedContact[] = [];
  const seen = new Set<string>();

  for (const contact of data) {
    if (!contact.phoneNumbers?.length) continue;
    for (const phone of contact.phoneNumbers) {
      if (!phone.number) continue;
      const normalized = normalizePhone(phone.number, defaultCountry);
      if (!normalized) continue;
      const hash = await hashPhoneWithSalt(salt, phone.number, defaultCountry);
      if (!hash || seen.has(hash)) continue;
      seen.add(hash);
      results.push({
        hash,
        frequencyBucket: assignBucket(normalized, freqMap),
        localName: contact.name,
      });
    }
  }
  return results;
}
