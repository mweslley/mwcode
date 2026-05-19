import type { Adapter, AdapterResponse } from '@mwcode/shared';

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  appName?: string;
  referer?: string;
}

export const createOpenRouterAdapter = (config: OpenRouterConfig): Adapter => ({
  name: 'openrouter',
  model: config.model,

  async call(prompt: string, context?: Record<string, unknown>): Promise<AdapterResponse> {
    const systemMsg = (context?.system as string) || 'Você é um assistente de IA em português brasileiro.';
    const history = (context?.history as Array<{ role: string; content: string }>) || [];
    const images = (context?.images as string[]) || [];

    // Build last user content — support images (vision models)
    const lastUserContent: unknown = images.length > 0
      ? [
          { type: 'text', text: prompt },
          ...images.map(url => ({ type: 'image_url', image_url: { url } })),
        ]
      : prompt;

    const messages = [
      { role: 'system', content: systemMsg },
      ...history.map(m => ({ role: m.role === 'agent' ? 'assistant' : m.role, content: m.content })),
      { role: 'user', content: lastUserContent },
    ];

    // 'openrouter/auto' não é um model ID real do OpenRouter — usa modelo gratuito padrão.
    // Quando há imagens, o modelo precisa suportar visão — usamos um que suporta.
    const resolvedModel = config.model === 'openrouter/auto'
      ? (images.length > 0 ? 'meta-llama/llama-4-scout:free' : 'nvidia/nemotron-3-super-120b-a12b:free')
      : config.model;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180_000); // 3min — respostas longas precisam de mais tempo

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'HTTP-Referer': config.referer || 'https://mwcode.local',
        'X-Title': config.appName || 'MWCode'
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages,
        temperature: 0.7,
        max_tokens: 8000,
      })
    });
    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`OpenRouter ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const finishReason = choice?.finish_reason;
    if (finishReason === 'length') {
      console.warn(`[openrouter] Resposta truncada pelo limite de tokens (model=${resolvedModel}). Considere aumentar max_tokens ou reduzir o prompt.`);
    }
    return {
      content: choice?.message?.content ?? '',
      usage: data.usage,
      model: config.model
    };
  }
});
