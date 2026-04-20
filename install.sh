#!/usr/bin/env bash
#
# MWCode — Instalador oficial
# Uso:
#   curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/install.sh | bash
#
set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
RESET='\033[0m'

INSTALL_DIR="${MWCODE_HOME:-$HOME/.mwcode}"
REPO_URL="https://github.com/mweslley/mwcode.git"
BRANCH="${MWCODE_BRANCH:-main}"

echo -e "${BOLD}🚀 MWCode — Instalador${RESET}"
echo ""

# --- Verificar Node.js ---
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗${RESET} Node.js não encontrado."
    echo "   Instale Node 20+ em https://nodejs.org"
    echo "   Ou via nvm: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
    exit 1
fi

NODE_MAJOR=$(node -v | sed 's/v//' | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
    echo -e "${RED}✗${RESET} Node.js v$NODE_MAJOR é muito antigo. Precisa de 20+."
    exit 1
fi
echo -e "${GREEN}✓${RESET} Node $(node -v)"

# --- Verificar git ---
if ! command -v git &> /dev/null; then
    echo -e "${RED}✗${RESET} git não encontrado. Instale git primeiro."
    exit 1
fi
echo -e "${GREEN}✓${RESET} git"

# --- Instalar pnpm se não tiver ---
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}📦${RESET} Instalando pnpm..."
    npm install -g pnpm >/dev/null 2>&1 || {
        echo -e "${RED}✗${RESET} Falha ao instalar pnpm. Tente: sudo npm install -g pnpm"
        exit 1
    }
fi
echo -e "${GREEN}✓${RESET} pnpm $(pnpm --version)"

# --- Clonar ou atualizar ---
if [ -d "$INSTALL_DIR/.git" ]; then
    echo -e "${YELLOW}📂${RESET} Atualizando instalação em $INSTALL_DIR..."
    cd "$INSTALL_DIR"
    git fetch --quiet
    git reset --hard "origin/$BRANCH" --quiet
else
    echo -e "${YELLOW}📂${RESET} Clonando MWCode em $INSTALL_DIR..."
    git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR" --quiet
    cd "$INSTALL_DIR"
fi

# --- Instalar dependências ---
echo -e "${YELLOW}📦${RESET} Instalando dependências (pode demorar alguns minutos)..."
pnpm install --silent

# --- Criar .env se não existir ---
if [ ! -f "$INSTALL_DIR/.env" ]; then
    cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
    echo -e "${GREEN}✓${RESET} .env criado em $INSTALL_DIR/.env"
fi

# --- Tornar bin executável ---
chmod +x "$INSTALL_DIR/bin/mwcode.js" 2>/dev/null || true

# --- Criar symlink do comando mwcode ---
BIN_DIR="${MWCODE_BIN_DIR:-/usr/local/bin}"

if [ -w "$BIN_DIR" ]; then
    ln -sf "$INSTALL_DIR/bin/mwcode.js" "$BIN_DIR/mwcode"
    echo -e "${GREEN}✓${RESET} Comando 'mwcode' disponível em $BIN_DIR"
elif command -v sudo &> /dev/null; then
    echo -e "${YELLOW}🔐${RESET} Precisa de sudo para criar link em $BIN_DIR..."
    sudo ln -sf "$INSTALL_DIR/bin/mwcode.js" "$BIN_DIR/mwcode"
    echo -e "${GREEN}✓${RESET} Comando 'mwcode' instalado"
else
    LOCAL_BIN="$HOME/.local/bin"
    mkdir -p "$LOCAL_BIN"
    ln -sf "$INSTALL_DIR/bin/mwcode.js" "$LOCAL_BIN/mwcode"
    echo -e "${GREEN}✓${RESET} Comando 'mwcode' instalado em $LOCAL_BIN"
    echo -e "${YELLOW}⚠${RESET}  Adicione ao PATH: export PATH=\$HOME/.local/bin:\$PATH"
fi

echo ""
echo -e "${GREEN}${BOLD}🎉 Instalação concluída!${RESET}"
echo ""
echo -e "${BOLD}Próximos passos:${RESET}"
echo "  1. Configure sua chave de API em: ${YELLOW}$INSTALL_DIR/.env${RESET}"
echo "     (recomendado: OPENROUTER_API_KEY — tem modelos grátis)"
echo "  2. Inicie o MWCode:"
echo "       ${GREEN}mwcode${RESET}"
echo ""
echo -e "  Interface: ${BOLD}http://localhost:5173${RESET}"
echo -e "  API:       ${BOLD}http://localhost:3100${RESET}"
echo ""
