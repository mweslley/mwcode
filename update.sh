#!/bin/bash
#
# MWCode — Atualizar
# Execute:
#   curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/update.sh -o /tmp/update.sh && bash /tmp/update.sh
#

set -u

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RESET='\033[0m'

log() { echo -e "${CYAN}ℹ${RESET} ${1}"; }
ok() { echo -e "${GREEN}✓${RESET} ${1}"; }

MWCODE_DIR="${MWCODE_HOME:-$HOME/.mwcode}"

echo ""
echo -e "${BOLD}🚀 MWCode — Atualizar${RESET}"
echo ""

# Verificar se MWCode existe
if [ ! -d "$MWCODE_DIR" ]; then
    echo "MWCode não encontrado. Execute o instalador primeiro:"
    echo "  curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/install-unico.sh -o /tmp/install.sh && bash /tmp/install.sh"
    exit 1
fi

ok "MWCode encontrado: $MWCODE_DIR"

# Parar servidor
log "Parando servidor..."
pkill -f "tsx src/index" 2>/dev/null || true
sleep 2

# Backup
log "Fazendo backup..."
cp -r "$MWCODE_DIR" "$MWCODE_DIR.backup.$(date +%Y%m%d.%H%M%S)" 2>/dev/null || true

# Baixar atualização
log "Baixando atualização..."
cd /tmp
rm -rf mwcode-temp 2>/dev/null || true
git clone --depth 1 --branch main https://github.com/mweslley/mwcode.git mwcode-temp

# Atualizar arquivos
log "Atualizando arquivos..."
cd "$MWCODE_DIR"
cp -r /tmp/mwcode-temp/* . 2>/dev/null || true
cp -r /tmp/mwcode-temp/.* . 2>/dev/null || true
rm -rf /tmp/mwcode-temp

# Reinstalar dependências se preciso
# pnpm install 2>/dev/null || true

# Iniciar servidor
log "Iniciando servidor..."
cd "$MWCODE_DIR/server"
export PORT="${PORT:-3100}"
npx tsx src/index.ts &
sleep 3

# Verificar se iniciou
if curl -s http://localhost:$PORT/api/health > /dev/null 2>&1; then
    ok "MWCode atualizado!"
    echo ""
    echo "Acesse: http://localhost:$PORT"
else
    echo "Servidor pode não ter iniciado. Verifique manualmente."
fi