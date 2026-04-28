#!/bin/bash
#
# MWCode — Atualizar para a versão mais recente
# Execute no servidor:
#   bash /opt/mwcode/update.sh
# Ou sem ter o script localmente:
#   curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/update.sh | bash
#

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

log()  { echo -e "${CYAN}ℹ${RESET}  ${1}"; }
ok()   { echo -e "${GREEN}✓${RESET}  ${1}"; }
warn() { echo -e "${YELLOW}⚠${RESET}  ${1}"; }
err()  { echo -e "${RED}✗${RESET}  ${1}"; }

echo ""
echo -e "${BOLD}🔄 MWCode — Atualizar${RESET}"
echo ""

# ── Localizar instalação ────────────────────────────────────────────────────
# Tenta /opt/mwcode (instalador padrão), depois ~/mwcode, depois ~/.mwcode
if   [ -d "/opt/mwcode/.git" ];  then MWCODE_DIR="/opt/mwcode"
elif [ -d "$HOME/mwcode/.git" ]; then MWCODE_DIR="$HOME/mwcode"
elif [ -d "$HOME/.mwcode/.git" ];then MWCODE_DIR="$HOME/.mwcode"
else
  err "MWCode não encontrado. Execute o instalador primeiro:"
  echo "  curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/install-unico.sh -o /tmp/install.sh && bash /tmp/install.sh"
  exit 1
fi

ok "Instalação encontrada: $MWCODE_DIR"
cd "$MWCODE_DIR"

# ── Verificar pnpm ──────────────────────────────────────────────────────────
if ! command -v pnpm &>/dev/null; then
  warn "pnpm não encontrado. Instalando..."
  npm install -g pnpm --quiet
  ok "pnpm instalado"
fi

# ── Parar servidor ──────────────────────────────────────────────────────────
log "Parando servidor..."
if command -v pm2 &>/dev/null && pm2 list 2>/dev/null | grep -q "mwcode"; then
  pm2 stop mwcode 2>/dev/null || true
  ok "PM2 parado"
else
  # Matar qualquer processo tsx ou node rodando o servidor
  pkill -f "tsx.*index" 2>/dev/null || true
  pkill -f "server/dist/index" 2>/dev/null || true
  sleep 1
fi

# ── Baixar atualizações ─────────────────────────────────────────────────────
log "Baixando atualizações do GitHub..."
git fetch origin main --quiet
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  ok "Já está na versão mais recente ($(git log -1 --format='%h %s'))"
else
  log "Aplicando $(git rev-list HEAD..origin/main --count) commit(s) novo(s)..."
  git pull origin main --quiet
  ok "Código atualizado: $(git log -1 --format='%h %s')"
fi

# ── Instalar dependências ────────────────────────────────────────────────────
log "Instalando dependências..."
pnpm install --frozen-lockfile --silent 2>/dev/null || pnpm install --silent
ok "Dependências instaladas"

# ── Compilar ─────────────────────────────────────────────────────────────────
log "Compilando..."
pnpm build --silent 2>/dev/null || pnpm build
ok "Build concluído"

# ── Iniciar servidor ──────────────────────────────────────────────────────────
log "Iniciando servidor..."

PORT="${PORT:-3100}"

if command -v pm2 &>/dev/null; then
  if pm2 list 2>/dev/null | grep -q "mwcode"; then
    pm2 restart mwcode --update-env 2>/dev/null
  else
    pm2 start ecosystem.config.cjs 2>/dev/null
  fi
  pm2 save --force 2>/dev/null || true
  STARTED_WITH="PM2"
else
  # Sem PM2 — rodar direto em background com o JS compilado
  NODE_ENV=production PORT=$PORT node server/dist/index.js >> ./logs/out.log 2>> ./logs/error.log &
  STARTED_WITH="node direto (sem PM2)"
  sleep 3
fi

# ── Verificar ────────────────────────────────────────────────────────────────
sleep 3
if curl -sf "http://localhost:$PORT/api/health" > /dev/null 2>&1; then
  echo ""
  ok "${BOLD}MWCode atualizado e rodando!${RESET}"
  echo ""
  echo -e "  ${CYAN}Acesse:${RESET}   http://localhost:$PORT"
  echo -e "  ${CYAN}Versão:${RESET}   $(git log -1 --format='%h') — $(git log -1 --format='%s')"
  echo -e "  ${CYAN}Iniciado com:${RESET} $STARTED_WITH"
  echo ""
else
  warn "Servidor pode não ter iniciado corretamente."
  echo ""
  echo "  Verifique os logs:"
  if command -v pm2 &>/dev/null; then
    echo "    pm2 logs mwcode --lines 30"
  else
    echo "    cat $MWCODE_DIR/logs/error.log"
  fi
  echo ""
fi
