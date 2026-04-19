import type { Adapter, AdapterResponse } from '@mwcode/shared';

export interface OpenAIAdapterConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
}

export const createOpenAIAdapter = (config: OpenAIAdapterConfig): Adapter => ({
  name: 'openai',
  model: config.model,

  async call(prompt: string, context?: Record<string, unknown>): Promise<AdapterResponse> {
    const url = `${config.baseUrl || 'https://api.openai.com/v1'}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
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
      throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content ?? '',
      usage: data.usage,
      model: config.model
    };
  }
});
