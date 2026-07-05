import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import prisma from '../services/prisma';
import { requireAuth } from '../middleware/requireAuth';

const contactsRouter = Router();
contactsRouter.use(requireAuth);

const hashSchema = z.object({
  hashes: z.array(z.object({
    hash: z.string().length(64),
    frequencyBucket: z.enum(['frequent', 'occasional', 'rare', 'unknown']),
    weekCount: z.number().int().min(0).default(0),
    monthCount: z.number().int().min(0).default(0),
    totalCount: z.number().int().min(0).default(0),
  })).max(5000),
});

const incrementalSchema = z.object({
  upsert: z.array(z.object({
    hash: z.string().length(64),
    frequencyBucket: z.enum(['frequent', 'occasional', 'rare', 'unknown']),
    weekCount: z.number().int().min(0).default(0),
    monthCount: z.number().int().min(0).default(0),
    totalCount: z.number().int().min(0).default(0),
  })).max(5000).default([]),
  remove: z.array(z.string().length(64)).max(5000).default([]),
});

// Full replace sync (first sync or manual re-sync)
contactsRouter.post('/sync', async (req, res, next) => {
  try {
    const { hashes } = hashSchema.parse(req.body);
    await prisma.$transaction([
      prisma.contactHash.deleteMany({ where: { userId: req.userId } }),
      prisma.contactHash.createMany({
        data: hashes.map((h) => ({
          id: uuid(),
          userId: req.userId,
          contactHash: h.hash,
          frequencyBucket: h.frequencyBucket,
          callCountWeek: h.weekCount,
          callCountMonth: h.monthCount,
          callCountTotal: h.totalCount,
        })),
        skipDuplicates: true,
      }),
    ]);
    res.json({ synced: hashes.length });
  } catch (err) { next(err); }
});

// Incremental sync — only send changed/added/removed contacts
contactsRouter.patch('/sync', async (req, res, next) => {
  try {
    const { upsert, remove } = incrementalSchema.parse(req.body);

    await prisma.$transaction([
      ...(remove.length > 0
        ? [prisma.contactHash.deleteMany({ where: { userId: req.userId, contactHash: { in: remove } } })]
        : []),
      ...upsert.map((h) =>
        prisma.contactHash.upsert({
          where: { userId_contactHash: { userId: req.userId, contactHash: h.hash } },
          update: {
            frequencyBucket: h.frequencyBucket,
            callCountWeek: h.weekCount,
            callCountMonth: h.monthCount,
            callCountTotal: h.totalCount,
            lastSyncedAt: new Date(),
          },
          create: {
            id: uuid(),
            userId: req.userId,
            contactHash: h.hash,
            frequencyBucket: h.frequencyBucket,
            callCountWeek: h.weekCount,
            callCountMonth: h.monthCount,
            callCountTotal: h.totalCount,
          },
        })
      ),
    ]);

    res.json({ upserted: upsert.length, removed: remove.length });
  } catch (err) { next(err); }
});

// Search by contact hash: own contacts, BUS users, who-saved-it, and past comparison matches
contactsRouter.get('/search', async (req, res, next) => {
  try {
    const hash = z.string().length(64).parse(req.query.hash);

    const [ownContact, busUser, savedByEntries, mutualMatches] = await Promise.all([
      prisma.contactHash.findUnique({
        where: { userId_contactHash: { userId: req.userId, contactHash: hash } },
      }),
      prisma.user.findUnique({
        where: { lookupHash: hash },
        select: { id: true, displayName: true, phoneHint: true },
      }),
      // BUS users who have this number saved as a contact
      prisma.contactHash.findMany({
        where: { contactHash: hash, userId: { not: req.userId } },
        include: { user: { select: { id: true, displayName: true, phoneHint: true } } },
        take: 10,
      }),
      prisma.mutualContact.findMany({
        where: {
          contactHash: hash,
          comparison: { OR: [{ userAId: req.userId }, { userBId: req.userId }] },
        },
        include: {
          comparison: {
            select: {
              id: true,
              createdAt: true,
              userAId: true,
              userBId: true,
              userA: { select: { displayName: true, phoneHint: true } },
              userB: { select: { displayName: true, phoneHint: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const comparisons = mutualMatches.map((mc) => {
      const isA = mc.comparison.userAId === req.userId;
      const other = isA ? mc.comparison.userB : mc.comparison.userA;
      return {
        comparisonId: mc.comparisonId,
        comparedAt: mc.comparison.createdAt,
        otherUserName: other.displayName || `…${other.phoneHint}`,
      };
    });

    const busMatch = busUser && busUser.id !== req.userId
      ? { displayName: busUser.displayName || `…${busUser.phoneHint}`, phoneHint: busUser.phoneHint }
      : null;

    // Users who have this number in their contacts (excludes the number's owner if they're a BUS user)
    const savedByUsers = savedByEntries
      .filter((e) => e.userId !== busUser?.id)
      .map((e) => ({
        displayName: e.user.displayName || `…${e.user.phoneHint}`,
        phoneHint: e.user.phoneHint,
      }));

    res.json({
      ownContact: !!ownContact,
      busUser: busMatch,
      inBusDatabase: savedByEntries.length,
      savedByUsers,
      comparisons,
    });
  } catch (err) { next(err); }
});

// Bulk lookup: given an array of contact hashes return name + source for each
contactsRouter.post('/bulk-lookup', async (req, res, next) => {
  try {
    const { hashes } = z.object({
      hashes: z.array(z.string().regex(/^[0-9a-f]{64}$/)).max(50),
    }).parse(req.body);

    const [busUsers, contactEntries] = await Promise.all([
      prisma.user.findMany({
        where: { lookupHash: { in: hashes } },
        select: { lookupHash: true, displayName: true, phoneHint: true },
      }),
      prisma.contactHash.findMany({
        where: { contactHash: { in: hashes }, userId: { not: req.userId } },
        include: { user: { select: { displayName: true, phoneHint: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    type LookupEntry = {
      displayName: string;
      phoneHint: string;
      source: 'bus_user' | 'in_contacts';
      savedBy: string[];
    };

    const result: Record<string, LookupEntry> = {};

    for (const u of busUsers) {
      if (u.lookupHash) {
        result[u.lookupHash] = {
          displayName: u.displayName || `…${u.phoneHint}`,
          phoneHint: u.phoneHint,
          source: 'bus_user',
          savedBy: [],
        };
      }
    }

    for (const c of contactEntries) {
      if (result[c.contactHash]?.source === 'bus_user') continue; // already have a better match
      if (!result[c.contactHash]) {
        result[c.contactHash] = { displayName: '', phoneHint: '', source: 'in_contacts', savedBy: [] };
      }
      result[c.contactHash].savedBy.push(c.user.displayName || `…${c.user.phoneHint}`);
    }

    res.json(result);
  } catch (err) { next(err); }
});

contactsRouter.delete('/', async (req, res, next) => {
  try {
    await prisma.contactHash.deleteMany({ where: { userId: req.userId } });
    res.json({ message: 'All contact hashes deleted' });
  } catch (err) { next(err); }
});

export default contactsRouter;
