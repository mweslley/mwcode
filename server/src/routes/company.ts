import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DATA_DIR, dataDir, dataPath } from '../lib/data-dir.js';
import { bootstrapCEO } from '../services/agent-loop.js';

const COMPANY_DIR = DATA_DIR;

interface Company {
  id: string;
  userId: string;
  name: string;
  area: string;
  mission: string;
  employees: string;
  goals: string[];
  createdAt: string;
}

function getCompanyDir(): string {
  if (!fs.existsSync(COMPANY_DIR)) fs.mkdirSync(COMPANY_DIR, { recursive: true });
  return COMPANY_DIR;
}

function getCompany(userId: string): Company | null {
  const file = path.join(getCompanyDir(), `${userId}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

export const companyRouter = Router();

// O frontend chama /api/enterprise/company — registrar nas duas pra
// compatibilidade (/ e /company) sem quebrar nada que já chame /
const handlers = {
  get: (req: any, res: any) => {
    const userId = req.userId;
    const company = getCompany(userId);
    if (!company) return res.status(404).json({ error: 'Empresa não encontrada' });
    res.json(company);
  },
  post: (req: any, res: any) => {
    const userId = req.userId;
    // Aceita 'name' ou 'companyName' (o Onboarding manda companyName)
    const { name, companyName, area, mission, employees, goals } = req.body;

    const company: Company = {
      id: crypto.randomUUID(),
      userId,
      name: name || companyName || '',
      area: area || '',
      mission: mission || '',
      employees: employees || '1-10',
      goals: goals || [],
      createdAt: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(getCompanyDir(), `${userId}.json`),
      JSON.stringify(company, null, 2)
    );

    // Aciona CEO imediatamente para contratar agentes e criar tarefas
    bootstrapCEO(userId).catch(() => {});

    res.json(company);
  },
  put: (req: any, res: any) => {
    const userId = req.userId;
    const data = req.body;

    const existing = getCompany(userId);
    if (!existing) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    const updated = { ...existing, ...data };
    fs.writeFileSync(
      path.join(getCompanyDir(), `${userId}.json`),
      JSON.stringify(updated, null, 2)
    );

    res.json(updated);
  }
};

// POST /api/enterprise/company/bootstrap — aciona CEO manualmente
companyRouter.post('/company/bootstrap', (req: any, res: any) => {
  bootstrapCEO(req.userId).catch(() => {});
  res.json({ ok: true, message: 'CEO acionado — tarefas e contratações aparecerão em breve.' });
});

// /api/enterprise/company  (usado pelo frontend e documentado no README)
companyRouter.get('/company', handlers.get);
companyRouter.post('/company', handlers.post);
companyRouter.put('/company', handlers.put);

// /api/enterprise/  (compatibilidade com chamadas antigas)
companyRouter.get('/', handlers.get);
companyRouter.post('/', handlers.post);
companyRouter.put('/', handlers.put);

// ── DELETE /api/enterprise/reset — apaga workspace ou conta completa ────────
// query: ?mode=workspace (padrão) | account
//   workspace: apaga empresa, agentes, chats, skills, workflows, memórias
//   account:   tudo do workspace + chaves de API do usuário
companyRouter.delete('/reset', (req: any, res: any) => {
  const userId = req.userId;
  const mode = (req.query.mode as string) || 'workspace';

  const removed: string[] = [];

  function rmFile(p: string) {
    if (fs.existsSync(p)) { fs.unlinkSync(p); removed.push(p); }
  }
  function rmDir(p: string) {
    if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); removed.push(p); }
  }

  // Empresa
  rmFile(path.join(DATA_DIR, `${userId}.json`));

  // Agentes
  rmDir(dataDir('agents', userId));

  // Chats
  rmDir(dataDir('chats', userId));

  // Memórias
  rmFile(dataPath('memories', `${userId}.json`));

  // Skills
  rmDir(dataDir('skills', userId));

  // Workflows
  rmFile(dataPath('workflows', `${userId}.json`));

  // Tarefas
  rmFile(dataPath('tasks', `${userId}.json`));

  if (mode === 'account') {
    // Chaves de API
    rmFile(dataPath('keys', `${userId}.json`));
  }

  res.json({ ok: true, mode, removed: removed.length });
});