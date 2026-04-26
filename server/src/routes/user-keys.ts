/**
 * Chaves de API por usuário.
 * Cada usuário pode guardar suas próprias chaves (OpenRouter, OpenAI, etc.)
 * que sobrepõem as do servidor.
 * Armazenadas em ~/.mwcode/data/keys/{userId}.json
 */
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { dataDir } from '../lib/data-dir.js';

export const userKeysRouter = Router();

interface UserKeys {
  openrouter?: string;
  openai?: string;
  gemini?: string;
  deepseek?: string;
  github?: string;
  ollama_url?: string;
  updatedAt?: string;
}

function keysFile(userId: string): string {
  return path.join(dataDir('keys'), `${userId}.json`);
}

function loadKeys(userId: string): UserKeys {
  const file = keysFile(userId);
  if (!fs.existsSync(file)) return {};
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return {}; }
}

/** Carrega as chaves de um usuário (para uso interno nos adapters). */
export function getUserKeys(userId: string): UserKeys {
  return loadKeys(userId);
}

// GET /api/user/keys — retorna chaves mascaradas
userKeysRouter.get('/', (req: any, res: any) => {
  const keys = loadKeys(req.userId);
  // Mascarar: mostrar só os últimos 4 chars
  const masked: Record<string, string> = {};
  for (const [k, v] of Object.entries(keys)) {
    if (k === 'updatedAt' || k === 'ollama_url') {
      masked[k] = v as string;
    } else if (typeof v === 'string' && v.length > 0) {
      masked[k] = '••••••••' + v.slice(-4);
    }
  }
  // Indicar se chave do servidor está configurada
  res.json({
    keys: masked,
    server: {
      openrouter: !!process.env.OPENROUTER_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      gemini: !!process.env.GEMINI_API_KEY,
      deepseek: !!process.env.DEEPSEEK_API_KEY,
      github: !!process.env.GITHUB_TOKEN,
    }
  });
});

// PUT /api/user/keys — salva chaves
userKeysRouter.put('/', (req: any, res: any) => {
  const existing = loadKeys(req.userId);
  const updated: UserKeys = { ...existing };

  const allowed = ['openrouter', 'openai', 'gemini', 'deepseek', 'github', 'ollama_url'];
  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      // String vazia = remover chave
      if (req.body[field] === '') {
        delete (updated as any)[field];
      } else {
        (updated as any)[field] = req.body[field];
      }
    }
  }
  updated.updatedAt = new Date().toISOString();

  fs.writeFileSync(keysFile(req.userId), JSON.stringify(updated, null, 2));
  res.json({ ok: true });
});

// DELETE /api/user/keys/:provider — remove chave específica
userKeysRouter.delete('/:provider', (req: any, res: any) => {
  const keys = loadKeys(req.userId);
  delete (keys as any)[req.params.provider];
  keys.updatedAt = new Date().toISOString();
  fs.writeFileSync(keysFile(req.userId), JSON.stringify(keys, null, 2));
  res.json({ ok: true });
});
