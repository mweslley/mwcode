/**
 * Chat routes — versão corrigida.
 *
 * Problemas corrigidos:
 * - Lê agentes do sistema de arquivos (enterprise-agents), não do memoryStore
 * - Aceita tanto `message` quanto `mensagem` no body
 * - Retorna `content` (não `resposta`) para consistência com o frontend
 * - Usa chaves de API por usuário (getUserKeys)
 * - Salva histórico de chats em arquivos (~/.mwcode/data/chats/{userId}/{agentId}.json)
 */
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { dataDir } from '../lib/data-dir.js';
import { getAdapter, type UserKeys } from '@mwcode/adapters';
import { getUserKeys } from './user-keys.js';
import type { AdapterName } from '@mwcode/shared';

export const chatRouter = Router();

// ── Helpers ─────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  agentId?: string;
  agentName?: string;
  timestamp: string;
}

interface ChatHistory {
  agentId: string;
  userId: string;
  messages: ChatMessage[];
  updatedAt: string;
}

function chatFile(userId: string, agentId: string): string {
  return path.join(dataDir('chats', userId), `${agentId}.json`);
}

function loadHistory(userId: string, agentId: string): ChatHistory {
  const file = chatFile(userId, agentId);
  if (!fs.existsSync(file)) return { agentId, userId, messages: [], updatedAt: new Date().toISOString() };
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch {
    return { agentId, userId, messages: [], updatedAt: new Date().toISOString() };
  }
}

function saveHistory(userId: string, history: ChatHistory): void {
  const file = chatFile(userId, history.agentId);
  history.updatedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(history, null, 2));
}

function loadAgent(userId: string, agentId: string): any | null {
  const file = path.join(dataDir('agents', userId), `${agentId}.json`);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return null; }
}

function buildContextMessages(history: ChatHistory, limit = 10): Array<{ role: string; content: string }> {
  return history.messages
    .slice(-limit)
    .map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content
    }));
}

// ── POST /api/chat/single — chat sem agente específico ───────────────────────
chatRouter.post('/single', async (req: any, res: any) => {
  try {
    const text = req.body.message || req.body.mensagem;
    if (!text) return res.status(400).json({ error: 'message é obrigatório' });

    const adapterName = (req.body.adapter as AdapterName) || (process.env.MWCODE_PROVIDER as AdapterName) || 'openrouter';
    const modelName = req.body.model || process.env.MWCODE_MODEL || 'openrouter/auto';
    const systemPrompt = req.body.system || 'Você é um assistente de IA útil. Responda sempre em português brasileiro, de forma clara e objetiva.';

    const userKeys = getUserKeys(req.userId) as UserKeys;
    const adapter = getAdapter(adapterName, modelName, userKeys);
    const result = await adapter.call(text, { system: systemPrompt });

    // Salvar no histórico do "assistente geral"
    const history = loadHistory(req.userId, 'general');
    history.messages.push(
      { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date().toISOString() },
      { id: crypto.randomUUID(), role: 'agent', content: result.content, agentName: 'Assistente Geral', timestamp: new Date().toISOString() }
    );
    saveHistory(req.userId, history);

    res.json({ content: result.content, model: result.model, usage: result.usage });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/chat/:agentId — histórico de um agente ─────────────────────────
chatRouter.get('/:agentId', async (req: any, res: any) => {
  const history = loadHistory(req.userId, req.params.agentId);
  res.json(history.messages);
});

// ── GET /api/chat/:agentId/mensagens — alias ─────────────────────────────────
chatRouter.get('/:agentId/mensagens', async (req: any, res: any) => {
  const history = loadHistory(req.userId, req.params.agentId);
  res.json(history.messages);
});

// ── POST /api/chat/:agentId — chat com agente específico ─────────────────────
chatRouter.post('/:agentId', async (req: any, res: any) => {
  try {
    const { agentId } = req.params;
    const text = req.body.message || req.body.mensagem;
    if (!text) return res.status(400).json({ error: 'message é obrigatório' });

    // Carrega agente do sistema de arquivos
    const agent = loadAgent(req.userId, agentId);
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });
    if (agent.status === 'fired') return res.status(400).json({ error: 'Este agente foi demitido' });

    // Carrega histórico para contexto
    const history = loadHistory(req.userId, agentId);

    // System prompt do agente
    const personality = agent.personality || agent.instructions || '';
    const systemPrompt = personality ||
      `Você é ${agent.name}, um agente de IA com a função de ${agent.role}. ` +
      `${agent.goals?.length ? `Seus objetivos: ${agent.goals.join(', ')}.` : ''} ` +
      `${agent.skills?.length ? `Suas habilidades: ${agent.skills.join(', ')}.` : ''} ` +
      `Responda sempre em português brasileiro de forma profissional e objetiva.`;

    // Contexto das últimas mensagens
    const contextMessages = buildContextMessages(history, 12);

    // Adaptar para suportar histórico multi-turno
    const userKeys = getUserKeys(req.userId) as UserKeys;
    const adapterName = (agent.provider || agent.adapter || 'openrouter') as AdapterName;
    const modelName = agent.model || 'openrouter/auto';
    const adapter = getAdapter(adapterName, modelName, userKeys);

    const result = await adapter.call(text, {
      system: systemPrompt,
      history: contextMessages,
    });

    // Salvar mensagens no histórico
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    const agentMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'agent',
      content: result.content,
      agentId: agent.id,
      agentName: agent.name,
      timestamp: new Date().toISOString(),
    };

    history.messages.push(userMsg, agentMsg);
    saveHistory(req.userId, history);

    res.json({ content: result.content, model: result.model, chatId: agentId });
  } catch (err: any) {
    console.error('[Chat Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/chat/:agentId — limpar histórico ─────────────────────────────
chatRouter.delete('/:agentId', async (req: any, res: any) => {
  const file = chatFile(req.userId, req.params.agentId);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  res.json({ ok: true });
});
