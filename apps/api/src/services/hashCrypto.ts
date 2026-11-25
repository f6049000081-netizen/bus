import { createCipheriv, createDecipheriv } from 'crypto';

// Server-side encryption of contact hashes at rest.
//
// Clients send SHA256("bus-contacts-v1:" + e164). Because phone numbers are a small
// keyspace, those hashes alone can be brute-forced back to numbers. We therefore never
// store them as-is: every hash is encrypted with a server secret (CONTACT_ENC_KEY) before
// it touches the database, and decrypted only when returned to the owning client.
//
// The encryption is deterministic (AES-256-CBC, fixed zero IV, no padding over the
// 32-byte digest) so equality still works: intersection, search and unique constraints
// operate directly on ciphertexts. Inputs are uniformly random SHA-256 digests, so a
// fixed IV leaks nothing beyond equality, which is exactly what matching needs.
//
// Threat model: a leaked DB dump/backup is useless without the key. It does NOT protect
// against an attacker who controls the running server (they hold the key).
//
// Ciphertext is 32 bytes → 64 lowercase hex, the same shape as the plaintext hash.

const ALGO = 'aes-256-cbc';
const ZERO_IV = Buffer.alloc(16, 0);
const HEX64 = /^[0-9a-f]{64}$/;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.CONTACT_ENC_KEY ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error('CONTACT_ENC_KEY must be set to 64 hex chars (32 bytes). Generate: openssl rand -hex 32');
  }
  cachedKey = Buffer.from(raw, 'hex');
  return cachedKey;
}

/** Fail fast at startup if the key is missing or malformed. */
export function assertHashKeyConfigured(): void {
  getKey();
}

function run(decrypt: boolean, hex: string): string {
  const h = hex.toLowerCase();
  if (!HEX64.test(h)) throw new Error('Expected 64-char hex hash');
  const c = decrypt ? createDecipheriv(ALGO, getKey(), ZERO_IV) : createCipheriv(ALGO, getKey(), ZERO_IV);
  c.setAutoPadding(false);
  return Buffer.concat([c.update(Buffer.from(h, 'hex')), c.final()]).toString('hex');
}

/** Client hash → stored (encrypted) form. */
export const sealHash = (clientHash: string): string => run(false, clientHash);

/** Stored (encrypted) form → client hash. */
export const openHash = (storedHash: string): string => run(true, storedHash);
