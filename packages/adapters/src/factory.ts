import type { Adapter, AdapterName } from '@mwcode/shared';
import { createOpenAIAdapter } from './openai.js';
import { createOpenRouterAdapter } from './openrouter.js';
import { createGeminiAdapter } from './gemini.js';
import { createOllamaAdapter } from './ollama.js';
import { createApiAdapter } from './api.js';
import { createGitHubAdapter } from './github.js';

export function getAdapter(name: AdapterName, model: string): Adapter {
  switch (name) {
    case 'openai':
      return createOpenAIAdapter({
        apiKey: process.env.OPENAI_API_KEY || '',
        model
      });
    case 'openrouter':
      return createOpenRouterAdapter({
        apiKey: process.env.OPENROUTER_API_KEY || '',
        model
      });
    case 'gemini':
      return createGeminiAdapter({
        apiKey: process.env.GEMINI_API_KEY || '',
        model
      });
    case 'ollama':
      return createOllamaAdapter({
        baseUrl: process.env.OLLAMA_BASE_URL,
        model
      });
    case 'api':
      return createApiAdapter({
        apiKey: process.env.MWCODE_API_KEY || '',
        baseUrl: process.env.MWCODE_API_BASE_URL || '',
        model
      });
    case 'github':
      return createGitHubAdapter({
        token: process.env.GITHUB_TOKEN || '',
        model
      });
    case 'deepseek':
      return createOpenAIAdapter({
        apiKey: process.env.DEEPSEEK_API_KEY || '',
        baseUrl: 'https://api.deepseek.com/v1',
        model
      });
    default:
      throw new Error(`Adapter desconhecido: ${name}`);
  }
}
