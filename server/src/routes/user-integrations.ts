/**
 * Chaves de integração com serviços externos por usuário.
 * Separado de user-keys (que guarda provedores de LLM).
 * Armazenadas em ~/.mwcode/data/integrations/{userId}.json
 */
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { dataDir } from '../lib/data-dir.js';

export const userIntegrationsRouter = Router();

export interface IntegrationKeys {
  [integrationId: string]: Record<string, string>;
}

function integrationsFile(userId: string): string {
  return path.join(dataDir('integrations'), `${userId}.json`);
}

function loadIntegrations(userId: string): IntegrationKeys {
  const file = integrationsFile(userId);
  if (!fs.existsSync(file)) return {};
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return {}; }
}

/** Carrega chaves de integração de um usuário (para uso interno nos tools). */
export function getUserIntegrations(userId: string): IntegrationKeys {
  return loadIntegrations(userId);
}

/** Retorna uma chave específica de uma integração. */
export function getIntegrationKey(userId: string, integrationId: string, field: string): string {
  const all = loadIntegrations(userId);
  return all[integrationId]?.[field] || '';
}

// GET /api/user/integrations — retorna integrations com campos mascarados
userIntegrationsRouter.get('/', (req: any, res: any) => {
  const all = loadIntegrations(req.userId);
  const masked: IntegrationKeys = {};
  for (const [id, fields] of Object.entries(all)) {
    masked[id] = {};
    for (const [k, v] of Object.entries(fields)) {
      if (typeof v === 'string' && v.length > 0) {
        // Máscarar valor — exceto campos não sensíveis (url, id, repo)
        const isPublic = k.includes('url') || k.includes('_id') || k.includes('repo') || k.includes('voice_id');
        masked[id][k] = isPublic ? v : '••••••••' + v.slice(-4);
      }
    }
  }
  res.json(masked);
});

// PUT /api/user/integrations/:id — salva campos de uma integração
userIntegrationsRouter.put('/:id', (req: any, res: any) => {
  const { id } = req.params;
  const all = loadIntegrations(req.userId);
  if (!all[id]) all[id] = {};

  for (const [field, value] of Object.entries(req.body)) {
    if (typeof value !== 'string') continue;
    if (value === '') {
      delete all[id][field];
    } else {
      all[id][field] = value;
    }
  }

  // Remove integração se ficou vazia
  if (Object.keys(all[id]).length === 0) {
    delete all[id];
  }

  fs.writeFileSync(integrationsFile(req.userId), JSON.stringify(all, null, 2));
  res.json({ ok: true });
});

// DELETE /api/user/integrations/:id — desconecta uma integração por completo
userIntegrationsRouter.delete('/:id', (req: any, res: any) => {
  const all = loadIntegrations(req.userId);
  delete all[req.params.id];
  fs.writeFileSync(integrationsFile(req.userId), JSON.stringify(all, null, 2));
  res.json({ ok: true });
});
