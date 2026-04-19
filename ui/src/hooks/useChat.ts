import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Msg {
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp?: string;
}

export function useChat(agentId?: string) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!agentId) return;
    api.chatHistory(agentId).then(history => {
      const flat: Msg[] = history.flatMap((h: any) => h.messages || []);
      setMessages(flat);
    }).catch(() => setMessages([]));
  }, [agentId]);

  const send = useCallback(async (text: string) => {
    if (!agentId || !text.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);
    try {
      const res = await api.sendChat(agentId, text);
      setMessages(prev => [...prev, { role: 'agent', content: res.resposta }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'system', content: `Erro: ${(err as Error).message}` }]);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  const sendSingle = useCallback(async (text: string, provider: string, model: string) => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);
    try {
      const res = await api.sendChatSingle({ mensagem: text, adapter: provider, model });
      setMessages(prev => [...prev, { role: 'agent', content: res.resposta }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'system', content: `Erro: ${(err as Error).message}` }]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { messages, loading, send, sendSingle };
}
