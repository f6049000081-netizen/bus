import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import authRouter from './routes/auth';
import contactsRouter from './routes/contacts';
import comparisonRouter from './routes/comparison';
import userRouter from './routes/user';
import notificationsRouter from './routes/notifications';

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

app.use('/api/auth', authRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/comparison', comparisonRouter);
app.use('/api/user', userRouter);
app.use('/api/notifications', notificationsRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof Error && err.name === 'ZodError') {
    res.status(400).json({ message: 'Validation error', details: (err as { errors?: unknown }).errors });
    return;
  }
  console.error(err);
  const message = err instanceof Error ? err.message : 'Internal server error';
  const status = (err as { status?: number; statusCode?: number }).status ?? (err as { status?: number; statusCode?: number }).statusCode ?? 500;
  res.status(status >= 400 && status < 600 ? status : 500).json({ message });
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`BUS API running on http://localhost:${PORT}`));
