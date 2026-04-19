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
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
        'HTTP-Referer': config.referer || 'https://mwcode.local',
        'X-Title': config.appName || 'MWCode'
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: (context?.system as string) || 'Você é um assistente de IA em português brasileiro.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content ?? '',
      usage: data.usage,
      model: config.model
    };
  }
});
