import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { Expo } from 'expo-server-sdk';
import prisma from '../services/prisma';
import { requireAuth } from '../middleware/requireAuth';

const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

// POST /api/notifications/token — register or refresh push token
notificationsRouter.post('/token', async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string() }).parse(req.body);
    if (!Expo.isExpoPushToken(token)) {
      res.status(400).json({ message: 'Invalid Expo push token' });
      return;
    }
    await prisma.pushToken.upsert({
      where: { token },
      update: { userId: req.userId },
      create: { id: uuid(), userId: req.userId, token },
    });
    res.json({ registered: true });
  } catch (err) { next(err); }
});

// DELETE /api/notifications/token — unregister (logout)
notificationsRouter.delete('/token', async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string() }).parse(req.body);
    await prisma.pushToken.deleteMany({ where: { token, userId: req.userId } });
    res.json({ removed: true });
  } catch (err) { next(err); }
});

export default notificationsRouter;
