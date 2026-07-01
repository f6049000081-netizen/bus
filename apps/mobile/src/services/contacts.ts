import * as Contacts from 'expo-contacts';
import { hashPhoneWithSalt } from './hashing';

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
  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
  });

  const results: HashedContact[] = [];
  for (const contact of data) {
    if (!contact.phoneNumbers?.length) continue;
    for (const phone of contact.phoneNumbers) {
      if (!phone.number) continue;
      const hash = await hashPhoneWithSalt(salt, phone.number, defaultCountry);
      if (!hash) continue;
      results.push({ hash, frequencyBucket: 'unknown', localName: contact.name });
    }
  }
  return results;
}
