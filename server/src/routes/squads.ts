import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { dataDir } from '../lib/data-dir.js';

export interface Squad {
  id: string;
  name: string;
  description: string;
  mission: string;
  agentIds: string[];
  leaderId?: string;
  status: 'active' | 'paused' | 'completed';
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

function getSquadsDir(companyId: string): string {
  return dataDir('squads', companyId);
}

function getSquads(companyId: string): Squad[] {
  const dir = getSquadsDir(companyId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function saveSquad(companyId: string, squad: Squad): void {
  const dir = getSquadsDir(companyId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${squad.id}.json`), JSON.stringify(squad, null, 2));
}

export const squadsRouter = Router();

squadsRouter.get('/', (req, res) => {
  const companyId = (req as any).companyId || 'default';
  res.json(getSquads(companyId));
});

squadsRouter.post('/', (req, res) => {
  const companyId = (req as any).companyId || 'default';
  const { name, description, mission, agentIds, status } = req.body;
  if (!name) return res.status(400).json({ error: 'name é obrigatório' });
  const { leaderId } = req.body;
  const squad: Squad = {
    id: crypto.randomUUID(),
    name,
    description: description || '',
    mission: mission || '',
    agentIds: agentIds || [],
    leaderId: leaderId || '',
    status: status || 'active',
    companyId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveSquad(companyId, squad);
  res.status(201).json(squad);
});

squadsRouter.put('/:id', (req, res) => {
  const companyId = (req as any).companyId || 'default';
  const squads = getSquads(companyId);
  const squad = squads.find(s => s.id === req.params.id);
  if (!squad) return res.status(404).json({ error: 'Squad não encontrado' });
  const updated: Squad = {
    ...squad,
    ...req.body,
    id: squad.id,
    companyId,
    createdAt: squad.createdAt,
    updatedAt: new Date().toISOString(),
  };
  saveSquad(companyId, updated);
  res.json(updated);
});

squadsRouter.delete('/:id', (req, res) => {
  const companyId = (req as any).companyId || 'default';
  const dir = getSquadsDir(companyId);
  const file = path.join(dir, `${req.params.id}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Squad não encontrado' });
  fs.unlinkSync(file);
  res.json({ ok: true });
});
