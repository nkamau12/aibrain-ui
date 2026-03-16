import express from 'express';
import cors from 'cors';
import memoriesRouter from './routes/memories.js';
import tagsRouter from './routes/tags.js';
import statsRouter from './routes/stats.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/memories', memoriesRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/stats', statsRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware — must have 4 params for Express to treat it as error handler
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : 'Internal server error';
  const status = (err as any)?.status ?? 500;
  console.error('[server] Error:', message);
  res.status(status).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`[server] aibrain API listening on http://localhost:${PORT}`);
});
