import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import authRouter from './routes/auth';
import contactsRouter from './routes/contacts';
import comparisonRouter from './routes/comparison';
import userRouter from './routes/user';

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

app.use('/api/auth', authRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/comparison', comparisonRouter);
app.use('/api/user', userRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof Error && err.name === 'ZodError') {
    res.status(400).json({ message: 'Validation error', details: (err as { errors?: unknown }).errors });
    return;
  }
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`BUS API running on http://localhost:${PORT}`));
