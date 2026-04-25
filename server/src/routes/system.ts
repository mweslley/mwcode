import { Router } from 'express';
import { execSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Diretório raiz da instalação (onde está o .git)
const INSTALL_DIR = path.resolve(__dirname, '../../..');

// Cache simples — não bater no GitHub a cada request
let cache: { ts: number; data: any } | null = null;
const CACHE_MS = 5 * 60 * 1000; // 5 minutos

function getLocalCommit(): { sha: string; message: string; date: string } | null {
  try {
    const sha = execSync('git rev-parse HEAD', {
      cwd: INSTALL_DIR,
      encoding: 'utf-8',
    }).trim();
    const message = execSync('git log -1 --pretty=%s', {
      cwd: INSTALL_DIR,
      encoding: 'utf-8',
    }).trim();
    const date = execSync('git log -1 --pretty=%cI', {
      cwd: INSTALL_DIR,
      encoding: 'utf-8',
    }).trim();
    return { sha, message, date };
  } catch {
    return null;
  }
}

async function getRemoteCommit(): Promise<{
  sha: string;
  message: string;
  date: string;
} | null> {
  try {
    const res = await fetch(
      'https://api.github.com/repos/mweslley/mwcode/commits/main',
      {
        headers: {
          'User-Agent': 'mwcode-update-check',
          Accept: 'application/vnd.github+json',
        },
      }
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    return {
      sha: data.sha,
      message: data.commit?.message?.split('\n')[0] || '',
      date: data.commit?.author?.date || '',
    };
  } catch {
    return null;
  }
}

export const systemRouter = Router();

// GET /api/system/version — versão local (sem chamar GitHub)
systemRouter.get('/version', (_req, res) => {
  const local = getLocalCommit();
  if (!local) {
    return res.status(500).json({
      erro: 'Não foi possível ler o commit local. Esta instalação não é um repositório git?',
    });
  }
  res.json({
    sha: local.sha.substring(0, 7),
    fullSha: local.sha,
    message: local.message,
    date: local.date,
    installDir: INSTALL_DIR,
  });
});

// GET /api/system/update-check — checa se há atualização disponível
systemRouter.get('/update-check', async (_req, res) => {
  // Cache de 5 min
  if (cache && Date.now() - cache.ts < CACHE_MS) {
    return res.json(cache.data);
  }

  const local = getLocalCommit();
  if (!local) {
    return res.status(500).json({
      erro: 'Esta instalação não é um repositório git. Atualização automática indisponível.',
    });
  }

  const remote = await getRemoteCommit();
  if (!remote) {
    return res.status(503).json({
      erro: 'Não foi possível consultar o GitHub agora. Tente novamente em alguns minutos.',
      atual: {
        sha: local.sha.substring(0, 7),
        message: local.message,
        date: local.date,
      },
    });
  }

  const hasUpdate = local.sha !== remote.sha;

  const data = {
    temAtualizacao: hasUpdate,
    atual: {
      sha: local.sha.substring(0, 7),
      fullSha: local.sha,
      message: local.message,
      date: local.date,
    },
    ultima: {
      sha: remote.sha.substring(0, 7),
      fullSha: remote.sha,
      message: remote.message,
      date: remote.date,
    },
    mensagem: hasUpdate
      ? 'Há uma nova versão do MWCode disponível!'
      : 'MWCode está atualizado.',
  };

  cache = { ts: Date.now(), data };
  res.json(data);
});

// POST /api/system/update — executa a atualização
systemRouter.post('/update', (req, res) => {
  // Em produção: validar que o usuário é admin
  // Por ora qualquer usuário logado pode atualizar (fluxo single-tenant)
  const userId = (req as any).userId;
  if (!userId) {
    return res.status(401).json({ erro: 'Não autenticado.' });
  }

  const updateScript = path.join(INSTALL_DIR, 'update.sh');

  // Resposta imediata — o servidor vai reiniciar
  res.status(202).json({
    iniciado: true,
    mensagem:
      'Atualização iniciada. O servidor vai reiniciar em alguns segundos. Recarregue a página em ~30s.',
  });

  // Limpa cache pra forçar nova checagem na próxima visita
  cache = null;

  // Dispara o script desacoplado (não morre quando esta resposta termina)
  setTimeout(() => {
    try {
      const child = spawn('bash', [updateScript], {
        cwd: INSTALL_DIR,
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, MWCODE_HOME: INSTALL_DIR },
      });
      child.unref();
    } catch (err) {
      console.error('Falha ao disparar update.sh:', err);
    }
  }, 1000);
});
