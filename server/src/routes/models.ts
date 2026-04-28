/**
 * /api/models — proxy para buscar modelos reais de cada provider
 * usando a chave de API do próprio usuário.
 */
import { Router } from 'express';
import { getUserKeys } from './user-keys.js';

export const modelsRouter = Router();

// GET /api/models/validate?provider=openrouter — testa se a chave é válida
modelsRouter.get('/validate', async (req: any, res: any) => {
  const provider = (req.query.provider as string) || 'openrouter';
  const userKeys = getUserKeys(req.userId);

  const key = (userKeys as any)[provider] || (process.env as any)[`${provider.toUpperCase()}_API_KEY`];
  if (!key) return res.json({ valid: false, error: 'Chave não configurada' });

  try {
    if (provider === 'openrouter') {
      const r = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!r.ok) return res.json({ valid: false, error: `OpenRouter retornou ${r.status}` });
      const data = await r.json() as any;
      return res.json({ valid: true, label: data.data?.label, credits: data.data?.limit_remaining });
    }

    if (provider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      });
      return res.json({ valid: r.ok, error: r.ok ? undefined : `OpenAI retornou ${r.status}` });
    }

    if (provider === 'gemini') {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
      );
      return res.json({ valid: r.ok, error: r.ok ? undefined : `Gemini retornou ${r.status}` });
    }

    if (provider === 'deepseek') {
      const r = await fetch('https://api.deepseek.com/models', {
        headers: { Authorization: `Bearer ${key}` },
      });
      return res.json({ valid: r.ok, error: r.ok ? undefined : `DeepSeek retornou ${r.status}` });
    }

    return res.json({ valid: true, note: 'Validação não implementada para este provider' });
  } catch (e: any) {
    return res.json({ valid: false, error: e.message });
  }
});

// GET /api/models/list?provider=openrouter — retorna modelos reais do provider
modelsRouter.get('/list', async (req: any, res: any) => {
  const provider = (req.query.provider as string) || 'openrouter';
  const userKeys = getUserKeys(req.userId);
  const key = (userKeys as any)[provider] || (process.env as any)[`${provider.toUpperCase()}_API_KEY`];

  try {
    if (provider === 'openrouter') {
      if (!key) return res.json([]);
      const r = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!r.ok) return res.json([]);
      const data = await r.json() as any;
      const models = (data.data || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        contextLength: m.context_length,
        pricing: m.pricing,
        free: !m.pricing?.prompt || parseFloat(m.pricing.prompt) === 0,
      })).sort((a: any, b: any) => (a.free === b.free ? 0 : a.free ? -1 : 1));
      return res.json(models);
    }

    if (provider === 'openai') {
      if (!key) return res.json([]);
      const r = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!r.ok) return res.json([]);
      const data = await r.json() as any;
      const models = (data.data || [])
        .filter((m: any) => m.id.includes('gpt'))
        .map((m: any) => ({ id: m.id, name: m.id, free: false }));
      return res.json(models);
    }

    if (provider === 'gemini') {
      if (!key) return res.json([]);
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
      );
      if (!r.ok) return res.json([]);
      const data = await r.json() as any;
      const models = (data.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => ({
          id: m.name.replace('models/', ''),
          name: m.displayName || m.name,
          description: m.description,
          free: true,
        }));
      return res.json(models);
    }

    return res.json([]);
  } catch {
    return res.json([]);
  }
});
