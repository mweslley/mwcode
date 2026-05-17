/**
 * Chaves de integração com serviços externos por usuário.
 * Separado de user-keys (que guarda provedores de LLM).
 * Armazenadas em ~/.mwcode/data/integrations/{userId}.json
 */
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { dataDir } from '../lib/data-dir.js';

/** Mapeamento: nome do tool (campo tools[] da skill) → integrationId */
export const TOOL_TO_INTEGRATION: Record<string, string> = {
  'apify': 'apify',
  'elevenlabs-voiceover': 'elevenlabs',
  'elevenlabs': 'elevenlabs',
  'image-ai-generator': 'openrouter',
  'stability-image': 'stability',
  'discord-message': 'discord',
  'discord': 'discord',
  'github-issue': 'github',
  'github': 'github',
  'pterodactyl-restart': 'pterodactyl',
  'pterodactyl': 'pterodactyl',
  'openrouter': 'openrouter',
  'openai': 'openai',
  'gemini': 'gemini',
};

export const INTEGRATION_NAMES: Record<string, string> = {
  apify: 'Apify',
  elevenlabs: 'ElevenLabs',
  openrouter: 'OpenRouter',
  stability: 'Stability AI',
  discord: 'Discord',
  github: 'GitHub',
  pterodactyl: 'Pterodactyl',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  webhook: 'Webhooks',
  instagram: 'Instagram',
  ollama: 'Ollama (Local)',
};

export const INTEGRATION_FIELDS: Record<string, { key: string; label: string; type: string; placeholder: string }[]> = {
  apify:       [{ key: 'api_token', label: 'API Token', type: 'password', placeholder: 'apify_api_...' }],
  elevenlabs:  [{ key: 'api_key', label: 'API Key', type: 'password', placeholder: 'sk_...' }, { key: 'voice_id', label: 'Voice ID (opcional)', type: 'text', placeholder: 'EXAVITQu4vr4xnSDxMaL' }],
  openrouter:  [{ key: 'api_key', label: 'API Key', type: 'password', placeholder: 'sk-or-v1-...' }],
  stability:   [{ key: 'api_key', label: 'API Key', type: 'password', placeholder: 'sk-...' }],
  discord:     [{ key: 'bot_token', label: 'Bot Token', type: 'password', placeholder: 'MTxxxxxx...' }, { key: 'webhook_url', label: 'Webhook URL (opcional)', type: 'url', placeholder: 'https://discord.com/api/webhooks/...' }],
  github:      [{ key: 'token', label: 'Personal Access Token', type: 'password', placeholder: 'ghp_...' }, { key: 'repo', label: 'Repositório padrão', type: 'text', placeholder: 'usuario/repo' }],
  pterodactyl: [{ key: 'panel_url', label: 'URL do Painel', type: 'url', placeholder: 'https://host.lojamwo.com.br' }, { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'ptla_...' }],
  openai:      [{ key: 'api_key', label: 'API Key', type: 'password', placeholder: 'sk-...' }],
  gemini:      [{ key: 'api_key', label: 'API Key', type: 'password', placeholder: 'AIza...' }],
  webhook:     [{ key: 'secret', label: 'Secret (validação)', type: 'text', placeholder: 'seu-secret-aqui' }],
  instagram:   [{ key: 'access_token', label: 'Access Token', type: 'password', placeholder: 'EAA...' }, { key: 'ig_user_id', label: 'ID da conta', type: 'text', placeholder: '17841xxxxxxxxx' }],
  ollama:      [{ key: 'base_url', label: 'URL do servidor', type: 'url', placeholder: 'http://localhost:11434' }],
};

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

// GET /api/user/integrations/requirements — integrations needed by user's skills vs configured
userIntegrationsRouter.get('/requirements', (req: any, res: any) => {
  const { userId } = req;
  const configured = loadIntegrations(userId);

  const skillsDir = path.join(dataDir('skills'), userId);
  const skills: any[] = [];
  if (fs.existsSync(skillsDir)) {
    for (const file of fs.readdirSync(skillsDir).filter((f: string) => f.endsWith('.json'))) {
      try { skills.push(JSON.parse(fs.readFileSync(path.join(skillsDir, file), 'utf-8'))); } catch {}
    }
  }

  const reqMap: Record<string, { integrationId: string; integrationName: string; fields: any[]; tools: string[]; skills: string[]; configured: boolean }> = {};

  for (const skill of skills) {
    for (const tool of (skill.tools || [])) {
      const integId = TOOL_TO_INTEGRATION[tool];
      if (!integId) continue;
      if (!reqMap[integId]) {
        reqMap[integId] = {
          integrationId: integId,
          integrationName: INTEGRATION_NAMES[integId] || integId,
          fields: INTEGRATION_FIELDS[integId] || [],
          tools: [],
          skills: [],
          configured: false,
        };
      }
      if (!reqMap[integId].tools.includes(tool)) reqMap[integId].tools.push(tool);
      if (!reqMap[integId].skills.includes(skill.name)) reqMap[integId].skills.push(skill.name);
    }
  }

  for (const [integId, req] of Object.entries(reqMap)) {
    const keys = configured[integId] || {};
    const required = (INTEGRATION_FIELDS[integId] || []).filter(f => f.type === 'password');
    req.configured = required.length === 0
      ? Object.keys(keys).length > 0
      : required.some(f => keys[f.key] && keys[f.key].length > 0);
  }

  res.json(Object.values(reqMap));
});

// DELETE /api/user/integrations/:id — desconecta uma integração por completo
userIntegrationsRouter.delete('/:id', (req: any, res: any) => {
  const all = loadIntegrations(req.userId);
  delete all[req.params.id];
  fs.writeFileSync(integrationsFile(req.userId), JSON.stringify(all, null, 2));
  res.json({ ok: true });
});
