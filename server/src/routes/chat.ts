import { Router } from 'express';
import { validateSendMessage } from '@mwcode/shared';
import { sendMessage, getChatHistory } from '../services/chat-service.js';
import { buildAdapter } from '../services/failover-service.js';
import type { AdapterName } from '@mwcode/shared';

export const chatRouter = Router();

// Modo Single — chat direto com provedor + modelo (sem agente cadastrado)
chatRouter.post('/single', async (req, res) => {
  try {
    const { mensagem, adapter, model } = req.body;
    if (!mensagem) return res.status(400).json({ error: 'mensagem obrigatória' });
    const adapterName = (adapter as AdapterName) || (process.env.MWCODE_PROVIDER as AdapterName) || 'openrouter';
    const modelName = model || process.env.MWCODE_MODEL || 'openrouter/auto';

    const instance = buildAdapter({ adapter: adapterName, model: modelName });
    const result = await instance.call(mensagem);
    res.json({ resposta: result.content, modelo: result.model, uso: result.usage });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Modo Enterprise — chat com agente específico
chatRouter.post('/:agentId', async (req, res) => {
  try {
    const companyId = req.companyId || 'default';
    const userId = (req as any).userId || 'user-default';
    const data = validateSendMessage({
      agentId: req.params.agentId,
      companyId,
      userId,
      message: req.body.mensagem || req.body.message
    });
    const result = await sendMessage(data);
    res.json({
      resposta: result.response.content,
      chatId: result.chat.id
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

chatRouter.get('/:agentId', async (req, res) => {
  const companyId = req.companyId || 'default';
  const history = await getChatHistory(req.params.agentId, companyId);
  res.json(history);
});

chatRouter.get('/:agentId/mensagens', async (req, res) => {
  const companyId = req.companyId || 'default';
  const history = await getChatHistory(req.params.agentId, companyId);
  const messages = history.flatMap(h => h.messages);
  res.json(messages);
});
