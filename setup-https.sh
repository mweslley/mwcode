#!/bin/bash
#
# MWCode — Configurar HTTPS (Nginx + Let's Encrypt)
# Execute:
#   curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/setup-https.sh -o /tmp/setup-https.sh && bash /tmp/setup-https.sh
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

echo ""
echo -e "${BOLD}🔒 MWCode — Configurar HTTPS${RESET}"
echo ""

# ============================================================
# 1. Verificar MWCode rodando
# ============================================================
log "Verificando MWCode..."

MWCODE_DIR="${MWCODE_HOME:-$HOME/.mwcode}"

if [ ! -d "$MWCODE_DIR" ]; then
    err "MWCode não encontrado. Execute o instalador primeiro."
    exit 1
fi

ok "MWCode encontrado: $MWCODE_DIR"

# ============================================================
# 2. Pedir domínio
# ============================================================
echo ""
echo -e "${BOLD}🌐 Configure seu domínio:${RESET}"
echo ""
echo "  1. Aponte seu domínio para o IP do servidor (DNS A)"
echo "  2. Digite o domínio abaixo"
echo ""
read -p "Domínio (ex: meu-dominio.com): " DOMINIO

if [ -z "$DOMINIO" ]; then
    err "Domínio inválido."
    exit 1
fi

ok "Domínio: $DOMINIO"

# ============================================================
# 3. INSTALAR UFW E LIBERAR PORTAS HTTPS
# ============================================================
log "Atualizando e instalando UFW..."

# Atualizar pacotes primeiro
apt update -qq 2>/dev/null || apt update 2>/dev/null || true

# Instalar UFW
if ! command -v ufw >/dev/null 2>&1; then
    apt install -y ufw 2>/dev/null || true
fi

# Configurar regras
if command -v ufw >/dev/null 2>&1; then
    ufw allow 22/tcp 2>/dev/null || true
    ufw allow 80/tcp 2>/dev/null || true
    ufw allow 443/tcp 2>/dev/null || true
    ok "UFW instalado"
else
    iptables -I INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
    iptables -I INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
fi

# ============================================================
# 4. Instalar nginx
# ============================================================
log "Verificando nginx..."

# Verificar se nginx já está instalado
if ! command -v nginx >/dev/null 2>&1; then
    log "Instalando nginx..."
    apt update -qq && apt install -y nginx 2>/dev/null || true
    ok "nginx instalado"
else
    ok "nginx ja esta instalado"
fi

# ============================================================
# 4. Criar configuração nginx
# ============================================================
log "Configurando nginx..."

NGINX_CONF="/etc/nginx/sites-available/mwcode-$DOMINIO"

sudo tee "$NGINX_CONF" > /dev/null << 'EOF'
server {
    listen 80;
    server_name DOMINIO;

    location / {
        proxy_pass http://localhost:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        proxy_pass http://localhost:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

# Substituir domínio
sudo sed -i "s/DOMINIO/$DOMINIO/g" "$NGINX_CONF"

# Ativar configuração
sudo ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/mwcode-$DOMINIO"

# Desativar configuração padrão se existir
[ -f /etc/nginx/sites-enabled/default ] && sudo rm -f /etc/nginx/sites-enabled/default

# Testar e reiniciar
sudo nginx -t && sudo systemctl reload nginx

ok "nginx configurado"

# ============================================================
# 5. Firewall
# ============================================================
log "Configurando firewall..."

sudo ufw allow 'Nginx Full' 2>/dev/null || true
sudo ufw allow OpenSSH 2>/dev/null || true

ok "Firewall configurado"

# ============================================================
# 6. Instalar certbot
# ============================================================
log "Instalando certbot..."

if ! command -v certbot >/dev/null 2>&1; then
    sudo apt install -y certbot python3-certbot-nginx
fi

ok "certbot instalado"

# ============================================================
# 7. Obter certificado HTTPS
# ============================================================
echo ""
echo -e "${BOLD}🔐 Obtendo certificado HTTPS...${RESET}"
echo ""
echo "O certbot vai pedir:"
echo "  - Seu email"
echo "  - aceitar termos"
echo "  - (opcional) receber emails do Let's Encrypt"
echo ""

read -p "Continuar? (s/n): " CONFIRMA

if [ "$CONFIRMA" != "s" ] && [ "$CONFIRMA" != "S" ]; then
    warn "Cancelado. Configure manualmente depois:"
    echo "  sudo certbot --nginx -d $DOMINIO"
    exit 0
fi

# Tentar obter certificado
log "Obtendo certificado (pode pedir email)..."

sudo certbot --nginx -d "$DOMINIO" --register-unsafely-without-email --agree-tos

if [ $? -eq 0 ]; then
    ok "HTTPS configurado!"
else
    warn "Falha ao obter certificado. Tente novamente mais tarde:"
    echo "  sudo certbot --nginx -d $DOMINIO"
    echo ""
    warn "Por enquanto, HTTP funciona."
fi

# ============================================================
# 8. Mostrar resultado
# ============================================================
echo ""
echo -e "${GREEN}${BOLD}🎉 Configuração concluída!${RESET}"
echo ""
echo "Acesse:"
echo -e "  HTTP:  ${YELLOW}http://$DOMINIO${RESET}"
echo -e "  HTTPS: ${GREEN}https://$DOMINIO${RESET}"
echo ""
echo "UI:     $DOMINIO"
echo "API:    $DOMINIO/api"
echo ""

# ============================================================
# 9. Renovação automática
# ============================================================
log "Configurando renovação automática..."

# Adicionar ao crontab
CRON="@daily certbot renew --quiet --deploy-hook 'systemctl reload nginx'"
(crontab -l 2>/dev/null | grep -q "$CRON") || (crontab -l 2>/dev/null; echo "$CRON") | crontab -

ok "Renovação automática configurada"

echo ""
echo -e "${GREEN}✅ Tudo pronto!${RESET}"