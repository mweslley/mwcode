import type { Adapter, AdapterResponse } from '@mwcode/shared';

export interface GeminiConfig {
  apiKey: string;
  model: string;
}

export const createGeminiAdapter = (config: GeminiConfig): Adapter => ({
  name: 'gemini',
  model: config.model,

  async call(prompt: string, context?: Record<string, unknown>): Promise<AdapterResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
    const system = (context?.system as string) || 'Você é um assistente de IA em português brasileiro.';

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${system}\n\n${prompt}` }] }],
        generationConfig: { temperature: 0.7 }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return {
      content,
      usage: data.usageMetadata,
      model: config.model
    };
  }
});
