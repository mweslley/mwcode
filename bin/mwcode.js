#!/usr/bin/env node
/**
 * MWCode — comando global
 *
 * DESENVOLVIMENTO (sua máquina ou testar rápido no VPS):
 *   mwcode                    inicia servidor + UI em modo DEV (hot reload)
 *   mwcode dev                idem
 *   mwcode start              idem
 *   mwcode chat               chat interativo no terminal
 *
 * PRODUÇÃO (VPS com usuários reais):
 *   mwcode serve              build + roda via PM2 (reinicia sozinho)
 *   mwcode logs               mostra logs do PM2
 *   mwcode stop               para o processo PM2
 *   mwcode restart            reinicia o processo PM2
 *
 * GERENCIAMENTO:
 *   mwcode setup              instala dependências + cria .env
 *   mwcode update             git pull + pnpm install (+ rebuild se em prod)
 *   mwcode uninstall [flags]  desinstala (veja --keep-env, --purge, --yes)
 *   mwcode reinstall [flags]  desinstala e instala novamente
 *   mwcode status             mostra o que está rodando
 *   mwcode version            mostra versão
 *   mwcode help               ajuda completa
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
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const log = (msg) => console.log(msg);
const ok = (msg) => console.log(`${GREEN}✓${RESET} ${msg}`);
const warn = (msg) => console.log(`${YELLOW}⚠${RESET} ${msg}`);
const err = (msg) => console.log(`${RED}✗${RESET} ${msg}`);
const info = (msg) => console.log(`${BLUE}ℹ${RESET} ${msg}`);
const step = (msg) => console.log(`${CYAN}▶${RESET} ${msg}`);

function getPkg() {
  return JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
}

function run(cmd, args, opts = {}) {
  if (process.platform === 'win32') {
    return spawn(`${cmd} ${args.join(' ')}`, {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: true,
      ...opts,
    });
  }
  return spawn(cmd, args, { cwd: projectRoot, stdio: 'inherit', ...opts });
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

function hasPm2() {
  return tryExec('pm2 --version');
}

function hasBuild() {
  return existsSync(path.join(projectRoot, 'ui', 'dist', 'index.html'));
}

function getLocalIPs() {
  const ips = [];
  const ifaces = os.networkInterfaces();
  for (const addrs of Object.values(ifaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) ips.push(addr.address);
    }
  }
  return ips;
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

function checkEnv() {
  const envPath = path.join(projectRoot, '.env');
  if (!existsSync(envPath)) return { exists: false, configured: false };
  const content = readFileSync(envPath, 'utf8');
  const hasKey = /^(OPENROUTER_API_KEY|OPENAI_API_KEY|GEMINI_API_KEY|DEEPSEEK_API_KEY)=\S+/m.test(
    content.replace(/^#.*$/gm, '')
  );
  return { exists: true, configured: hasKey };
}

function printEnvWarning() {
  const env = checkEnv();
  if (!env.exists) {
    warn(`Arquivo .env não encontrado. Rode: ${BOLD}mwcode setup${RESET}`);
    return false;
  }
  if (!env.configured) {
    warn(`${BOLD}Nenhuma chave de API configurada no .env${RESET}`);
    log(`   Edite o arquivo: ${YELLOW}${path.join(projectRoot, '.env')}${RESET}`);
    log(`   Descomente e preencha ao menos uma destas linhas:`);
    log(`     ${DIM}OPENROUTER_API_KEY=sk-or-v1-...${RESET}  (recomendado — tem modelos grátis)`);
    log(`     ${DIM}OPENAI_API_KEY=sk-...${RESET}`);
    log(`     ${DIM}GEMINI_API_KEY=...${RESET}`);
    log(`   De onde pegar chave grátis: ${CYAN}https://openrouter.ai/keys${RESET}\n`);
    return false;
  }
  return true;
}

function printAccessURLs(port) {
  const ips = getLocalIPs();

  log(`${BOLD}🌐 Como acessar:${RESET}\n`);
  log(`${BOLD}Na mesma máquina${RESET} (se instalou localmente):`);
  log(`   Interface:  ${GREEN}http://localhost:5173${RESET}   ${DIM}(dev)${RESET}`);
  log(`   API:        ${GREEN}http://localhost:${port}${RESET}`);

  if (ips.length) {
    log(`\n${BOLD}De outros dispositivos / internet${RESET} (rede ou VPS):`);
    for (const ip of ips) {
      log(`   Interface:  ${GREEN}http://${ip}:5173${RESET}   ${DIM}(dev)${RESET}`);
      log(`   API:        ${GREEN}http://${ip}:${port}${RESET}`);
    }
    log(`\n${YELLOW}⚠${RESET}  Se estiver em VPS, libere as portas:`);
    log(`     ${BOLD}sudo ufw allow 5173 && sudo ufw allow ${port}${RESET}`);
    log(`   Pra produção com HTTPS (recomendado): use ${BOLD}mwcode serve${RESET} + nginx`);
    log(`   Guia completo: ${CYAN}https://github.com/mweslley/mwcode/blob/main/doc/VPS.md${RESET}`);
  }
  log('');
}

const commands = {
  // === MODO DESENVOLVIMENTO ===
  start() { return commands.dev(); },

  dev() {
    if (!hasPnpm()) {
      err('pnpm não encontrado. Rode primeiro: mwcode setup');
      process.exit(1);
    }
    if (!hasNodeModules()) {
      warn('Dependências não instaladas. Rodando setup automático primeiro...\n');
      commands.setup(() => commands.dev());
      return;
    }

    log(`${BOLD}${CYAN}🚀 MWCode — Modo DESENVOLVIMENTO${RESET}`);
    log(`${DIM}   Ideal para: testar localmente, desenvolver, ver mudanças ao vivo${RESET}`);
    log(`${DIM}   Recursos:  hot reload (Vite), 2 portas (5173 UI + 3100 API)${RESET}\n`);

    printEnvWarning();

    const port = process.env.PORT || 3100;
    printAccessURLs(port);

    step('Iniciando Vite (UI) + Express (API) em paralelo...');
    log(`${DIM}   Pressione Ctrl+C para parar${RESET}\n`);

    run('pnpm', ['dev']);
  },

  chat() {
    if (!hasNodeModules()) {
      warn('Dependências não instaladas. Rode primeiro: mwcode setup');
      process.exit(1);
    }
    if (!printEnvWarning()) return;
    log(`${BOLD}💬 MWCode — Chat no terminal${RESET}\n`);
    run('pnpm', ['mwcode', 'chat']);
  },

  // === MODO PRODUÇÃO ===
  async serve() {
    if (!hasPnpm()) {
      err('pnpm não encontrado. Rode primeiro: mwcode setup');
      process.exit(1);
    }
    if (!hasNodeModules()) {
      warn('Dependências não instaladas. Rodando setup primeiro...\n');
      commands.setup(() => commands.serve());
      return;
    }

    log(`${BOLD}${GREEN}🌍 MWCode — Modo PRODUÇÃO${RESET}`);
    log(`${DIM}   Ideal para: VPS com usuários reais, domínio próprio${RESET}`);
    log(`${DIM}   Recursos:  build otimizado, 1 porta só (3100), PM2 reinicia sozinho${RESET}\n`);

    if (!printEnvWarning()) {
      err('Configure o .env antes de rodar em produção.');
      process.exit(1);
    }

    // 1. Instalar PM2 se não tiver
    if (!hasPm2()) {
      step('Instalando PM2 (gerenciador de processos)...');
      const sudo = process.getuid && process.getuid() !== 0 ? 'sudo ' : '';
      if (!tryExec(`${sudo}npm install -g pm2`)) {
        err('Falha ao instalar PM2. Rode manualmente: sudo npm install -g pm2');
        process.exit(1);
      }
      ok('PM2 instalado');
    }

    // 2. Build
    if (!hasBuild()) {
      step('Fazendo build de produção (pode demorar)...');
      try {
        runSync('pnpm build');
        ok('Build concluído');
      } catch {
        err('Falha no build. Veja os erros acima.');
        process.exit(1);
      }
    } else {
      info('Build existente encontrado. Use "mwcode update" pra reconstruir.');
    }

    // 3. Iniciar com PM2
    step('Iniciando com PM2...');
    try {
      tryExec('pm2 delete mwcode'); // limpa instância anterior
      runSync('pm2 start ecosystem.config.cjs');
      tryExec('pm2 save');
      ok('MWCode rodando via PM2');
    } catch {
      err('Falha ao iniciar via PM2. Veja os erros acima.');
      process.exit(1);
    }

    // 4. Mostrar acesso e próximos passos
    const port = process.env.PORT || 3100;
    log(`\n${BOLD}🌐 MWCode está no ar!${RESET}\n`);
    log(`${BOLD}Acesso local${RESET}:         ${GREEN}http://localhost:${port}${RESET}`);
    for (const ip of getLocalIPs()) {
      log(`${BOLD}Acesso via IP${RESET}:        ${GREEN}http://${ip}:${port}${RESET}`);
    }

    log(`\n${BOLD}Comandos úteis:${RESET}`);
    log(`   ${GREEN}mwcode logs${RESET}          Ver logs em tempo real`);
    log(`   ${GREEN}mwcode status${RESET}        Ver estado do processo`);
    log(`   ${GREEN}mwcode restart${RESET}       Reiniciar servidor`);
    log(`   ${GREEN}mwcode stop${RESET}          Parar servidor`);

    log(`\n${YELLOW}⚠${RESET}  ${BOLD}Próximos passos recomendados pra produção:${RESET}`);
    log(`   1. Liberar porta no firewall:  ${BOLD}sudo ufw allow ${port}${RESET}`);
    log(`   2. Configurar reinício automático no boot:  ${BOLD}pm2 startup${RESET}`);
    log(`      (copie e execute o comando que o pm2 imprimir)`);
    log(`   3. Adicionar HTTPS com domínio próprio (nginx + Let's Encrypt):`);
    log(`      ${CYAN}https://github.com/mweslley/mwcode/blob/main/doc/VPS.md${RESET}\n`);
  },

  logs() {
    if (!hasPm2()) {
      err('PM2 não instalado. Use "mwcode serve" pra iniciar em modo produção.');
      process.exit(1);
    }
    info('Mostrando logs do MWCode (Ctrl+C pra sair)...\n');
    run('pm2', ['logs', 'mwcode']);
  },

  status() {
    if (!hasPm2()) {
      warn('PM2 não está instalado.');
      log(`   Modo produção: use ${BOLD}mwcode serve${RESET}`);
      log(`   Modo desenvolvimento: use ${BOLD}mwcode${RESET} (sem PM2, Ctrl+C pra parar)`);
      return;
    }
    log(`${BOLD}📊 Status do MWCode (PM2):${RESET}\n`);
    run('pm2', ['status', 'mwcode']);
  },

  restart() {
    if (!hasPm2()) {
      err('PM2 não instalado. Rode: mwcode serve');
      process.exit(1);
    }
    step('Reiniciando MWCode...');
    if (tryExec('pm2 restart mwcode')) {
      ok('MWCode reiniciado');
    } else {
      err('Falha ao reiniciar. Está rodando? Use "mwcode serve" pra iniciar.');
    }
  },

  stop() {
    log(`${BOLD}⏹  Parando MWCode...${RESET}\n`);
    const wasPm2 = tryExec('pm2 stop mwcode');
    if (wasPm2) {
      tryExec('pm2 delete mwcode');
      ok('Processo PM2 parado e removido');
    } else {
      warn('Nenhum processo PM2 rodando.');
      log(`   Se iniciou com ${BOLD}mwcode${RESET} (modo dev), use Ctrl+C no terminal onde está rodando.`);
    }
  },

  // === GERENCIAMENTO ===
  setup(onDone) {
    log(`${BOLD}${CYAN}⚙️  MWCode — Configuração inicial${RESET}\n`);

    if (!hasPnpm()) {
      step('Instalando pnpm (gerenciador de pacotes)...');
      try {
        runSync('npm install -g pnpm');
        ok('pnpm instalado');
      } catch {
        err('Falha ao instalar pnpm. Rode manualmente: sudo npm install -g pnpm');
        process.exit(1);
      }
    } else {
      info('pnpm já instalado.');
    }

    step('Instalando dependências do projeto (pode demorar alguns minutos)...');
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
        try { execSync(`chmod 600 "${envPath}"`); } catch {}
        ok(`.env criado em ${envPath}`);
      }

      log(`\n${GREEN}${BOLD}🎉 Configuração concluída!${RESET}\n`);
      log(`${BOLD}Próximos passos:${RESET}`);
      log(`   1. Configure sua chave de API:  ${YELLOW}nano ${envPath}${RESET}`);
      log(`      Pegue uma grátis em:          ${CYAN}https://openrouter.ai/keys${RESET}\n`);
      log(`   2. Escolha o modo de execução:`);
      log(`      ${BOLD}Desenvolvimento${RESET} (testar localmente):   ${GREEN}mwcode${RESET}`);
      log(`      ${BOLD}Produção${RESET} (VPS com usuários reais):     ${GREEN}mwcode serve${RESET}\n`);

      if (onDone) onDone();
    });
  },

  update() {
    log(`${BOLD}📥 Atualizando MWCode...${RESET}\n`);
    step('Baixando código mais recente (git pull)...');
    try {
      runSync('git pull');
      ok('Código atualizado');
    } catch {
      err('Falha no git pull. Verifique se o diretório é um repositório git válido.');
      process.exit(1);
    }

    step('Instalando dependências novas (se houver)...');
    try {
      runSync('pnpm install');
      ok('Dependências atualizadas');
    } catch {
      err('Falha no pnpm install.');
      process.exit(1);
    }

    // Se estava rodando em produção (tem build), refazer build + reiniciar PM2
    if (hasBuild()) {
      step('Recriando build de produção...');
      try {
        runSync('pnpm build');
        ok('Build atualizado');
      } catch {
        warn('Build falhou — modo dev ainda funciona, mas "mwcode serve" pode estar desatualizado.');
      }

      if (hasPm2() && tryExec('pm2 describe mwcode')) {
        step('Reiniciando processo PM2...');
        tryExec('pm2 restart mwcode');
        ok('Produção reiniciada com código novo');
      }
    }

    log(`\n${GREEN}${BOLD}✓ Atualização concluída${RESET}`);
  },

  async uninstall(rawArgs = []) {
    const flags = parseFlags(rawArgs);
    const autoYes = flags.has('yes') || flags.has('y');
    const keepEnv = flags.has('keep-env');
    const purge = flags.has('purge');

    const symlinks = findSymlinks();

    log(`${BOLD}${RED}🗑️  Desinstalar MWCode${RESET}`);
    log(`   Diretório:  ${projectRoot}`);
    if (symlinks.length) symlinks.forEach((s) => log(`   Comando:    ${s}`));
    if (keepEnv) log(`   ${BLUE}Preservar .env${RESET} (backup em /tmp/mwcode.env.backup)`);
    if (purge) log(`   ${RED}PURGE${RESET}: remove também pnpm e PM2 globais`);
    log('');

    if (!autoYes) {
      const confirmed = await confirm('Confirma remoção?');
      if (!confirmed) {
        log('Cancelado.');
        return;
      }
    }

    let envBackup = null;
    if (keepEnv) {
      const envPath = path.join(projectRoot, '.env');
      if (existsSync(envPath)) {
        envBackup = readFileSync(envPath, 'utf8');
        writeFileSync('/tmp/mwcode.env.backup', envBackup, { mode: 0o600 });
        ok('.env salvo em /tmp/mwcode.env.backup');
      }
    }

    if (tryExec('pm2 stop mwcode')) ok('PM2: mwcode parado');
    tryExec('pm2 delete mwcode');

    for (const link of symlinks) {
      if (removeFileMaybeSudo(link)) ok(`Removido: ${link}`);
      else warn(`Não foi possível remover: ${link}`);
    }

    try {
      rmSync(projectRoot, { recursive: true, force: true });
      ok(`Removido: ${projectRoot}`);
    } catch (e) {
      if (tryExec(`sudo rm -rf "${projectRoot}"`)) {
        ok(`Removido: ${projectRoot}`);
      } else {
        err(`Falha ao remover: ${projectRoot} (${e.message})`);
      }
    }

    if (purge) {
      step('Removendo pnpm e PM2 globais...');
      tryExec('npm uninstall -g pnpm');
      tryExec('npm uninstall -g pm2');
      tryExec(`rm -rf "${path.join(os.homedir(), '.local', 'share', 'pnpm')}"`);
      tryExec(`rm -rf "${path.join(os.homedir(), '.pnpm-store')}"`);
      ok('pnpm e PM2 removidos');
    }

    log(`\n${GREEN}${BOLD}✓ Desinstalação concluída${RESET}`);
    if (envBackup) {
      log(`${BLUE}ℹ${RESET}  Seu .env está guardado em /tmp/mwcode.env.backup`);
    }
  },

  async reinstall(rawArgs = []) {
    const flags = parseFlags(rawArgs);
    const fresh = flags.has('fresh');

    log(`${BOLD}${CYAN}🔄 Reinstalando MWCode${RESET}`);
    log(fresh ? `   ${YELLOW}--fresh${RESET}: NÃO preserva .env` : `   Preservando .env (use --fresh pra zerar)`);
    log('');

    const confirmed = await confirm('Continuar?');
    if (!confirmed) {
      log('Cancelado.');
      return;
    }

    await commands.uninstall([...(fresh ? [] : ['--keep-env']), '--yes']);

    step('Baixando e rodando o instalador...\n');
    const installResult = spawnSync(
      'bash',
      ['-c', 'curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/install.sh | bash'],
      { stdio: 'inherit' }
    );

    if (installResult.status !== 0) {
      err('Falha na reinstalação');
      process.exit(installResult.status || 1);
    }

    if (!fresh && existsSync('/tmp/mwcode.env.backup')) {
      const newInstall = path.join(os.homedir(), '.mwcode');
      if (existsSync(newInstall)) {
        copyFileSync('/tmp/mwcode.env.backup', path.join(newInstall, '.env'));
        tryExec(`chmod 600 "${path.join(newInstall, '.env')}"`);
        ok('.env restaurado');
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
${BOLD}MWCode v${v}${RESET} — Sistema de Agentes de IA 🇧🇷

${BOLD}═══════════════════════════════════════════════════════════════${RESET}
${BOLD}${CYAN}DESENVOLVIMENTO${RESET} ${DIM}— pra testar localmente / desenvolver${RESET}
${BOLD}═══════════════════════════════════════════════════════════════${RESET}
  ${GREEN}mwcode${RESET}            Inicia servidor + interface com hot reload
  ${GREEN}mwcode dev${RESET}        Idem
  ${GREEN}mwcode chat${RESET}       Chat interativo no terminal

  ${DIM}Escuta em: localhost:5173 (UI) + localhost:3100 (API)${RESET}
  ${DIM}Pare com: Ctrl+C${RESET}

${BOLD}═══════════════════════════════════════════════════════════════${RESET}
${BOLD}${GREEN}PRODUÇÃO${RESET} ${DIM}— pra VPS com usuários reais${RESET}
${BOLD}═══════════════════════════════════════════════════════════════${RESET}
  ${GREEN}mwcode serve${RESET}      Build + roda via PM2 (reinicia sozinho)
  ${GREEN}mwcode logs${RESET}       Ver logs em tempo real
  ${GREEN}mwcode status${RESET}     Ver estado do processo
  ${GREEN}mwcode restart${RESET}    Reiniciar o servidor
  ${GREEN}mwcode stop${RESET}       Parar o servidor

  ${DIM}Escuta em: 0.0.0.0:3100 (uma porta só, UI + API)${RESET}
  ${DIM}Pra HTTPS + domínio próprio: configure nginx (veja doc/VPS.md)${RESET}

${BOLD}═══════════════════════════════════════════════════════════════${RESET}
${BOLD}GERENCIAMENTO${RESET}
${BOLD}═══════════════════════════════════════════════════════════════${RESET}
  ${GREEN}mwcode setup${RESET}      Instala dependências + cria .env
  ${GREEN}mwcode update${RESET}     Atualiza código (git pull + reinicia se em prod)
  ${GREEN}mwcode uninstall${RESET}  Desinstala
    ${YELLOW}-y, --yes${RESET}       pula confirmação
    ${YELLOW}--keep-env${RESET}      preserva o .env em /tmp/mwcode.env.backup
    ${YELLOW}--purge${RESET}         remove também pnpm e PM2 globais
  ${GREEN}mwcode reinstall${RESET}  Desinstala + instala novamente (preserva .env)
    ${YELLOW}--fresh${RESET}         não preserva o .env
  ${GREEN}mwcode version${RESET}    Mostra versão
  ${GREEN}mwcode help${RESET}       Esta mensagem

${BOLD}═══════════════════════════════════════════════════════════════${RESET}
${BOLD}ARQUIVOS E DOCUMENTAÇÃO${RESET}
${BOLD}═══════════════════════════════════════════════════════════════${RESET}
  ${DIM}Instalação:${RESET}   ${projectRoot}
  ${DIM}Configuração:${RESET} ${projectRoot}/.env
  ${DIM}Logs (prod):${RESET}  ${projectRoot}/logs/

  ${BOLD}Docs online:${RESET}
    Instalação:    ${CYAN}https://github.com/mweslley/mwcode/blob/main/doc/INSTALL.md${RESET}
    Deploy VPS:    ${CYAN}https://github.com/mweslley/mwcode/blob/main/doc/VPS.md${RESET}
    Segurança:     ${CYAN}https://github.com/mweslley/mwcode/blob/main/SECURITY.md${RESET}
    Contribuir:    ${CYAN}https://github.com/mweslley/mwcode/blob/main/CONTRIBUTING.md${RESET}
`);
  },
};

const [, , cmdName = 'dev', ...rest] = process.argv;
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
