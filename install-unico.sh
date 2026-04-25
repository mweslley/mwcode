#!/bin/bash
#
# MWCode — Instalador Único Universal
# Execute este comando:
#   curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/install-unico.sh | bash
#
set -euo pipefail

# IMPORTANTE: Mudar para diretório seguro antes de tudo
cd /tmp || cd ~ || cd /

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
die() { err "$1"; exit 1; }

has() { command -v "$1" &>/dev/null; }

INSTALL_DIR="${MWCODE_HOME:-$HOME/.mwcode}"
BIN_DIR="${MWCODE_BIN:-$HOME/.local/bin}"

log "${BOLD}🚀 MWCode — Instalador Único${RESET}"
log ""

# ============================================================
# 0. Detectar SO
# ============================================================
OS="$(uname -s)"
log "Sistema: $OS"

case "$OS" in
    Linux*)     IS_LINUX=1; IS_MAC=0; IS_WINDOWS=0 ;;
    Darwin*)   IS_LINUX=0; IS_MAC=1; IS_WINDOWS=0 ;;
    MINGW*|MSYS*|CYGWW*) IS_LINUX=0; IS_MAC=0; IS_WINDOWS=1 ;;
    *)        die "SO não suportado: $OS" ;;
esac

# ============================================================
# 1. Limpar instalação anterior
# ============================================================
log "Verificando instalação anterior..."

if [ -d "$INSTALL_DIR" ]; then
    log "Removendo instalação anterior: $INSTALL_DIR"
    rm -rf "$INSTALL_DIR"
    ok "Instalação anterior removida"
fi

# Remover symlinks antigos
for dir in "$BIN_DIR" /usr/local/bin "$HOME/bin"; do
    [ -L "$dir/mwcode" ] && rm -f "$dir/mwcode" 2>/dev/null || true
done

log ""

# ============================================================
# 2. Node.js 20+
# ============================================================
log "Verificando Node.js..."

NODE_OK=false
if has node; then
    NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VER" -ge 20 ]; then
        NODE_OK=true
    fi
fi

if [ "$NODE_OK" = false ]; then
    warn "Node.js 20+ não encontrado. Instalando..."

    if [ "$IS_MAC" -eq 1 ] && has brew; then
        brew install node@20
    elif [ -f /etc/debian_version ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - || die "Falha ao instalar Node.js"
        sudo apt-get install -y nodejs
    elif [ -f /etc/redhat-release ]; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - || die "Falha ao instalar Node.js"
        sudo dnf install -y nodejs
    else
        # Fallback: nvm
        export NVM_DIR="$HOME/.nvm"
        [ ! -d "$NVM_DIR" ] && curl -o /tmp/nvm.sh https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh
        . /tmp/nvm.sh || source /tmp/nvm.sh
        nvm install 20
        nvm use 20
        nvm alias default 20
        export PATH="$NVM_DIR/versions/node/v20.x/bin:$PATH"
    fi
fi

has node || die "Node.js não instalado"
ok "Node.js: $(node -v)"

# ============================================================
# 3. pnpm
# ============================================================
log "Instalando pnpm..."

# IMPORTANTE: Mudar para diretório válido antes de instalar
cd /tmp 2>/dev/null || cd ~ || cd /

if ! has pnpm; then
    npm install -g pnpm 2>/dev/null || sudo npm install -g pnpm 2>/dev/null || true
fi

# VOLTAR PARA DIRETÓRIO SEGURO APÓS INSTALAR
cd /tmp 2>/dev/null || cd ~ || cd /

has pnpm || die "pnpm não instalado"
ok "pnpm: $(pnpm -v)"

# ============================================================
# 4. Baixar MWCode do GitHub
# ============================================================
log "Baixando MWCode..."

# IMPORTANTE: Garantir que estamos em diretório válido
cd /tmp 2>/dev/null || cd ~ || cd /

# Remover diretório anterior com segurança
rm -rf "$INSTALL_DIR" 2>/dev/null || true
mkdir -p "$INSTALL_DIR"
git clone --depth 1 --branch main https://github.com/mweslley/mwcode.git "$INSTALL_DIR" || die "Falha ao clonar"

cd "$INSTALL_DIR"

ok "MWCode baixado: $INSTALL_DIR"

# ============================================================
# 5. Corrigir bugs no instalador
# ============================================================
log "Verificando correções..."

# Corrigir mkdir_safe no install.sh
if grep -q "mkdir_safe" install.sh 2>/dev/null; then
    sed -i 's/mkdir_safe/mkdir -p/g' install.sh
    ok "Bug install.sh corrigido"
fi

log ""

# ============================================================
# 6. Instalar dependências
# ============================================================
log "Instalando dependências..."
pnpm install || die "Falha ao instalar dependências"
ok "Dependências instaladas"

# ============================================================
# 7. Criar .env
# ============================================================
if [ ! -f .env ]; then
    cp .env.example .env
    chmod 600 .env
    ok ".env criado"
fi

# ============================================================
# 8. Criar symlink do comando
# ============================================================
log "Criando comando 'mwcode'..."

mkdir -p "$BIN_DIR"
ln -sf "$INSTALL_DIR/bin/mwcode.js" "$BIN_DIR/mwcode"

if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    warn "Adicione ao PATH: export PATH=\"$BIN_DIR:\$PATH\""
fi

ok "Comando 'mwcode' disponível"

# ============================================================
# 9. Liberar porta no firewall
# ============================================================
log "Liberando porta 3100..."

if has ufw; then
    sudo ufw allow 3100/tcp 2>/dev/null || true
    ok "Porta 3100 liberada (ufw)"
elif has firewall-cmd; then
    sudo firewall-cmd --add-port=3100/tcp --permanent 2>/dev/null || true
    sudo firewall-cmd --reload 2>/dev/null || true
    ok "Porta 3100 liberada (firewall)"
elif has iptables; then
    sudo iptables -I INPUT -p tcp --dport 3100 -j ACCEPT 2>/dev/null || true
    ok "Porta 3100 liberada (iptables)"
else
    ok "Porta 3100 (pode precisar configurar manualmente)"
fi

log ""

# ============================================================
# Final
# ============================================================
log "${GREEN}${BOLD}🎉 Instalação concluída!${RESET}"
log ""
log "${BOLD}Próximos passos:${RESET}"
log "  1. Configure sua chave de API:"
log "       ${YELLOW}nano $INSTALL_DIR/.env${RESET}"
log "     (adicione: OPENROUTER_API_KEY=sk-or-v1-...)"
log ""
log "  2. Inicie o MWCode:"
log "       ${GREEN}mwcode${RESET}"
log "     ${DIM}ou${RESET}"
log "       ${GREEN}cd $INSTALL_DIR && pnpm dev${RESET}"
log ""
log "${BOLD}Acesso:${RESET}"
log "  UI:    ${GREEN}http://localhost:5173${RESET}"
log "  API:   ${GREEN}http://localhost:3100${RESET}"
log "  Saúde: ${GREEN}http://localhost:3100/api/health${RESET}"
log ""

# Oferecer iniciar
read -p "$(echo -e '${CYAN}Deseja iniciar agora? (s/n): ${RESET}')" -n 1 -r resposta
echo
if [[ "$resposta" =~ ^[Ss]$ ]]; then
    log ""
    log "${CYAN}🚀 Iniciando MWCode...${RESET}"
    cd "$INSTALL_DIR"
    pnpm dev &
    sleep 3
    ok "MWCode iniciado!"
    log ""
    log "Acesse: http://localhost:5173"
    
    # Abrir navegador se disponível
    if has xdg-open; then
        xdg-open http://localhost:5173 2>/dev/null &
    elif has open; then
        open http://localhost:5173 2>/dev/null &
    fi
fi