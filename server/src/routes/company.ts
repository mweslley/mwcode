import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMPANY_DIR = path.resolve(__dirname, '../../../data');

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

// /api/enterprise/company  (usado pelo frontend e documentado no README)
companyRouter.get('/company', handlers.get);
companyRouter.post('/company', handlers.post);
companyRouter.put('/company', handlers.put);

// /api/enterprise/  (compatibilidade com chamadas antigas)
companyRouter.get('/', handlers.get);
companyRouter.post('/', handlers.post);
companyRouter.put('/', handlers.put);