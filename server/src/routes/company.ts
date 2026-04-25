import { Router } from 'express';
import fs from 'fs';
import path from 'path';

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

// Get company
companyRouter.get('/', (req, res) => {
  const userId = (req as any).userId;
  const company = getCompany(userId);
  if (!company) return res.status(404).json({ error: 'Empresa não encontrada' });
  res.json(company);
});

// Create/update company
companyRouter.post('/', (req, res) => {
  const userId = (req as any).userId;
  const { name, area, mission, employees, goals } = req.body;
  
  const company: Company = {
    id: crypto.randomUUID(),
    userId,
    name: name || '',
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
});

// Update company
companyRouter.put('/', (req, res) => {
  const userId = (req as any).userId;
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
});