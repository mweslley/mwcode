#!/bin/bash
#
# MWCode — Liberar Portas no Firewall
# Execute:
#   curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/setup-porta.sh -o /tmp/setup-porta.sh && bash /tmp/setup-porta.sh
#

set -u

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

log() { echo -e "${CYAN}ℹ${RESET} ${1}"; }
ok() { echo -e "${GREEN}✓${RESET} ${1}"; }
warn() { echo -e "${YELLOW}⚠${RESET} ${1}"; }

MWCODE_DIR="${MWCODE_HOME:-$HOME/.mwcode}"

echo ""
echo -e "${BOLD}🌐 MWCode — Liberar Portas${RESET}"
echo ""

# ============================================================
# 1. Verificar MWCode
# ============================================================
log "Verificando MWCode..."

if [ ! -d "$MWCODE_DIR" ]; then
    err "MWCode não encontrado. Execute o instalador primeiro."
    exit 1
fi

ok "MWCode encontrado"

# ============================================================
# 2. Instalar UFW se necessário
# ============================================================
log "Instalando firewall..."
apt update -qq 2>/dev/null || apt update 2>/dev/null || true
apt install -y ufw 2>/dev/null || true

ok "Firewall instalado"

# ============================================================
# 3. Liberar portas
# ============================================================
log "Liberando portas..."

# SSH (importante!)
ufw allow 22/tcp 2>/dev/null || true

# UI e API
ufw allow 5173/tcp 2>/dev/null || true
ufw allow 3100/tcp 2>/dev/null || true

ok "Portas liberadas: 3100 (API), 5173 (UI)"

echo ""
echo -e "${GREEN}🎉 Tudo pronto!${RESET}"
echo ""
echo "Acesse:"
echo "  UI:  http://SEU_IP:5173"
echo "  API: http://SEU_IP:3100"
echo ""