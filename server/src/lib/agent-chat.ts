import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { dataDir } from './data-dir.js';
import { getAdapter, type UserKeys } from '@mwcode/adapters';
import { getUserKeys } from '../routes/user-keys.js';
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

  const systemPrompt =
    agent.personality || agent.instructions ||
    `Você é ${agent.name}, um agente de IA com a função de ${agent.role}. Responda sempre em português brasileiro.`;

  const userKeys = getUserKeys(userId) as UserKeys;
  const adapterName = (agent.provider || agent.adapter || 'openrouter') as AdapterName;
  const modelName = agent.model || 'openrouter/auto';
  const adapter = getAdapter(adapterName, modelName, userKeys);

  const result = await adapter.call(text, { system: systemPrompt, history: contextMessages });

  // ── Record token usage ────────────────────────────────────────────────────
  const usage = result.usage;
  if (usage?.total_tokens) {
    recordUsage(userId, {
      agentId: agent.id,
      agentName: agent.name,
      model: result.model || modelName,
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
