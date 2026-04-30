/**
 * GET /api/feed — feed unificado de todas as conversas da empresa
 * Agrega mensagens de todos os agentes do usuário, ordenadas por timestamp.
 * Usado pela página "Feed ao Vivo" no estilo Paperclip.
 *
 * Query params:
 *   since=ISO_timestamp  — retorna só mensagens mais novas que esse timestamp
 *   limit=number         — máximo de mensagens (padrão 100)
 */
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { dataDir } from '../lib/data-dir.js';

export const feedRouter = Router();

interface FeedMessage {
  id: string;
  agentId: string;
  agentName: string;
  agentRole: string;
  agentEmoji: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
}

function agentEmoji(role: string): string {
  const r = (role || '').toLowerCase();
  if (r.includes('ceo') || r.includes('diretor')) return '👔';
  if (r.includes('dev') || r.includes('código') || r.includes('eng')) return '💻';
  if (r.includes('market') || r.includes('copy')) return '📣';
  if (r.includes('support') || r.includes('suporte')) return '🎧';
  if (r.includes('design')) return '🎨';
  if (r.includes('data') || r.includes('dados')) return '📊';
  if (r.includes('financ')) return '💰';
  return '🤖';
}

feedRouter.get('/', (req: any, res: any) => {
  const userId = req.userId;
  const since = req.query.since as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const sinceDate = since ? new Date(since).getTime() : 0;

  const messages: FeedMessage[] = [];

  try {
    // Carrega todos os agentes para pegar nome/role
    const agentsDir = dataDir('agents', userId);
    const agentMap = new Map<string, { name: string; role: string }>();

    if (fs.existsSync(agentsDir)) {
      for (const f of fs.readdirSync(agentsDir).filter(f => f.endsWith('.json'))) {
        try {
          const agent = JSON.parse(fs.readFileSync(path.join(agentsDir, f), 'utf-8'));
          agentMap.set(agent.id, { name: agent.name, role: agent.role });
        } catch {}
      }
    }

    // Carrega todos os chats
    const chatsDir = dataDir('chats', userId);
    if (fs.existsSync(chatsDir)) {
      for (const f of fs.readdirSync(chatsDir).filter(f => f.endsWith('.json'))) {
        try {
          const history = JSON.parse(fs.readFileSync(path.join(chatsDir, f), 'utf-8'));
          const agentId = history.agentId || f.replace('.json', '');
          const agentInfo = agentMap.get(agentId);
          const agentName = agentInfo?.name || (agentId === 'general' ? 'Assistente Geral' : 'Agente');
          const agentRole = agentInfo?.role || '';

          for (const msg of (history.messages || [])) {
            if (sinceDate && new Date(msg.timestamp).getTime() <= sinceDate) continue;
            messages.push({
              id: msg.id,
              agentId,
              agentName: msg.agentName || agentName,
              agentRole,
              agentEmoji: agentEmoji(agentRole),
              role: msg.role,
              content: msg.content,
              timestamp: msg.timestamp,
            });
          }
        } catch {}
      }
    }
  } catch {}

  // Ordena mais recente primeiro, limita
  messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  res.json(messages.slice(0, limit));
});

// GET /api/feed/agents — lista agentes que têm conversas (para filtros)
feedRouter.get('/agents', (req: any, res: any) => {
  const userId = req.userId;
  const result: Array<{ id: string; name: string; role: string; emoji: string; messageCount: number; lastActivity: string }> = [];

  try {
    const agentsDir = dataDir('agents', userId);
    const chatsDir = dataDir('chats', userId);

    const agentMap = new Map<string, { name: string; role: string }>();
    if (fs.existsSync(agentsDir)) {
      for (const f of fs.readdirSync(agentsDir).filter(f => f.endsWith('.json'))) {
        try {
          const agent = JSON.parse(fs.readFileSync(path.join(agentsDir, f), 'utf-8'));
          agentMap.set(agent.id, { name: agent.name, role: agent.role });
        } catch {}
      }
    }

    if (fs.existsSync(chatsDir)) {
      for (const f of fs.readdirSync(chatsDir).filter(f => f.endsWith('.json'))) {
        try {
          const history = JSON.parse(fs.readFileSync(path.join(chatsDir, f), 'utf-8'));
          const agentId = history.agentId || f.replace('.json', '');
          if (!history.messages?.length) continue;
          const agentInfo = agentMap.get(agentId);
          const agentName = agentInfo?.name || (agentId === 'general' ? 'Assistente Geral' : 'Agente');
          const agentRole = agentInfo?.role || '';
          const lastMsg = history.messages[history.messages.length - 1];
          result.push({
            id: agentId,
            name: agentName,
            role: agentRole,
            emoji: agentEmoji(agentRole),
            messageCount: history.messages.length,
            lastActivity: lastMsg?.timestamp || history.updatedAt,
          });
        } catch {}
      }
    }
  } catch {}

  result.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());
  res.json(result);
});
