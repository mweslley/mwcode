import type { Adapter, AdapterName } from '@mwcode/shared';
import { createOpenAIAdapter } from './openai.js';
import { createOpenRouterAdapter } from './openrouter.js';
import { createGeminiAdapter } from './gemini.js';
import { createOllamaAdapter } from './ollama.js';
import { createApiAdapter } from './api.js';
import { createGitHubAdapter } from './github.js';

/**
 * Chaves por usuário — sobrepõem as variáveis de ambiente do servidor.
 * Permite que cada usuário use sua própria API key.
 */
export interface UserKeys {
  openrouter?: string;
  openai?: string;
  gemini?: string;
  deepseek?: string;
  github?: string;
  ollama_url?: string;
}

function key(envVar: string | undefined, userKey?: string, label?: string): string {
  const k = userKey || envVar;
  if (!k || k.trim() === '') {
    throw new Error(`API key não configurada: ${label || envVar}. Configure em Configurações → Chaves de API.`);
  }
  return k;
}

export function getAdapter(name: AdapterName, model: string, userKeys?: UserKeys): Adapter {
  switch (name) {
    case 'openai':
      return createOpenAIAdapter({
        apiKey: key(process.env.OPENAI_API_KEY, userKeys?.openai, 'OPENAI_API_KEY'),
        model
      });
    case 'openrouter':
      return createOpenRouterAdapter({
        apiKey: key(process.env.OPENROUTER_API_KEY, userKeys?.openrouter, 'OPENROUTER_API_KEY'),
        model
      });
    case 'gemini':
      return createGeminiAdapter({
        apiKey: key(process.env.GEMINI_API_KEY, userKeys?.gemini, 'GEMINI_API_KEY'),
        model
      });
    case 'ollama':
      return createOllamaAdapter({
        baseUrl: userKeys?.ollama_url || process.env.OLLAMA_BASE_URL,
        model
      });
    case 'api':
      return createApiAdapter({
        apiKey: key(process.env.MWCODE_API_KEY, undefined, 'MWCODE_API_KEY'),
        baseUrl: process.env.MWCODE_API_BASE_URL || '',
        model
      });
    case 'github':
      return createGitHubAdapter({
        token: key(process.env.GITHUB_TOKEN, userKeys?.github, 'GITHUB_TOKEN'),
        model
      });
    case 'deepseek':
      return createOpenAIAdapter({
        apiKey: key(process.env.DEEPSEEK_API_KEY, userKeys?.deepseek, 'DEEPSEEK_API_KEY'),
        baseUrl: 'https://api.deepseek.com/v1',
        model
      });
    default:
      throw new Error(`Adapter desconhecido: ${name}`);
  }
}
