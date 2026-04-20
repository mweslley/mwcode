#!/usr/bin/env node
/**
 * MWCode — comando global
 * Uso:
 *   mwcode                    inicia servidor + UI
 *   mwcode start              idem
 *   mwcode chat               chat interativo no terminal
 *   mwcode setup              configuração inicial (instala deps, cria .env)
 *   mwcode update             atualiza o MWCode (git pull + pnpm install)
 *   mwcode stop               para o servidor em background (PM2)
 *   mwcode uninstall [flags]  desinstala o MWCode
 *     --yes, -y                 pula confirmação
 *     --keep-env                preserva o arquivo .env
 *     --purge                   remove também pnpm e PM2 global
 *   mwcode reinstall [flags]  desinstala e instala novamente
 *     --fresh                   não preserva o .env (padrão: preserva)
 *   mwcode version            mostra versão
 *   mwcode help               esta mensagem
 */
import { spawn, execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, copyFileSync, rmSync, unlinkSync } from 'node:fs';
import readline from 'node:readline';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BLUE = '\x1b[34m';
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

function tryExec(cmd, opts = {}) {
  try {
    execSync(cmd, { stdio: 'ignore', ...opts });
    return true;
  } catch {
    return false;
  }
}

function hasPnpm() {
  return tryExec('pnpm --version');
}

function hasNodeModules() {
  return existsSync(path.join(projectRoot, 'node_modules'));
}

function parseFlags(argv) {
  const flags = new Set();
  for (const a of argv) {
    if (a.startsWith('--')) flags.add(a.slice(2));
    else if (a.startsWith('-') && a.length === 2) flags.add(a.slice(1));
  }
  return flags;
}

function confirm(msg) {
  if (!process.stdin.isTTY) return Promise.resolve(false);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${msg} (s/N): `, (answer) => {
      rl.close();
      resolve(/^(s|sim|y|yes)$/i.test(answer.trim()));
    });
  });
}

function findSymlinks() {
  const candidates = [
    '/usr/local/bin/mwcode',
    path.join(os.homedir(), '.local', 'bin', 'mwcode'),
    '/usr/bin/mwcode',
    '/opt/homebrew/bin/mwcode',
  ];
  return candidates.filter((p) => existsSync(p));
}

function removeFileMaybeSudo(filepath) {
  try {
    unlinkSync(filepath);
    return true;
  } catch {
    return tryExec(`sudo rm -f "${filepath}"`);
  }
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
    log('Parando processos MWCode...');
    const stopped = tryExec('pm2 stop mwcode') && tryExec('pm2 delete mwcode');
    if (stopped) ok('PM2: mwcode parado');
    else warn('Nenhum processo PM2 rodando. Se iniciou via "mwcode" direto, use Ctrl+C no terminal.');
  },

  async uninstall(rawArgs = []) {
    const flags = parseFlags(rawArgs);
    const autoYes = flags.has('yes') || flags.has('y');
    const keepEnv = flags.has('keep-env');
    const purge = flags.has('purge');

    const symlinks = findSymlinks();

    log(`${BOLD}🗑️  Desinstalar MWCode${RESET}`);
    log(`   Instalação: ${projectRoot}`);
    if (symlinks.length) symlinks.forEach((s) => log(`   Comando:    ${s}`));
    if (keepEnv) log(`   ${BLUE}Preservar .env${RESET}`);
    if (purge) log(`   ${RED}PURGE${RESET}: também remove pnpm global e PM2`);
    log('');

    if (!autoYes) {
      const confirmed = await confirm('Confirma remoção?');
      if (!confirmed) {
        log('Cancelado.');
        return;
      }
    }

    // Backup do .env se solicitado
    let envBackup = null;
    if (keepEnv) {
      const envPath = path.join(projectRoot, '.env');
      if (existsSync(envPath)) {
        envBackup = readFileSync(envPath, 'utf8');
        ok('.env lido (será restaurado em /tmp/mwcode.env.backup)');
        writeFileSync('/tmp/mwcode.env.backup', envBackup, { mode: 0o600 });
      }
    }

    // Parar PM2
    if (tryExec('pm2 stop mwcode')) ok('PM2: mwcode parado');
    tryExec('pm2 delete mwcode');

    // Remover symlinks
    for (const link of symlinks) {
      if (removeFileMaybeSudo(link)) ok(`Removido: ${link}`);
      else warn(`Não foi possível remover: ${link}`);
    }

    // Remover diretório de instalação
    // (no Linux, podemos deletar o próprio diretório durante a execução)
    try {
      rmSync(projectRoot, { recursive: true, force: true });
      ok(`Removido: ${projectRoot}`);
    } catch (e) {
      // Tentar com sudo
      if (tryExec(`sudo rm -rf "${projectRoot}"`)) {
        ok(`Removido: ${projectRoot}`);
      } else {
        err(`Falha ao remover: ${projectRoot} (${e.message})`);
      }
    }

    // Purge opcional
    if (purge) {
      log('🧹 Removendo pnpm e PM2 globais...');
      tryExec('npm uninstall -g pnpm');
      tryExec('npm uninstall -g pm2');
      tryExec(`rm -rf "${path.join(os.homedir(), '.local', 'share', 'pnpm')}"`);
      tryExec(`rm -rf "${path.join(os.homedir(), '.pnpm-store')}"`);
      ok('pnpm e PM2 removidos');
    }

    log(`\n${GREEN}${BOLD}✓ Desinstalação concluída${RESET}`);
    if (envBackup) {
      log(`\n${BLUE}Backup do .env:${RESET} /tmp/mwcode.env.backup`);
    }
  },

  async reinstall(rawArgs = []) {
    const flags = parseFlags(rawArgs);
    const fresh = flags.has('fresh');

    log(`${BOLD}🔄 Reinstalando MWCode${RESET}`);
    log(fresh ? `   ${YELLOW}--fresh${RESET}: não preserva .env` : `   Preservando .env`);
    log('');

    const confirmed = await confirm('Continuar?');
    if (!confirmed) {
      log('Cancelado.');
      return;
    }

    // Desinstalar preservando .env (se não for --fresh)
    await commands.uninstall([...(fresh ? [] : ['--keep-env']), '--yes']);

    // Reinstalar via curl | bash
    log('\n📥 Baixando e rodando o instalador...\n');
    const installResult = spawnSync(
      'bash',
      ['-c', 'curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/install.sh | bash'],
      { stdio: 'inherit' }
    );

    if (installResult.status !== 0) {
      err('Falha na reinstalação');
      process.exit(installResult.status || 1);
    }

    // Restaurar .env se houver backup
    if (!fresh && existsSync('/tmp/mwcode.env.backup')) {
      const newInstall = path.join(os.homedir(), '.mwcode');
      if (existsSync(newInstall)) {
        copyFileSync('/tmp/mwcode.env.backup', path.join(newInstall, '.env'));
        ok('.env restaurado');
        tryExec(`chmod 600 "${path.join(newInstall, '.env')}"`);
      }
    }

    log(`\n${GREEN}${BOLD}🎉 Reinstalação concluída!${RESET}`);
  },

  version() {
    log(getPkg().version);
  },

  help() {
    const v = getPkg().version;
    log(`
${BOLD}MWCode v${v}${RESET} — Sistema de Agentes de IA

${BOLD}Uso:${RESET}
  ${GREEN}mwcode${RESET}                    Inicia servidor + interface web
  ${GREEN}mwcode start${RESET}              Igual acima
  ${GREEN}mwcode chat${RESET}               Chat interativo no terminal
  ${GREEN}mwcode setup${RESET}              Configuração inicial (instala deps, cria .env)
  ${GREEN}mwcode update${RESET}             Atualiza o MWCode (git pull + pnpm install)
  ${GREEN}mwcode stop${RESET}               Para processo PM2
  ${GREEN}mwcode uninstall${RESET}          Desinstala o MWCode
    ${YELLOW}--yes${RESET}, ${YELLOW}-y${RESET}              pula confirmação
    ${YELLOW}--keep-env${RESET}            preserva o arquivo .env em /tmp/
    ${YELLOW}--purge${RESET}               remove também pnpm e PM2 globais
  ${GREEN}mwcode reinstall${RESET}          Desinstala e instala novamente
    ${YELLOW}--fresh${RESET}               não preserva o .env
  ${GREEN}mwcode version${RESET}            Mostra versão
  ${GREEN}mwcode help${RESET}               Esta mensagem

${BOLD}URLs após iniciar:${RESET}
  Interface:  http://localhost:5173
  API:        http://localhost:3100
  Saúde:      http://localhost:3100/api/health

${BOLD}Docs:${RESET} https://github.com/mweslley/mwcode
`);
  },
};

const [, , cmdName = 'start', ...rest] = process.argv;
const fn = commands[cmdName];

if (!fn) {
  err(`Comando desconhecido: ${cmdName}`);
  commands.help();
  process.exit(1);
}

const result = fn(rest);
if (result && typeof result.then === 'function') {
  result.catch((e) => {
    err(e.message || String(e));
    process.exit(1);
  });
}
