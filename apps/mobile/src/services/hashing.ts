import * as Crypto from 'expo-crypto';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

// Fixed app-level salt — MUST be identical on every client so that the same
// phone number always produces the same hash regardless of which user hashes it.
// Per-user salts are intentionally NOT used here: they would make intersection
// impossible (SHA256(salt_A+phone) ≠ SHA256(salt_B+phone) for the same phone).
const CONTACT_HASH_SALT = 'bus-contacts-v1';

export function normalizePhone(raw: string, defaultCountry = 'ET'): string | null {
  try {
    if (!isValidPhoneNumber(raw, defaultCountry as never)) return null;
    return parsePhoneNumber(raw, defaultCountry as never).format('E.164');
  } catch {
    return null;
  }
}

export async function hashContactPhone(rawPhone: string, defaultCountry = 'ET'): Promise<string | null> {
  const normalized = normalizePhone(rawPhone, defaultCountry);
  if (!normalized) return null;
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    CONTACT_HASH_SALT + ':' + normalized,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
}

// Kept for auth use (hashing the user's own phone for the users table).
export async function hashPhoneWithSalt(salt: string, rawPhone: string, defaultCountry = 'ET'): Promise<string | null> {
  const normalized = normalizePhone(rawPhone, defaultCountry);
  if (!normalized) return null;
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salt + ':' + normalized,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
}
