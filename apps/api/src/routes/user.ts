import { Router } from 'express';
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

userRouter.delete('/me', async (req, res, next) => {
  try {
    await prisma.user.delete({ where: { id: req.userId } });
    res.json({ message: 'Account and all associated data deleted' });
  } catch (err) { next(err); }
});

export default userRouter;
