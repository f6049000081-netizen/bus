import { Prisma } from '@prisma/client';
import prisma from './prisma';
import { sealHash } from './hashCrypto';

// One-time, idempotent data migration: encrypts every plaintext contact hash already in
// the DB (ContactHash, User.lookupHash, MutualContact, Comparison.mutualContactHashes).
// Runs on API startup. Guarded by a Postgres advisory lock (safe with several instances)
// and an AppMeta marker written in the same transaction, so it can never run twice.

const MARKER_KEY = 'contact_hash_encryption';
const MARKER_VALUE = 'aes-256-cbc-v1';
const LOCK_ID = 727_001;
const CHUNK = 1000;

type Tx = Prisma.TransactionClient;

async function bulkUpdate(tx: Tx, table: 'ContactHash' | 'User' | 'MutualContact', column: 'contactHash' | 'lookupHash', rows: { id: string; value: string }[]) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const values = Prisma.join(rows.slice(i, i + CHUNK).map((r) => Prisma.sql`(${r.id}, ${r.value})`));
    await tx.$executeRaw`
      UPDATE ${Prisma.raw(`"${table}"`)} AS t
      SET ${Prisma.raw(`"${column}"`)} = v.val
      FROM (VALUES ${values}) AS v(id, val)
      WHERE t."id" = v.id`;
  }
}

export async function encryptExistingHashes(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_ID})`;

    const done = await tx.appMeta.findUnique({ where: { key: MARKER_KEY } });
    if (done) return;

    const contacts = await tx.contactHash.findMany({ select: { id: true, contactHash: true } });
    await bulkUpdate(tx, 'ContactHash', 'contactHash', contacts.map((r) => ({ id: r.id, value: sealHash(r.contactHash) })));

    const users = await tx.user.findMany({ where: { lookupHash: { not: null } }, select: { id: true, lookupHash: true } });
    await bulkUpdate(tx, 'User', 'lookupHash', users.map((r) => ({ id: r.id, value: sealHash(r.lookupHash!) })));

    const mutuals = await tx.mutualContact.findMany({ select: { id: true, contactHash: true } });
    await bulkUpdate(tx, 'MutualContact', 'contactHash', mutuals.map((r) => ({ id: r.id, value: sealHash(r.contactHash) })));

    const comparisons = await tx.comparison.findMany({ select: { id: true, mutualContactHashes: true } });
    for (const c of comparisons) {
      if (c.mutualContactHashes.length === 0) continue;
      await tx.comparison.update({
        where: { id: c.id },
        data: { mutualContactHashes: c.mutualContactHashes.map(sealHash) },
      });
    }

    await tx.appMeta.create({ data: { key: MARKER_KEY, value: MARKER_VALUE } });
    console.log(
      `[migration] Encrypted hashes: ${contacts.length} contacts, ${users.length} users, ` +
      `${mutuals.length} mutuals, ${comparisons.length} comparisons`
    );
  }, { timeout: 10 * 60_000, maxWait: 60_000 });
}
