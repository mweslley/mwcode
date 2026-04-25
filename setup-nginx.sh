#!/bin/bash
#
# MWCode — Configurar Nginx (UI + API)
# Execute:
#   curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/setup-nginx.sh -o /tmp/setup-nginx.sh && bash /tmp/setup-nginx.sh
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
err() { echo -e "${RED}✗${RESET} ${1}"; }

MWCODE_DIR="${MWCODE_HOME:-$HOME/.mwcode}"

echo ""
echo -e "${BOLD}🌐 MWCode — Configurar Nginx${RESET}"
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
# 2. Instalar nginx
# ============================================================
log "Instalando nginx..."
apt update -qq 2>/dev/null || apt update 2>/dev/null || true
apt install -y nginx 2>/dev/null || true

ok "Nginx instalado"

# ============================================================
# 3. Criar config
# ============================================================
log "Criando config..."

cat > /etc/nginx/sites-available/mwcode << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name _;

    # UI (compilada em dist/)
    location / {
        root /root/.mwcode/ui/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API (proxy para server)
    location /api/ {
        proxy_pass http://localhost:3100/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://localhost:3100/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }
}
EOF

# Ativar config
ln -sf /etc/nginx/sites-available/mwcode /etc/nginx/sites-enabled/mwcode
rm -f /etc/nginx/sites-enabled/default

# Testar config
nginx -t

ok "Config criado"

# ============================================================
# 4. Reiniciar nginx
# ============================================================
log "Reiniciando nginx..."
systemctl restart nginx || service nginx restart

ok "Nginx rodando!"

# ============================================================
# 5. Liberar firewall
# ============================================================
ufw allow 80/tcp 2>/dev/null || true
ufw allow 443/tcp 2>/dev/null || true

echo ""
echo -e "${GREEN}🎉 Tudo pronto!${RESET}"
echo ""
echo "Acesse:"
echo "  http://45.165.84.69/"
echo ""