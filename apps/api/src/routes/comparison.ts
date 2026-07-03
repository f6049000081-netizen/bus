import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import prisma from '../services/prisma';
import { requireAuth } from '../middleware/requireAuth';
import { intersect } from '../services/psi';

const comparisonRouter = Router();
comparisonRouter.use(requireAuth);

comparisonRouter.post('/session', async (req, res, next) => {
  try {
    const session = await prisma.comparisonSession.create({
      data: {
        id: uuid(),
        initiatorId: req.userId,
        token: uuid(),
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });
    res.json({ id: session.id, token: session.token, expiresAt: session.expiresAt });
  } catch (err) { next(err); }
});

comparisonRouter.post('/join/:token', async (req, res, next) => {
  try {
    const session = await prisma.comparisonSession.findUnique({ where: { token: req.params.token } });
    if (!session) { res.status(404).json({ message: 'Session not found' }); return; }
    if (session.expiresAt < new Date()) { res.status(410).json({ message: 'Session expired' }); return; }
    if (session.usedAt) { res.status(409).json({ message: 'Session already used' }); return; }
    if (session.initiatorId === req.userId) { res.status(400).json({ message: 'Cannot compare with yourself' }); return; }

    const SELECT_FIELDS = { contactHash: true, frequencyBucket: true, callCountWeek: true, callCountMonth: true, callCountTotal: true } as const;
    const [hashesA, hashesB] = await Promise.all([
      prisma.contactHash.findMany({ where: { userId: session.initiatorId, excluded: false }, select: SELECT_FIELDS }),
      prisma.contactHash.findMany({ where: { userId: req.userId, excluded: false }, select: SELECT_FIELDS }),
    ]);

    const mutual = intersect(hashesA.map((h) => h.contactHash), hashesB.map((h) => h.contactHash));
    const mapA = Object.fromEntries(hashesA.map((h) => [h.contactHash, h]));
    const mapB = Object.fromEntries(hashesB.map((h) => [h.contactHash, h]));

    const comparisonId = uuid();
    const [comparison] = await prisma.$transaction([
      prisma.comparison.create({
        data: {
          id: comparisonId,
          sessionId: session.id,
          userAId: session.initiatorId,
          userBId: req.userId,
          mutualCount: mutual.length,
          mutualContactHashes: mutual,
        },
      }),
      prisma.comparisonSession.update({ where: { id: session.id }, data: { usedAt: new Date() } }),
      ...(mutual.length > 0
        ? [prisma.mutualContact.createMany({
            data: mutual.map((hash) => ({
              id: uuid(),
              comparisonId,
              contactHash: hash,
              aWeekCount: mapA[hash]?.callCountWeek ?? 0,
              aMonthCount: mapA[hash]?.callCountMonth ?? 0,
              aTotalCount: mapA[hash]?.callCountTotal ?? 0,
              bWeekCount: mapB[hash]?.callCountWeek ?? 0,
              bMonthCount: mapB[hash]?.callCountMonth ?? 0,
              bTotalCount: mapB[hash]?.callCountTotal ?? 0,
            })),
          })]
        : []),
    ]);

    // Notify initiator (fire-and-forget)
    import('../services/push').then(({ sendPushToUser }) =>
      sendPushToUser(session.initiatorId, {
        title: 'Someone joined!',
        body: `Your comparison found ${mutual.length} mutual contact${mutual.length !== 1 ? 's' : ''}`,
        data: { comparisonId: comparison.id },
      })
    ).catch(() => {});

    res.json({
      id: comparison.id,
      mutualCount: mutual.length,
      mutuals: mutual.map((hash) => ({
        contactHash: hash,
        yourFrequency: mapB[hash]?.frequencyBucket ?? 'unknown',
        theirFrequency: mapA[hash]?.frequencyBucket ?? 'unknown',
        yourWeekCount: mapB[hash]?.callCountWeek ?? 0,
        theirWeekCount: mapA[hash]?.callCountWeek ?? 0,
        yourMonthCount: mapB[hash]?.callCountMonth ?? 0,
        theirMonthCount: mapA[hash]?.callCountMonth ?? 0,
        yourTotalCount: mapB[hash]?.callCountTotal ?? 0,
        theirTotalCount: mapA[hash]?.callCountTotal ?? 0,
      })),
      createdAt: comparison.createdAt,
    });
  } catch (err) { next(err); }
});

comparisonRouter.get('/session/:id', async (req, res, next) => {
  try {
    const session = await prisma.comparisonSession.findUnique({
      where: { id: req.params.id },
      include: { comparison: { select: { id: true } } },
    });
    if (!session) { res.status(404).json({ message: 'Not found' }); return; }
    if (session.initiatorId !== req.userId) { res.status(403).json({ message: 'Forbidden' }); return; }
    res.json({
      id: session.id,
      token: session.token,
      expiresAt: session.expiresAt,
      used: !!session.usedAt,
      comparisonId: session.comparison?.id ?? null,
    });
  } catch (err) { next(err); }
});

comparisonRouter.get('/:id', async (req, res, next) => {
  try {
    const comparison = await prisma.comparison.findUnique({ where: { id: req.params.id } });
    if (!comparison) { res.status(404).json({ message: 'Not found' }); return; }
    if (comparison.userAId !== req.userId && comparison.userBId !== req.userId) {
      res.status(403).json({ message: 'Forbidden' }); return;
    }
    const isA = comparison.userAId === req.userId;
    const SELECT_FIELDS = { contactHash: true, frequencyBucket: true, callCountWeek: true, callCountMonth: true, callCountTotal: true } as const;
    const otherId = isA ? comparison.userBId : comparison.userAId;
    const [myHashes, otherHashes] = await Promise.all([
      prisma.contactHash.findMany({
        where: { userId: req.userId, contactHash: { in: comparison.mutualContactHashes }, excluded: false },
        select: SELECT_FIELDS,
      }),
      prisma.contactHash.findMany({
        where: { userId: otherId, contactHash: { in: comparison.mutualContactHashes }, excluded: false },
        select: SELECT_FIELDS,
      }),
    ]);
    const myMap = Object.fromEntries(myHashes.map((h) => [h.contactHash, h]));
    const otherMap = Object.fromEntries(otherHashes.map((h) => [h.contactHash, h]));
    res.json({
      id: comparison.id,
      mutualCount: comparison.mutualCount,
      mutuals: comparison.mutualContactHashes.map((hash) => ({
        contactHash: hash,
        yourFrequency: myMap[hash]?.frequencyBucket ?? 'unknown',
        theirFrequency: otherMap[hash]?.frequencyBucket ?? 'unknown',
        yourWeekCount: myMap[hash]?.callCountWeek ?? 0,
        theirWeekCount: otherMap[hash]?.callCountWeek ?? 0,
        yourMonthCount: myMap[hash]?.callCountMonth ?? 0,
        theirMonthCount: otherMap[hash]?.callCountMonth ?? 0,
        yourTotalCount: myMap[hash]?.callCountTotal ?? 0,
        theirTotalCount: otherMap[hash]?.callCountTotal ?? 0,
      })),
      createdAt: comparison.createdAt,
    });
  } catch (err) { next(err); }
});

comparisonRouter.get('/', async (req, res, next) => {
  try {
    const comparisons = await prisma.comparison.findMany({
      where: { OR: [{ userAId: req.userId }, { userBId: req.userId }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, mutualCount: true, createdAt: true, userAId: true, userBId: true },
    });
    res.json(comparisons);
  } catch (err) { next(err); }
});

comparisonRouter.delete('/:id', async (req, res, next) => {
  try {
    const comparison = await prisma.comparison.findUnique({ where: { id: req.params.id } });
    if (!comparison) { res.status(404).json({ message: 'Not found' }); return; }
    if (comparison.userAId !== req.userId && comparison.userBId !== req.userId) {
      res.status(403).json({ message: 'Forbidden' }); return;
    }
    await prisma.comparison.delete({ where: { id: req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
});

export default comparisonRouter;
