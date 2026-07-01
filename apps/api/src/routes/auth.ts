import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import rateLimit from 'express-rate-limit';
import prisma from '../services/prisma';
import { sendOtp, verifyOtp } from '../services/sms';
import { generateSalt, hashPhone } from '../services/psi';

const authRouter = Router();

const otpLimiter = process.env.DEV_OTP_BYPASS === 'true'
  ? rateLimit({ windowMs: 60_000, max: 1000 })
  : rateLimit({ windowMs: 60_000, max: 3, message: { message: 'Too many OTP requests' } });

const phoneSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Must be E.164 format'),
});

authRouter.post('/request-otp', otpLimiter, async (req, res, next) => {
  try {
    const { phone } = phoneSchema.parse(req.body);
    await sendOtp(phone);
    res.json({ message: 'OTP sent' });
  } catch (err) { next(err); }
});

authRouter.post('/verify-otp', otpLimiter, async (req, res, next) => {
  try {
    const { phone, code, displayName } = z.object({
      phone: z.string(),
      code: z.string().length(6),
      displayName: z.string().max(50).optional(),
    }).parse(req.body);

    const approved = await verifyOtp(phone, code);
    if (!approved) { res.status(401).json({ message: 'Invalid or expired OTP' }); return; }

    const phoneHint = phone.slice(-4);
    const salt = generateSalt();
    const phoneHash = hashPhone(salt, phone);

    let user = await prisma.user.findUnique({ where: { phoneHash } });
    if (!user) {
      user = await prisma.user.create({
        data: { id: uuid(), phoneHash, phoneHint, displayName: displayName ?? '', salt },
      });
    }

    const accessToken = jwt.sign({ sub: user.id }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' });
    const refreshToken = uuid();
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    await prisma.refreshToken.create({
      data: { id: uuid(), userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 30 * 86400_000) },
    });

    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, displayName: user.displayName, phoneHint: user.phoneHint, createdAt: user.createdAt },
      salt: user.salt,
    });
  } catch (err) { next(err); }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.expiresAt < new Date()) {
      res.status(401).json({ message: 'Refresh token invalid or expired' }); return;
    }
    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) { res.status(401).json({ message: 'User not found' }); return; }

    const accessToken = jwt.sign({ sub: user.id }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' });
    res.json({ accessToken });
  } catch (err) { next(err); }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    await prisma.refreshToken.deleteMany({ where: { tokenHash } });
    res.json({ message: 'Logged out' });
  } catch (err) { next(err); }
});

export default authRouter;
