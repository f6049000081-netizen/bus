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

    const [hashesA, hashesB] = await Promise.all([
      prisma.contactHash.findMany({ where: { userId: session.initiatorId, excluded: false }, select: { contactHash: true, frequencyBucket: true } }),
      prisma.contactHash.findMany({ where: { userId: req.userId, excluded: false }, select: { contactHash: true, frequencyBucket: true } }),
    ]);

    const mutual = intersect(hashesA.map((h) => h.contactHash), hashesB.map((h) => h.contactHash));
    const bucketMapA = Object.fromEntries(hashesA.map((h) => [h.contactHash, h.frequencyBucket]));
    const bucketMapB = Object.fromEntries(hashesB.map((h) => [h.contactHash, h.frequencyBucket]));

    const [comparison] = await prisma.$transaction([
      prisma.comparison.create({
        data: {
          id: uuid(),
          sessionId: session.id,
          userAId: session.initiatorId,
          userBId: req.userId,
          mutualCount: mutual.length,
          mutualContactHashes: mutual,
        },
      }),
      prisma.comparisonSession.update({ where: { id: session.id }, data: { usedAt: new Date() } }),
    ]);

    res.json({
      id: comparison.id,
      mutualCount: mutual.length,
      mutuals: mutual.map((hash) => ({
        contactHash: hash,
        yourFrequency: bucketMapB[hash] ?? 'unknown',
        theirFrequency: bucketMapA[hash] ?? 'unknown',
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

export default comparisonRouter;
