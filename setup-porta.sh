#!/bin/bash
#
# MWCode — Configuraracceso via puerta
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
echo -e "${BOLD}🌐 MWCode — Configurar Acceso via Puerta${RESET}"
echo ""

MWCODE_DIR="${MWCODE_HOME:-$HOME/.mwcode}"

# ============================================================
# 1. Verificar MWCode
# ============================================================
log "Verificando MWCode..."

if [ ! -d "$MWCODE_DIR" ]; then
    err "MWCode no encontrado. Execute el instalador primero."
    exit 1
fi

ok "MWCode encontrado"

# ============================================================
# 2. INSTALAR UFW Y LIBERAR PUERTAS
# ============================================================
log "Atualizando e instalando UFW..."

# Atualizar pacotes primeiro
apt update -qq 2>/dev/null || apt update 2>/dev/null || true

# Instalar UFW
if ! command -v ufw >/dev/null 2>&1; then
    apt install -y ufw 2>/dev/null || true
fi

# Configurar reglas
if command -v ufw >/dev/null 2>&1; then
    ufw allow 22/tcp 2>/dev/null || true
    ufw allow 3100/tcp 2>/dev/null || true
    ufw allow 5173/tcp 2>/dev/null || true
    ok "UFW instalado y puertos liberados (3100, 5173)"
else
    iptables -I INPUT -p tcp --dport 3100 -j ACCEPT 2>/dev/null || true
    iptables -I INPUT -p tcp --dport 5173 -j ACCEPT 2>/dev/null || true
    ok "Puertos liberados (iptables)"
fi

# Configurar reglas
if command -v ufw >/dev/null 2>&1; then
    ufw allow 22/tcp 2>/dev/null || true
    ufw allow 3100/tcp 2>/dev/null || true
    ufw allow 5173/tcp 2>/dev/null || true
    ok "UFW instalado y puertos liberados (3100, 5173)"
else
    # Fallback iptables
    iptables -I INPUT -p tcp --dport 3100 -j ACCEPT 2>/dev/null || true
    iptables -I INPUT -p tcp --dport 5173 -j ACCEPT 2>/dev/null || true
    ok "Puertos liberados (iptables)"
fi

# ============================================================
# 3. Parar procesos anteriores
# ============================================================
log "Parando procesos anteriores..."

pkill -f "pnpm dev" 2>/dev/null || true
pkill -f "node.*3100" 2>/dev/null || true

if command -v pm2 >/dev/null 2>&1; then
    pm2 delete mwcode 2>/dev/null || true
    pm2 stop all 2>/dev/null || true
fi

ok "Procesos parados"

# ============================================================
# 4. Iniciar MWCode
# ============================================================
echo ""
echo -e "${BOLD}🚀 Iniciando MWCode...${RESET}"
echo ""

cd "$MWCODE_DIR"

# Iniciar en background
nohup pnpm dev > /tmp/mwcode.log 2>&1 &

# Aguardar
for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 2
    curl -s http://localhost:3100/api/health > /dev/null 2>&1 && break
done

if curl -s http://localhost:3100/api/health > /dev/null 2>&1; then
    ok "MWCode iniciado!"
else
    warn "Verifique los logs: tail /tmp/mwcode.log"
fi

# ============================================================
# 5. Resultado
# ============================================================
echo ""
echo -e "${GREEN}${BOLD}🎉 Listo!${RESET}"
echo ""
echo "Acceda via navegador:"
echo ""
echo -e "  ${YELLOW}http://SU_DOMINIO:3100${RESET}"
echo -e "  ${YELLOW}http://SU_DOMINIO:5173${RESET}"
echo ""
echo "  UI:    http://SU_DOMINIO:5173"
echo "  API:   http://SU_DOMINIO:3100"
echo ""