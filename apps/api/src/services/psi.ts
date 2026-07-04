import { createHash, createHmac, randomBytes } from 'crypto';

export function generateSalt(): string {
  return randomBytes(32).toString('hex');
}

export function hashPhone(salt: string, phoneE164: string): string {
  return createHmac('sha256', Buffer.from(salt, 'hex'))
    .update(phoneE164)
    .digest('hex');
}

// Fixed-salt hash matching the mobile hashing.ts formula: SHA256('bus-contacts-v1:' + e164)
export function hashForLookup(phoneE164: string): string {
  return createHash('sha256').update(`bus-contacts-v1:${phoneE164}`).digest('hex');
}

export function intersect(hashesA: string[], hashesB: string[]): string[] {
  const setB = new Set(hashesB);
  return hashesA.filter((h) => setB.has(h));
}
