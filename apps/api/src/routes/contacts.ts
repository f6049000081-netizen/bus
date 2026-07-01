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

contactsRouter.delete('/', async (req, res, next) => {
  try {
    await prisma.contactHash.deleteMany({ where: { userId: req.userId } });
    res.json({ message: 'All contact hashes deleted' });
  } catch (err) { next(err); }
});

export default contactsRouter;
