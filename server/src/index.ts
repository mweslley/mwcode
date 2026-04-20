import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { authMiddleware } from './middleware/auth.js';
import { companyMiddleware } from './middleware/company.js';
import { companiesRouter } from './routes/companies.js';
import { agentsRouter } from './routes/agents.js';
import { chatRouter } from './routes/chat.js';
import { dashboardRouter } from './routes/dashboard.js';
import { tasksRouter } from './routes/tasks.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3100;

app.use(cors());
app.use(express.json());
app.use(authMiddleware);
app.use(companyMiddleware);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '0.1.0',
    modo: process.env.MWCODE_MODE || 'flex',
    provider: process.env.MWCODE_PROVIDER || null,
    timestamp: new Date().toISOString()
  });
});

app.use('/api/empresas', companiesRouter);
app.use('/api/agentes', agentsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/tarefas', tasksRouter);

// Servir UI compilada em produção
const uiDist = path.resolve(__dirname, '../../ui/dist');
app.use(express.static(uiDist));
app.get('*', (_req, res, next) => {
  if (_req.path.startsWith('/api')) return next();
  res.sendFile(path.join(uiDist, 'index.html'), err => {
    if (err) res.status(404).send('UI não compilada. Rode: pnpm --filter @mwcode/ui build');
  });
});

function getLocalIPs(): string[] {
  const ips: string[] = [];
  const ifaces = os.networkInterfaces();
  for (const addrs of Object.values(ifaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) ips.push(addr.address);
    }
  }
  return ips;
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 MWCode API rodando na porta ${PORT}`);
  console.log(`   Local:    http://localhost:${PORT}`);
  for (const ip of getLocalIPs()) {
    console.log(`   Rede:     http://${ip}:${PORT}`);
  }
  console.log(`   Saúde:    http://localhost:${PORT}/api/health\n`);
});
