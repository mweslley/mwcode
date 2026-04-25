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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = Number(process.env.PORT) || 3100;

app.use(cors());
app.use(express.json());
app.use(authMiddleware);
app.use(companyMiddleware);

// Validar API key no startup
const provider = process.env.MWCODE_PROVIDER || 'openrouter';
const apiKeyVar = `${provider.toUpperCase()}_API_KEY`;
const apiKey = process.env[apiKeyVar];
console.log(`[MWCode] Provider: ${provider}`);
console.log(`[MWCode] Empresa: ${process.env.MWCODE_EMPRESA || 'não definida'}`);
console.log(`[MWCode] Var de API Key: ${apiKeyVar}`);
console.log(`[MWCode] API Key: ${apiKey ? 'SIM (' + apiKey.substring(0, 8) + '...)' : 'NÃO'}`);
if (!apiKey) {
  console.error(`[MWCode] ERRO: ${apiKeyVar} não encontrada no .env!`);
}

app.get('/api/health', (_req, res) => {
  const dbStatus = process.env.DATABASE_URL ? 'configured' : 'not_configured';
  
  res.json({
    status: 'ok',
    version: '0.1.0',
    empresa: process.env.MWCODE_EMPRESA || null,
    area: process.env.MWCODE_AREA || null,
    provider: process.env.MWCODE_PROVIDER || null,
    model: process.env.MWCODE_MODEL || null,
    db: dbStatus,
    timestamp: new Date().toISOString()
  });
});
import { companyRouter } from './routes/company.js';
import { memoriesRouter } from './routes/memories.js';
import { skillsRouter } from './routes/skills.js';
import { authMiddleware } from './middleware/auth.js';

app.use('/api/auth', authRouter);
app.use('/api/enterprise', authMiddleware, companyRouter);

// Aplicar auth middleware nas rotas protegidas
app.use('/api/empresas', authMiddleware, companiesRouter);
app.use('/api/agentes', authMiddleware, agentsRouter);
app.use('/api/chat', authMiddleware, chatRouter);
app.use('/api/dashboard', authMiddleware, dashboardRouter);
app.use('/api/tarefas', authMiddleware, tasksRouter);
app.use('/api/memories', authMiddleware, memoriesRouter);
app.use('/api/skills', authMiddleware, skillsRouter);

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
