import type { Adapter, AdapterResponse } from '@mwcode/shared';

export interface GitHubModelsConfig {
  token: string;
  model: string;
}

export const createGitHubAdapter = (config: GitHubModelsConfig): Adapter => ({
  name: 'github',
  model: config.model,

  async call(prompt: string, context?: Record<string, unknown>): Promise<AdapterResponse> {
    const response = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.token}`
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
      throw new Error(`GitHub Models ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    return {
      content: data.choices?.[0]?.message?.content ?? '',
      usage: data.usage,
      model: config.model
    };
  }
});
