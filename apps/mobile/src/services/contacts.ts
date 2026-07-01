/**
 * Reads device contacts, normalizes phone numbers to E.164,
 * hashes them on-device, and returns the hash set for syncing.
 * Raw numbers and contact names never leave this module.
 */
import * as Contacts from 'expo-contacts';
import { hashContactPhone, normalizePhone } from './hashing';
import { buildFrequencyMap, assignBucket } from './frequency';
import { getExcludedContactIds } from './exclusions';

export interface HashedContact {
  hash: string;
  frequencyBucket: 'frequent' | 'occasional' | 'rare' | 'unknown';
  localName?: string;
  contactId?: string;
}

export async function requestContactsPermission(): Promise<boolean> {
  const { status } = await Contacts.requestPermissionsAsync();
  return status === 'granted';
}

export async function hashAllContacts(
  _salt: string,
  defaultCountry = 'ET'
): Promise<HashedContact[]> {
  const [{ data }, freqMap, excludedIds] = await Promise.all([
    Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name, Contacts.Fields.ID],
    }),
    buildFrequencyMap(defaultCountry),
    getExcludedContactIds(),
  ]);

  const results: HashedContact[] = [];
  const seen = new Set<string>();

  for (const contact of data) {
    if (contact.id && excludedIds.has(contact.id)) continue;
    if (!contact.phoneNumbers?.length) continue;
    for (const phone of contact.phoneNumbers) {
      if (!phone.number) continue;
      const normalized = normalizePhone(phone.number, defaultCountry);
      if (!normalized) continue;
      const hash = await hashContactPhone(phone.number, defaultCountry);
      if (!hash || seen.has(hash)) continue;
      seen.add(hash);
      results.push({
        hash,
        frequencyBucket: assignBucket(normalized, freqMap),
        localName: contact.name,
        contactId: contact.id,
      });
    }
  }
  return results;
}
