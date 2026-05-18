import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { dataDir } from './data-dir.js';
import { getAdapter, type UserKeys } from '@mwcode/adapters';
import { getUserKeys } from '../routes/user-keys.js';
import { getUserIntegrations, TOOL_TO_INTEGRATION } from '../routes/user-integrations.js';
import type { AdapterName } from '@mwcode/shared';
import { recordUsage, checkLimits } from './usage-tracker.js';

export interface AgentChatResult {
  content: string;
  agentName: string;
  agentId: string;
}

export function loadAgentFile(userId: string, agentId: string): any | null {
  const file = path.join(dataDir('agents', userId), `${agentId}.json`);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return null; }
}

export function loadChatHistory(userId: string, agentId: string): any {
  const file = path.join(dataDir('chats', userId), `${agentId}.json`);
  if (!fs.existsSync(file)) return { agentId, userId, messages: [], updatedAt: new Date().toISOString() };
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch { return { agentId, userId, messages: [], updatedAt: new Date().toISOString() }; }
}

export function saveChatHistory(userId: string, history: any): void {
  const file = path.join(dataDir('chats', userId), `${history.agentId}.json`);
  history.updatedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(history, null, 2));
}

export async function sendMessageToAgent(
  userId: string,
  agentId: string,
  text: string,
  opts?: { source?: string }
): Promise<string> {
  const agent = loadAgentFile(userId, agentId);
  if (!agent || agent.status === 'fired') throw new Error('Agente não disponível');

  // ── Check spending limits ─────────────────────────────────────────────────
  const limitCheck = checkLimits(userId, agentId);
  if (limitCheck.blocked) {
    throw new Error(`Limite de gastos: ${limitCheck.reason}`);
  }

  const history = loadChatHistory(userId, agentId);
  const contextMessages = history.messages.slice(-12).map((m: any) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));

  const basePrompt =
    agent.personality || agent.instructions ||
    `Você é ${agent.name}, um agente de IA com a função de ${agent.role}. Responda sempre em português brasileiro.`;

  // Injetar apenas as credenciais das integrações que as skills do agente realmente precisam
  let systemPrompt = basePrompt;
  const agentSkillNames: string[] = agent.skills || [];
  if (agentSkillNames.length > 0) {
    const integrations = getUserIntegrations(userId);
    const skillsDir = path.join(dataDir('skills'), userId);
    const allSkills: any[] = fs.existsSync(skillsDir)
      ? fs.readdirSync(skillsDir)
          .filter(f => f.endsWith('.json'))
          .map(f => { try { return JSON.parse(fs.readFileSync(path.join(skillsDir, f), 'utf-8')); } catch { return null; } })
          .filter(Boolean)
      : [];
    const nameSet = new Set(agentSkillNames.map(s => s.toLowerCase()));
    const agentSkills = allSkills.filter(s => nameSet.has((s.name || '').toLowerCase()));
    const neededIntegIds = new Set<string>();
    for (const skill of agentSkills) {
      for (const tool of (skill.tools || [])) {
        const integId = TOOL_TO_INTEGRATION[tool as string];
        if (integId) neededIntegIds.add(integId);
      }
    }
    const relevantEntries = Object.entries(integrations).filter(([id, fields]) =>
      neededIntegIds.has(id) && Object.values(fields).some(v => v && typeof v === 'string')
    );
    if (relevantEntries.length > 0) {
      systemPrompt = basePrompt + '\n\n## Credenciais de integrações disponíveis\n' +
        'Use essas chaves quando precisar executar tarefas com as APIs correspondentes:\n' +
        relevantEntries.map(([id, fields]) => {
          const fieldStr = Object.entries(fields)
            .filter(([, v]) => v && typeof v === 'string')
            .map(([k, v]) => `  ${k}: ${v}`)
            .join('\n');
          return `${id}:\n${fieldStr}`;
        }).join('\n');
    }
  }

  const userKeys = getUserKeys(userId) as UserKeys;
  const adapterName = (agent.provider || agent.adapter || 'openrouter') as AdapterName;
  const primaryModel = agent.model || 'openrouter/auto';

  // Modelos de fallback — acionados se o principal der 429 ou 404
  const FREE_FALLBACKS = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'deepseek/deepseek-v4-flash:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'google/gemma-4-31b-it:free',
    'qwen/qwen3-235b-a22b:free',
    'qwen/qwen3-30b-a3b:free',
    'google/gemma-3-27b-it:free',
    'mistralai/mistral-7b-instruct:free',
    'microsoft/phi-4-reasoning-plus:free',
  ].filter(m => m !== primaryModel);

  const modelsToTry = [primaryModel, ...FREE_FALLBACKS];

  let result: any;
  let modelName = primaryModel;
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  // Até 3 tentativas com pausa quando todos os modelos estão com 429
  for (let attempt = 0; attempt < 3; attempt++) {
    let allRateLimited = true;
    for (const model of modelsToTry) {
      try {
        const adapter = getAdapter(adapterName, model, userKeys);
        result = await adapter.call(text, { system: systemPrompt, history: contextMessages });
        modelName = model;
        allRateLimited = false;
        break;
      } catch (e: any) {
        const msg = e?.message || '';
        const isRate = msg.includes('429') || msg.includes('rate-limit');
        const isNotFound = msg.includes('404') || msg.includes('No endpoints');
        if (isRate) {
          console.warn(`[agent-chat] Modelo ${model} com 429, tentando próximo...`);
          continue;
        }
        if (isNotFound && model !== modelsToTry[modelsToTry.length - 1]) {
          console.warn(`[agent-chat] Modelo ${model} não encontrado (${msg.slice(0, 60)}), tentando fallback...`);
          continue;
        }
        allRateLimited = false;
        throw e;
      }
    }
    if (!allRateLimited) break;
    if (attempt < 2) {
      const waitSec = (attempt + 1) * 20;
      console.warn(`[agent-chat] Todos os modelos com 429 (tentativa ${attempt + 1}/3). Aguardando ${waitSec}s...`);
      await sleep(waitSec * 1000);
    } else {
      throw new Error('Todos os modelos atingiram o limite de taxa (429). Tente novamente em alguns minutos.');
    }
  }

  // ── Persist actual model used (resolves openrouter/auto → real model) ────
  const actualModel = result.model || modelName;
  if (actualModel && actualModel !== modelName) {
    try {
      const agentFile = path.join(dataDir('agents', userId), `${agent.id}.json`);
      const fresh = JSON.parse(fs.readFileSync(agentFile, 'utf-8'));
      fresh.lastUsedModel = actualModel;
      fs.writeFileSync(agentFile, JSON.stringify(fresh, null, 2));
    } catch {}
  }

  // ── Record token usage ────────────────────────────────────────────────────
  const usage = result.usage;
  if (usage?.total_tokens) {
    recordUsage(userId, {
      agentId: agent.id,
      agentName: agent.name,
      model: actualModel,
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens,
      source: opts?.source,
    });
  }

  history.messages.push(
    {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      ...(opts?.source ? { agentName: opts.source } : {}),
    },
    {
      id: crypto.randomUUID(),
      role: 'agent',
      content: result.content,
      agentId: agent.id,
      agentName: agent.name,
      timestamp: new Date().toISOString(),
    }
  );
  saveChatHistory(userId, history);

  return result.content;
}
