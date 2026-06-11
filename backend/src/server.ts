import express from 'express';
import cors from 'cors';
import apiRouter from './routes/api';
import { getDb } from './database';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 41234;
const FRONTEND_URL = process.env.FRONTEND_URL || '*';

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', apiRouter);

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error('[Server Error]', err);
    res.status(500).json({ error: '服务器内部错误' });
  },
);

getDb();

app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `[Server] 渔港进出港登记后端服务已启动: http://localhost:${PORT}`,
  );
});

export default app;
