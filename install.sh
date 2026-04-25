#!/usr/bin/env bash
#
# MWCode — Instalador completo (limpa + instala dependências + comando)
# Uso:
#   # Remoto:
#   curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/install.sh | bash
#   # Local:
#   ./install.sh
#
# Variáveis:
#   MWCODE_HOME=~/.mwcode       (diretório de instalação)
#   MWCODE_BRANCH=main           (branch git)
#
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
RESET='\033[0m'

INSTALL_DIR="${MWCODE_HOME:-$HOME/.mwcode}"
BIN_DIR="${MWCODE_BIN_DIR:-$HOME/.local/bin}"
REPO_URL="https://github.com/mweslley/mwcode.git"
BRANCH="${MWCODE_BRANCH:-main}"

log() { echo -e "${CYAN}ℹ${RESET} ${1}"; }
ok() { echo -e "${GREEN}✓${RESET} ${1}"; }
warn() { echo -e "${YELLOW}⚠${RESET} ${1}"; }
err() { echo -e "${RED}✗${RESET} ${1}"; }
step() { echo -e "${BLUE}▶${RESET} ${1}"; }

has() { command -v "$1" &>/dev/null; }

die() { err "$1"; exit 1; }

is_wsl() { grep -qEi 'microsoft|wsl' /proc/version 2>/dev/null; }
is_macos() { [ "$(uname)" = "Darwin" ]; }

# run as root if needed
run() { "$@"; }
runsudo() {
    if [ "$(id -u)" -eq 0 ]; then
        "$@"
    elif has sudo; then
        sudo "$@"
    else
        err "sudo não disponível"
        return 1
    fi
}

cd_safe() {
    cd "$1" || die "Não foi possível acessar $1"
}

log "${BOLD}🚀 MWCode — Instalador${RESET}"
log ""

# ============================================================
# 0. Detectar fonte (local ou remoto)
# ============================================================
if [ -d ".git" ]; then
    SOURCE_DIR="$(pwd)"
    LOCAL=true
    log "${BLUE}📁${RESET} Fonte: diretório local ($SOURCE_DIR)"
else
    LOCAL=false
    log "${BLUE}🌐${RESET} Fonte: GitHub ($REPO_URL)"
fi
log ""

# ============================================================
# 1. Limpar instalação anterior
# ============================================================
CLEANED=false
if [ -L "$BIN_DIR/mwcode" ] || [ -f "$BIN_DIR/mwcode" ]; then
    step "Limpando symlink anterior..."
    rm -f "$BIN_DIR/mwcode" 2>/dev/null || runsudo rm -f "$BIN_DIR/mwcode"
    ok "Link removido: $BIN_DIR/mwcode"
    CLEANED=true
fi

if [ -d "$INSTALL_DIR" ]; then
    step "Limpando diretório anterior..."
    rm -rf "$INSTALL_DIR" || runsudo rm -rf "$INSTALL_DIR"
    ok "Diretório removido: $INSTALL_DIR"
    CLEANED=true
fi

if [ "$CLEANED" = true ]; then
    log ""
fi

# ============================================================
# 2. Verificar/criar BIN_DIR
# ============================================================
mkdir -p "$BIN_DIR"

# ============================================================
# 3. Verificar dependências do sistema
# ============================================================
step "Verificando dependências..."

has git || die "git não instalado. Instale: https://git-scm.com"
ok "git: $(git --version | cut -d' ' -f3)"

has curl || die "curl não instalado"
ok "curl"

# ============================================================
# 4. Node.js 20+
# ============================================================
NODE_OK=false
if has node; then
    NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VER" -ge 20 ]; then
        NODE_OK=true
    fi
fi

if [ "$NODE_OK" = false ]; then
    warn "Node.js 20+ não encontrado. Instalando..."

    if is_macos && has brew; then
        brew install node@20
    elif [ -f /etc/debian_version ]; then
        # Debian/Ubuntu
        runsudo apt-get update -qq
        runsudo apt-get install -y -qq curl
        curl -fsSL https://deb.nodesource.com/setup_20.x | runsudo bash -
        runsudo apt-get install -y -qq nodejs
    elif [ -f /etc/redhat-release ]; then
        # RHEL/CentOS/Fedora
        curl -fsSL https://rpm.nodesource.com/setup_20.x | runsudo bash -
        runsudo dnf install -y nodejs
    else
        # Fallback: install nvm
        export NVM_DIR="$HOME/.nvm"
        if [ ! -d "$NVM_DIR" ]; then
            curl -o /tmp/nvm-install.sh https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh
            bash /tmp/nvm-install.sh
        fi
        . "$NVM_DIR/nvm.sh"
        nvm install 20
        nvm use 20
        nvm alias default 20
    fi
fi

has node || die "Node.js não instalado"
ok "node: $(node -v)"

has npm || die "npm não instalado"
ok "npm: $(npm -v)"

# ============================================================
# 5. pnpm 8+
# ============================================================
if ! has pnpm; then
    step "Instalando pnpm..."
    npm install -g pnpm
fi

has pnpm || die "pnpm não instalado"
ok "pnpm: $(pnpm -v)"

# ============================================================
# 6. Baixar MWCode
# ============================================================
step "Baixando MWCode..."
log "   Diretório: $INSTALL_DIR"

if [ "$LOCAL" = true ]; then
    mkdir_safe "$INSTALL_DIR"
    cp -r "$SOURCE_DIR"/* "$INSTALL_DIR/"
    # Copiar arquivos ocultos
    for f in "$SOURCE_DIR"/.*; do
        [ -e "$f" ] || continue
        [ "$(basename "$f")" = "." ] && continue
        [ "$(basename "$f")" = ".." ] && continue
        [ "$(basename "$f")" = ".git" ] && continue
        cp -r "$f" "$INSTALL_DIR/"
    done
else
    git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi

cd_safe "$INSTALL_DIR"

# ============================================================
# 7. Instalar dependências do projeto
# ============================================================
step "Instalando dependências..."
pnpm install --silent 2>&1 || pnpm install

# ============================================================
# 8. Criar .env
# ============================================================
if [ ! -f .env ]; then
    cp .env.example .env
    chmod 600 .env
    ok ".env criado"
fi

# ============================================================
# 9. Criar symlink do comando
# ============================================================
ln -sf "$INSTALL_DIR/bin/mwcode.js" "$BIN_DIR/mwcode"
ok "Comando 'mwcode' em $BIN_DIR"

# Verificar se BIN_DIR está no PATH
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    warn "Adicione ao PATH: export PATH=\"$BIN_DIR:\$PATH\""
fi

# ============================================================
# Final
# ============================================================
log ""
log "${GREEN}${BOLD}🎉 Instalação concluída!${RESET}"
log ""
log "${BOLD}Próximos passos:${RESET}"
log "  1. Configure sua chave de API:"
log "       ${YELLOW}nano $INSTALL_DIR/.env${RESET}"
log "     (recomendado: OPENROUTER_API_KEY)"
log ""
log "  2. Inicie o MWCode:"
log "       ${GREEN}mwcode${RESET}"
log ""
log "  UI:  ${BOLD}http://localhost:5173${RESET}"
log "  API: ${BOLD}http://localhost:3100${RESET}"