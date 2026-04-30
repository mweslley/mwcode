import { Router } from 'express';
import { loadUsage, saveLimits, loadLimits } from '../lib/usage-tracker.js';
import fs from 'fs';
import { dataPath } from '../lib/data-dir.js';

export const usageRouter = Router();

// GET /api/usage — resumo completo
usageRouter.get('/', (req: any, res: any) => {
  const data = loadUsage(req.userId);
  res.json(data);
});

// GET /api/usage/log — apenas o log recente
usageRouter.get('/log', (req: any, res: any) => {
  const data = loadUsage(req.userId);
  const limit = Math.min(Number(req.query.limit || 100), 500);
  res.json(data.log.slice(-limit).reverse());
});

// DELETE /api/usage/reset — zera estatísticas
usageRouter.delete('/reset', (req: any, res: any) => {
  const file = dataPath('usage', `${req.userId}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ ok: true });
});

// GET /api/usage/limits — retorna limites configurados
usageRouter.get('/limits', (req: any, res: any) => {
  res.json(loadLimits(req.userId));
});

// PUT /api/usage/limits — salva limites
usageRouter.put('/limits', (req: any, res: any) => {
  const { global: g, byAgent } = req.body;
  const limits: any = {};
  if (g) {
    limits.global = {};
    if (g.dailyUsd !== undefined) limits.global.dailyUsd = Number(g.dailyUsd) || 0;
    if (g.monthlyUsd !== undefined) limits.global.monthlyUsd = Number(g.monthlyUsd) || 0;
  }
  if (byAgent) limits.byAgent = byAgent;
  saveLimits(req.userId, limits);
  res.json(limits);
});
