import { Router } from 'express';
import { z } from 'zod';
import prisma from '../services/prisma';
import { requireAuth } from '../middleware/requireAuth';

const userRouter = Router();
userRouter.use(requireAuth);

userRouter.get('/me', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) { res.status(404).json({ message: 'User not found' }); return; }
    res.json({ id: user.id, displayName: user.displayName, phoneHint: user.phoneHint, createdAt: user.createdAt });
  } catch (err) { next(err); }
});

userRouter.patch('/me', async (req, res, next) => {
  try {
    const { displayName } = z.object({
      displayName: z.string().min(1).max(50),
    }).parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { displayName: displayName.trim() },
    });
    res.json({ id: user.id, displayName: user.displayName, phoneHint: user.phoneHint, createdAt: user.createdAt });
  } catch (err) { next(err); }
});

userRouter.delete('/me', async (req, res, next) => {
  try {
    await prisma.user.delete({ where: { id: req.userId } });
    res.json({ message: 'Account and all associated data deleted' });
  } catch (err) { next(err); }
});

export default userRouter;
