#!/bin/bash
#
# MWCode — Configurar dostępu via porta
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

echo ""
echo -e "${BOLD}🌐 MWCode — Configurar Acceso via Porta${RESET}"
echo ""

MWCODE_DIR="${MWCODE_HOME:-$HOME/.mwcode}"

# ============================================================
# 1. Verificar MWCode
# ============================================================
log "Verificando MWCode..."

if [ ! -d "$MWCODE_DIR" ]; then
    err "MWCode nao encontrado. Execute o instalador primeiro."
    exit 1
fi

ok "MWCode encontrado"

# ============================================================
# 2. Parar processos anteriores
# ============================================================
log "Parando processos anteriores..."

pkill -f "pnpm dev" 2>/dev/null || true
pkill -f "node.*3100" 2>/dev/null || true

if command -v pm2 >/dev/null 2>&1; then
    pm2 delete mwcode 2>/dev/null || true
    pm2 stop all 2>/dev/null || true
fi

ok "Processos parados"

# ============================================================
# 3. Liberar Firewall
# ============================================================
log "Liberando portas..."

# UFW
sudo ufw allow 3100/tcp 2>/dev/null || true

# Iptables
sudo iptables -I INPUT -p tcp --dport 3100 -j ACCEPT 2>/dev/null || true
sudo iptables -A INPUT -p tcp --dport 3100 -j ACCEPT 2>/dev/null || true

# Cloudflare Security Group (se usar AWS)
# N/A para Cloudflare

ok "Portas liberadas"

# ============================================================
# 4. Iniciar MWCode
# ============================================================
echo ""
echo -e "${BOLD}🚀 Iniciando MWCode...${RESET}"
echo ""

cd "$MWCODE_DIR"

# Iniciar em background
nohup pnpm dev > /tmp/mwcode.log 2>&1 &

# Aguardar
for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 2
    curl -s http://localhost:3100/api/health > /dev/null 2>&1 && break
done

if curl -s http://localhost:3100/api/health > /dev/null 2>&1; then
    ok "MWCode iniciado!"
else
    warn "Verifique os logs: tail /tmp/mwcode.log"
fi

# ============================================================
# 5. Resultado
# ============================================================
echo ""
echo -e "${GREEN}${BOLD}🎉 Pronto!${RESET}"
echo ""
echo "Acesse via navegador:"
echo ""
echo -e "  ${YELLOW}http://SEU_DOMINIO:3100${RESET}"
echo ""
echo "  UI:    http://SEU_DOMINIO:3100"
echo "  API:   http://SEU_DOMINIO:3100/api"
echo ""
echo "No Cloudflare, crie um registro DNS:"
echo "  Tipo: A"
echo "  Nome: (seu-dominio.com)"
echo "  Valor: (IP da VPS)"
echo ""