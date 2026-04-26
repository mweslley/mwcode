/**
 * Diretório de dados do MWCode — modelo HÍBRIDO.
 *
 * Código:  /opt/mwcode/         (instalação compartilhada)
 * Dados:   ~/.mwcode/data/      (por usuário do sistema, igual Claude/.claude)
 *
 * Vantagens:
 *  - Reinstalar/atualizar não toca em dados (apaga só /opt/mwcode/)
 *  - Convenção familiar (igual ~/.claude/, ~/.config/, etc)
 *  - Backup simples: tar -czf backup.tgz ~/.mwcode/data/
 *  - Múltiplas instalações da mesma máquina podem compartilhar dados
 *
 * Override pra testes ou setups customizados:
 *   MWCODE_DATA_DIR=/path/customizado pnpm dev
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Pasta de dados ativa. Pode ser sobrescrita via MWCODE_DATA_DIR. */
export const DATA_DIR =
  process.env.MWCODE_DATA_DIR ||
  path.join(os.homedir(), '.mwcode', 'data');

/**
 * Caminho legado dos dados (versão antiga: dados dentro do código).
 * Usado pra migração automática na primeira execução depois do upgrade.
 */
const LEGACY_DATA_DIR = path.resolve(__dirname, '../../../data');

/**
 * Migra dados de /opt/mwcode/data → ~/.mwcode/data se aplicável.
 * Chamada automaticamente uma vez no startup (idempotente).
 */
let _migrated = false;
export function migrateIfNeeded(): void {
  if (_migrated) return;
  _migrated = true;

  // Se DATA_DIR já existe e tem conteúdo, nada a migrar
  if (fs.existsSync(DATA_DIR) && fs.readdirSync(DATA_DIR).length > 0) {
    return;
  }

  // Se não há diretório legado, criar o novo vazio e sair
  if (!fs.existsSync(LEGACY_DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    return;
  }

  // Migração: copiar (não mover, pra preservar referências relativas
  // antigas se algo der errado) o legado pra nova pasta
  console.log(`[MWCode] Migrando dados de ${LEGACY_DATA_DIR} → ${DATA_DIR}`);
  fs.mkdirSync(path.dirname(DATA_DIR), { recursive: true });
  copyRecursive(LEGACY_DATA_DIR, DATA_DIR);
  console.log(`[MWCode] Migração concluída. Dados antigos permanecem em ${LEGACY_DATA_DIR} (pode apagar manualmente quando confirmar que tudo funciona).`);
}

function copyRecursive(src: string, dst: string): void {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dst, entry));
    }
  } else {
    fs.copyFileSync(src, dst);
  }
}

/** Caminho de arquivo dentro de DATA_DIR (não cria diretório). */
export function dataPath(...segments: string[]): string {
  return path.join(DATA_DIR, ...segments);
}

/** Caminho de pasta dentro de DATA_DIR. Cria recursivamente se não existir. */
export function dataDir(...segments: string[]): string {
  const dir = path.join(DATA_DIR, ...segments);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
