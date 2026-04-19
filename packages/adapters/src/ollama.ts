import type { Adapter, AdapterResponse } from '@mwcode/shared';

export interface OllamaConfig {
  baseUrl?: string;
  model: string;
}

export const createOllamaAdapter = (config: OllamaConfig): Adapter => ({
  name: 'ollama',
  model: config.model,

  async call(prompt: string, context?: Record<string, unknown>): Promise<AdapterResponse> {
    const baseUrl = config.baseUrl || 'http://localhost:11434';
    const system = (context?.system as string) || 'Você é um assistente de IA em português brasileiro.';

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt }
        ],
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return {
      content: data.message?.content ?? '',
      model: config.model
    };
  }
});
