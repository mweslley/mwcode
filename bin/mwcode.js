#!/usr/bin/env node
/**
 * MWCode — comando global
 * Uso:
 *   mwcode              inicia servidor + UI
 *   mwcode start        idem
 *   mwcode chat         chat interativo no terminal
 *   mwcode setup        configuração inicial (instala deps, cria .env)
 *   mwcode update       atualiza o MWCode (git pull + pnpm install)
 *   mwcode stop         para o servidor em background
 *   mwcode version      mostra versão
 *   mwcode help         esta mensagem
 */
import { spawn, execSync } from 'node:child_process';
import { existsSync, readFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

const log = (msg) => console.log(msg);
const ok = (msg) => console.log(`${GREEN}✓${RESET} ${msg}`);
const warn = (msg) => console.log(`${YELLOW}⚠${RESET} ${msg}`);
const err = (msg) => console.log(`${RED}✗${RESET} ${msg}`);

function getPkg() {
  return JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
}

function run(cmd, args, opts = {}) {
  return spawn(cmd, args, { cwd: projectRoot, stdio: 'inherit', shell: true, ...opts });
}

function runSync(cmd) {
  return execSync(cmd, { cwd: projectRoot, stdio: 'inherit' });
}

function hasPnpm() {
  try {
    execSync('pnpm --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function hasNodeModules() {
  return existsSync(path.join(projectRoot, 'node_modules'));
}

const commands = {
  start() {
    if (!hasPnpm()) {
      err('pnpm não encontrado. Rode: mwcode setup');
      process.exit(1);
    }
    if (!hasNodeModules()) {
      warn('Dependências não instaladas. Rodando setup primeiro...');
      commands.setup(() => commands.start());
      return;
    }
    log(`${BOLD}🚀 MWCode iniciando...${RESET}`);
    log(`   API:  http://localhost:${process.env.PORT || 3100}`);
    log(`   UI:   http://localhost:5173`);
    run('pnpm', ['dev']);
  },

  chat() {
    if (!hasNodeModules()) {
      warn('Dependências não instaladas. Rode: mwcode setup');
      process.exit(1);
    }
    run('pnpm', ['mwcode', 'chat']);
  },

  setup(onDone) {
    log(`${BOLD}⚙️  Configuração inicial do MWCode${RESET}`);

    if (!hasPnpm()) {
      log('📦 Instalando pnpm...');
      try {
        runSync('npm install -g pnpm');
        ok('pnpm instalado');
      } catch {
        err('Falha ao instalar pnpm. Rode manualmente: npm install -g pnpm');
        process.exit(1);
      }
    }

    log('📦 Instalando dependências (pode demorar)...');
    const install = run('pnpm', ['install']);
    install.on('exit', (code) => {
      if (code !== 0) {
        err('Falha ao instalar dependências');
        process.exit(code);
      }
      ok('Dependências instaladas');

      const envPath = path.join(projectRoot, '.env');
      const envExamplePath = path.join(projectRoot, '.env.example');
      if (!existsSync(envPath) && existsSync(envExamplePath)) {
        copyFileSync(envExamplePath, envPath);
        ok(`Arquivo .env criado em ${envPath}`);
        warn('Configure sua chave de API (OPENROUTER_API_KEY recomendado) no .env');
      }

      log(`\n${GREEN}🎉 Pronto!${RESET} Rode: ${BOLD}mwcode${RESET}`);
      if (onDone) onDone();
    });
  },

  update() {
    log('📥 Atualizando MWCode...');
    try {
      runSync('git pull');
      runSync('pnpm install');
      ok('Atualização concluída');
    } catch {
      err('Falha ao atualizar. Verifique se o diretório é um repositório git válido.');
      process.exit(1);
    }
  },

  stop() {
    warn('Use Ctrl+C no terminal onde o servidor está rodando.');
    log('Para produção com PM2: pm2 stop mwcode');
  },

  version() {
    log(getPkg().version);
  },

  help() {
    const v = getPkg().version;
    log(`
${BOLD}MWCode v${v}${RESET} — Sistema de Agentes de IA

${BOLD}Uso:${RESET}
  ${GREEN}mwcode${RESET}              Inicia servidor + interface web
  ${GREEN}mwcode start${RESET}        Igual acima
  ${GREEN}mwcode chat${RESET}         Chat interativo no terminal
  ${GREEN}mwcode setup${RESET}        Configuração inicial (instala deps, cria .env)
  ${GREEN}mwcode update${RESET}       Atualiza o MWCode
  ${GREEN}mwcode version${RESET}      Mostra versão
  ${GREEN}mwcode help${RESET}         Esta mensagem

${BOLD}URLs após iniciar:${RESET}
  Interface:  http://localhost:5173
  API:        http://localhost:3100
  Saúde:      http://localhost:3100/api/health

${BOLD}Docs:${RESET} https://github.com/mweslley/mwcode
`);
  }
};

const command = process.argv[2] || 'start';
const fn = commands[command];

if (!fn) {
  err(`Comando desconhecido: ${command}`);
  commands.help();
  process.exit(1);
}

fn();
