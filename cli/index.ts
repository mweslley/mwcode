#!/usr/bin/env node
import readline from 'node:readline';
import dotenv from 'dotenv';
import { createOpenRouterAdapter } from '../packages/adapters/src/openrouter.js';
import { createOpenAIAdapter } from '../packages/adapters/src/openai.js';
import { createGeminiAdapter } from '../packages/adapters/src/gemini.js';
import { createOllamaAdapter } from '../packages/adapters/src/ollama.js';
import { createFailoverAdapter } from '../packages/adapters/src/failover.js';
import type { Adapter } from '../packages/shared/src/types/agent.js';

dotenv.config();

const provider = process.env.MWCODE_PROVIDER || 'openrouter';
const model = process.env.MWCODE_MODEL || 'openrouter/auto';

function buildAdapter(): Adapter {
  switch (provider) {
    case 'openai':
      return createOpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY || '', model });
    case 'gemini':
      return createGeminiAdapter({ apiKey: process.env.GEMINI_API_KEY || '', model });
    case 'ollama':
      return createOllamaAdapter({ baseUrl: process.env.OLLAMA_BASE_URL, model });
    case 'openrouter':
    default:
      return createOpenRouterAdapter({ apiKey: process.env.OPENROUTER_API_KEY || '', model });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const adapter = buildAdapter();

  // Comando único
  if (args.length > 0 && args[0] !== 'chat') {
    const prompt = args.join(' ');
    const result = await adapter.call(prompt);
    console.log(result.content);
    return;
  }

  // Modo interativo
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(`🤖 MWCode CLI — ${provider}/${model}`);
  console.log(`Digite "/sair" para encerrar.\n`);

  const ask = () => {
    rl.question('> ', async (input) => {
      if (input === '/sair' || input === '/exit') {
        rl.close();
        return;
      }
      if (!input.trim()) return ask();
      try {
        const res = await adapter.call(input);
        console.log(`\n${res.content}\n`);
      } catch (err) {
        console.error(`Erro: ${(err as Error).message}`);
      }
      ask();
    });
  };
  ask();
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
