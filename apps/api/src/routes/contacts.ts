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

// Search by contact hash: own contacts, BUS users, and past comparison matches
contactsRouter.get('/search', async (req, res, next) => {
  try {
    const hash = z.string().length(64).parse(req.query.hash);

    const [ownContact, busUser, busDbCount, mutualMatches] = await Promise.all([
      prisma.contactHash.findUnique({
        where: { userId_contactHash: { userId: req.userId, contactHash: hash } },
      }),
      prisma.user.findUnique({
        where: { lookupHash: hash },
        select: { id: true, displayName: true, phoneHint: true },
      }),
      prisma.contactHash.count({
        where: { contactHash: hash, userId: { not: req.userId } },
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

    // Don't expose the searching user as a BUS match
    const busMatch = busUser && busUser.id !== req.userId
      ? { displayName: busUser.displayName || `…${busUser.phoneHint}`, phoneHint: busUser.phoneHint }
      : null;

    res.json({
      ownContact: !!ownContact,
      busUser: busMatch,
      inBusDatabase: busDbCount,
      comparisons,
    });
  } catch (err) { next(err); }
});

contactsRouter.delete('/', async (req, res, next) => {
  try {
    await prisma.contactHash.deleteMany({ where: { userId: req.userId } });
    res.json({ message: 'All contact hashes deleted' });
  } catch (err) { next(err); }
});

export default contactsRouter;
