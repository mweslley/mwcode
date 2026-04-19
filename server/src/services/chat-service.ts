import { nanoid } from 'nanoid';
import type { ChatMessage, SendMessageInput, Chat } from '@mwcode/shared';
import { memoryStore } from '../store.js';
import { buildAdapter } from './failover-service.js';

export async function sendMessage(data: SendMessageInput): Promise<{ response: ChatMessage; chat: Chat }> {
  const agent = memoryStore.agents.get(data.agentId);
  if (!agent || agent.companyId !== data.companyId) {
    throw new Error('Agente não encontrado');
  }
  if (agent.status !== 'active') {
    throw new Error('Agente não está ativo');
  }

  const adapter = buildAdapter({ adapter: agent.adapter, model: agent.model });
  const result = await adapter.call(data.message, {
    system: `Você é ${agent.name}, ${agent.role}. Responda em português brasileiro. Habilidades: ${agent.skills.join(', ') || 'nenhuma'}.`,
    skills: agent.skills
  });

  const userMsg: ChatMessage = {
    role: 'user',
    content: data.message,
    timestamp: new Date()
  };
  const agentMsg: ChatMessage = {
    role: 'agent',
    content: result.content,
    timestamp: new Date(),
    agentId: data.agentId
  };

  const existing = [...memoryStore.chats.values()].find(
    c => c.agentId === data.agentId && c.userId === data.userId && c.companyId === data.companyId
  );

  let chat: Chat;
  if (existing) {
    chat = { ...existing, messages: [...existing.messages, userMsg, agentMsg] };
  } else {
    chat = {
      id: `chat_${nanoid(10)}`,
      companyId: data.companyId,
      agentId: data.agentId,
      userId: data.userId,
      messages: [userMsg, agentMsg],
      createdAt: new Date()
    };
  }
  memoryStore.chats.set(chat.id, chat);

  return { response: agentMsg, chat };
}

export async function getChatHistory(agentId: string, companyId: string, userId?: string) {
  return [...memoryStore.chats.values()].filter(c => {
    if (c.agentId !== agentId || c.companyId !== companyId) return false;
    if (userId && c.userId !== userId) return false;
    return true;
  });
}
