import * as Crypto from 'expo-crypto';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

export function normalizePhone(raw: string, defaultCountry = 'ET'): string | null {
  try {
    if (!isValidPhoneNumber(raw, defaultCountry as never)) return null;
    return parsePhoneNumber(raw, defaultCountry as never).format('E.164');
  } catch {
    return null;
  }
}

export async function hmacSha256(salt: string, data: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salt + ':' + data,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
}

export async function hashPhoneWithSalt(salt: string, rawPhone: string, defaultCountry = 'ET'): Promise<string | null> {
  const normalized = normalizePhone(rawPhone, defaultCountry);
  if (!normalized) return null;
  return hmacSha256(salt, normalized);
}
