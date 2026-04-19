import { Router } from 'express';
import { nanoid } from 'nanoid';
import { validateCreateCompany } from '@mwcode/shared';
import type { Company } from '@mwcode/shared';
import { memoryStore } from '../store.js';

export const companiesRouter = Router();

companiesRouter.get('/', (_req, res) => {
  res.json([...memoryStore.companies.values()]);
});

companiesRouter.post('/', (req, res) => {
  try {
    const data = validateCreateCompany(req.body);
    const company: Company = {
      id: `emp_${nanoid(10)}`,
      name: data.name,
      plan: data.plan ?? 'free',
      budget: data.budget ?? 0,
      spent: 0,
      createdAt: new Date()
    };
    memoryStore.companies.set(company.id, company);
    res.status(201).json(company);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

companiesRouter.get('/:id', (req, res) => {
  const company = memoryStore.companies.get(req.params.id);
  if (!company) return res.status(404).json({ error: 'Empresa não encontrada' });
  res.json(company);
});

companiesRouter.put('/:id', (req, res) => {
  const existing = memoryStore.companies.get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Empresa não encontrada' });
  const updated = { ...existing, ...req.body, id: existing.id };
  memoryStore.companies.set(existing.id, updated);
  res.json(updated);
});
