#!/usr/bin/env bash
#
# MWCode — Instalador oficial (auto-instala dependências)
# Uso:
#   curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/install.sh | bash
#
# Variáveis opcionais:
#   MWCODE_HOME=/caminho      (padrão: ~/.mwcode)
#   MWCODE_BIN_DIR=/caminho   (padrão: /usr/local/bin)
#   MWCODE_BRANCH=main        (padrão: main)
#   MWCODE_SKIP_DEPS=1        (pula auto-install de dependências do sistema)
#
set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
RESET='\033[0m'

INSTALL_DIR="${MWCODE_HOME:-$HOME/.mwcode}"
REPO_URL="https://github.com/mweslley/mwcode.git"
BRANCH="${MWCODE_BRANCH:-main}"

echo -e "${BOLD}🚀 MWCode — Instalador${RESET}"
echo ""

# ============================================================
# Detectar sudo
# ============================================================
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
    if command -v sudo &> /dev/null; then
        SUDO="sudo"
    else
        echo -e "${YELLOW}⚠${RESET}  Você não é root e sudo não está disponível."
        echo "   Algumas instalações podem falhar."
    fi
fi

# ============================================================
# Detectar sistema operacional e gerenciador de pacotes
# ============================================================
OS="unknown"
PKG_MGR=""
PKG_UPDATE=""
PKG_INSTALL=""

if [ "$(uname)" = "Darwin" ]; then
    OS="macos"
    if command -v brew &> /dev/null; then
        PKG_MGR="brew"
        PKG_UPDATE="brew update"
        PKG_INSTALL="brew install"
    fi
elif [ -f /etc/os-release ]; then
    . /etc/os-release
    OS="${ID:-linux}"

    if command -v apt-get &> /dev/null; then
        PKG_MGR="apt"
        PKG_UPDATE="$SUDO apt-get update -qq"
        PKG_INSTALL="$SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y -qq"
    elif command -v dnf &> /dev/null; then
        PKG_MGR="dnf"
        PKG_UPDATE="$SUDO dnf check-update -q || true"
        PKG_INSTALL="$SUDO dnf install -y -q"
    elif command -v yum &> /dev/null; then
        PKG_MGR="yum"
        PKG_UPDATE="$SUDO yum check-update -q || true"
        PKG_INSTALL="$SUDO yum install -y -q"
    elif command -v pacman &> /dev/null; then
        PKG_MGR="pacman"
        PKG_UPDATE="$SUDO pacman -Sy --noconfirm"
        PKG_INSTALL="$SUDO pacman -S --noconfirm --needed"
    elif command -v apk &> /dev/null; then
        PKG_MGR="apk"
        PKG_UPDATE="$SUDO apk update"
        PKG_INSTALL="$SUDO apk add --no-cache"
    elif command -v zypper &> /dev/null; then
        PKG_MGR="zypper"
        PKG_UPDATE="$SUDO zypper refresh"
        PKG_INSTALL="$SUDO zypper install -y"
    fi
fi

if [ -n "$PKG_MGR" ]; then
    echo -e "${GREEN}✓${RESET} Sistema: ${BOLD}$OS${RESET} (gerenciador: $PKG_MGR)"
else
    echo -e "${YELLOW}⚠${RESET}  Sistema não reconhecido — auto-install de dependências desativado"
fi
echo ""

# ============================================================
# Função: instalar pacote se não existir
# ============================================================
install_pkg() {
    local cmd="$1"
    local pkg_apt="${2:-$1}"
    local pkg_dnf="${3:-$pkg_apt}"
    local pkg_pacman="${4:-$pkg_apt}"
    local pkg_apk="${5:-$pkg_apt}"
    local pkg_brew="${6:-$pkg_apt}"
    local pkg_zypper="${7:-$pkg_apt}"

    if command -v "$cmd" &> /dev/null; then
        return 0
    fi

    if [ "${MWCODE_SKIP_DEPS:-0}" = "1" ]; then
        echo -e "${RED}✗${RESET} $cmd não encontrado (MWCODE_SKIP_DEPS=1 — pulando auto-install)"
        return 1
    fi

    echo -e "${YELLOW}📦${RESET} Instalando $cmd..."

    case "$PKG_MGR" in
        apt)     $PKG_INSTALL "$pkg_apt" ;;
        dnf)     $PKG_INSTALL "$pkg_dnf" ;;
        yum)     $PKG_INSTALL "$pkg_dnf" ;;
        pacman)  $PKG_INSTALL "$pkg_pacman" ;;
        apk)     $PKG_INSTALL "$pkg_apk" ;;
        brew)    $PKG_INSTALL "$pkg_brew" ;;
        zypper)  $PKG_INSTALL "$pkg_zypper" ;;
        *)
            echo -e "${RED}✗${RESET} Não sei instalar '$cmd' nesse sistema. Instale manualmente."
            return 1
            ;;
    esac
}

# ============================================================
# 1. Atualizar índice de pacotes (uma vez só)
# ============================================================
if [ -n "$PKG_MGR" ] && [ "${MWCODE_SKIP_DEPS:-0}" != "1" ]; then
    echo -e "${BLUE}🔄${RESET} Atualizando índice de pacotes..."
    eval "$PKG_UPDATE" >/dev/null 2>&1 || echo -e "${YELLOW}⚠${RESET}  Falha ao atualizar (continuando)"
fi

# ============================================================
# 2. Dependências básicas do sistema
# ============================================================
# curl (geralmente já existe, mas garante)
install_pkg curl curl curl curl curl curl curl

# git — essencial pra clonar
install_pkg git git git git git git git
echo -e "${GREEN}✓${RESET} git $(git --version | awk '{print $3}')"

# ca-certificates — SSL pra Node baixar coisas
if [ "$PKG_MGR" = "apt" ] || [ "$PKG_MGR" = "apk" ]; then
    $PKG_INSTALL ca-certificates >/dev/null 2>&1 || true
fi

# build tools (pra compilar módulos nativos do npm, ex: bcrypt, sqlite3)
echo -e "${BLUE}🔧${RESET} Verificando ferramentas de build (pra módulos nativos)..."
case "$PKG_MGR" in
    apt)
        if ! dpkg -s build-essential >/dev/null 2>&1; then
            echo -e "${YELLOW}📦${RESET} Instalando build-essential + python3..."
            $PKG_INSTALL build-essential python3 >/dev/null 2>&1 || true
        fi
        ;;
    dnf|yum)
        $PKG_INSTALL gcc gcc-c++ make python3 >/dev/null 2>&1 || true
        ;;
    pacman)
        $PKG_INSTALL base-devel python >/dev/null 2>&1 || true
        ;;
    apk)
        $PKG_INSTALL build-base python3 >/dev/null 2>&1 || true
        ;;
    brew)
        # macOS já tem Xcode Command Line Tools (ou pede pra instalar)
        xcode-select --install >/dev/null 2>&1 || true
        ;;
    zypper)
        $PKG_INSTALL -t pattern devel_basis >/dev/null 2>&1 || true
        $PKG_INSTALL python3 >/dev/null 2>&1 || true
        ;;
esac

# ============================================================
# 3. Node.js 20+
# ============================================================
install_node() {
    echo -e "${YELLOW}📦${RESET} Instalando Node.js 20..."

    case "$PKG_MGR" in
        apt)
            # NodeSource (oficial)
            curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash - >/dev/null 2>&1
            $PKG_INSTALL nodejs
            ;;
        dnf|yum)
            curl -fsSL https://rpm.nodesource.com/setup_20.x | $SUDO bash - >/dev/null 2>&1
            $PKG_INSTALL nodejs
            ;;
        pacman)
            $PKG_INSTALL nodejs npm
            ;;
        apk)
            $PKG_INSTALL nodejs npm
            ;;
        brew)
            $PKG_INSTALL node@20
            brew link --overwrite --force node@20 2>/dev/null || true
            ;;
        zypper)
            $PKG_INSTALL nodejs20 npm20
            ;;
        *)
            echo -e "${RED}✗${RESET} Instale Node 20+ manualmente: https://nodejs.org"
            echo "   Ou via nvm: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
            exit 1
            ;;
    esac
}

if ! command -v node &> /dev/null; then
    install_node
else
    NODE_MAJOR=$(node -v | sed 's/v//' | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -lt 20 ]; then
        echo -e "${YELLOW}⚠${RESET}  Node v$NODE_MAJOR é muito antigo. Atualizando para v20..."
        install_node
    fi
fi
echo -e "${GREEN}✓${RESET} Node $(node -v)"

# npm (geralmente vem com Node, mas confere)
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗${RESET} npm não encontrado após instalar Node. Algo deu errado."
    exit 1
fi
echo -e "${GREEN}✓${RESET} npm $(npm --version)"

# ============================================================
# 4. pnpm 8+
# ============================================================
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}📦${RESET} Instalando pnpm..."
    if $SUDO npm install -g pnpm@latest >/dev/null 2>&1; then
        :
    else
        # fallback: instalador oficial
        curl -fsSL https://get.pnpm.io/install.sh | sh - >/dev/null 2>&1
        export PATH="$HOME/.local/share/pnpm:$PATH"
    fi
fi

if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}✗${RESET} Falha ao instalar pnpm."
    echo "   Tente manualmente: npm install -g pnpm"
    exit 1
fi
echo -e "${GREEN}✓${RESET} pnpm $(pnpm --version)"

# ============================================================
# 5. Clonar ou atualizar
# ============================================================
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

# ============================================================
# 6. Instalar dependências do projeto
# ============================================================
echo -e "${YELLOW}📦${RESET} Instalando dependências do projeto (pode demorar alguns minutos)..."
pnpm install --silent || {
    echo -e "${YELLOW}⚠${RESET}  Falha silenciosa no pnpm install. Tentando com output completo..."
    pnpm install
}

# ============================================================
# 7. Criar .env se não existir
# ============================================================
if [ ! -f "$INSTALL_DIR/.env" ]; then
    cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
    chmod 600 "$INSTALL_DIR/.env"
    echo -e "${GREEN}✓${RESET} .env criado em $INSTALL_DIR/.env (permissão 600)"
fi

# ============================================================
# 8. Permissões do binário
# ============================================================
chmod +x "$INSTALL_DIR/bin/mwcode.js" 2>/dev/null || true

# ============================================================
# 9. Criar symlink do comando mwcode
# ============================================================
BIN_DIR="${MWCODE_BIN_DIR:-/usr/local/bin}"

if [ -w "$BIN_DIR" ]; then
    ln -sf "$INSTALL_DIR/bin/mwcode.js" "$BIN_DIR/mwcode"
    echo -e "${GREEN}✓${RESET} Comando 'mwcode' disponível em $BIN_DIR"
elif [ -n "$SUDO" ]; then
    echo -e "${YELLOW}🔐${RESET} Criando link em $BIN_DIR (requer sudo)..."
    $SUDO ln -sf "$INSTALL_DIR/bin/mwcode.js" "$BIN_DIR/mwcode"
    echo -e "${GREEN}✓${RESET} Comando 'mwcode' instalado"
else
    LOCAL_BIN="$HOME/.local/bin"
    mkdir -p "$LOCAL_BIN"
    ln -sf "$INSTALL_DIR/bin/mwcode.js" "$LOCAL_BIN/mwcode"
    echo -e "${GREEN}✓${RESET} Comando 'mwcode' instalado em $LOCAL_BIN"
    if ! echo "$PATH" | grep -q "$LOCAL_BIN"; then
        echo -e "${YELLOW}⚠${RESET}  Adicione ao PATH: ${BOLD}export PATH=\$HOME/.local/bin:\$PATH${RESET}"
    fi
fi

# ============================================================
# Final
# ============================================================
echo ""
echo -e "${GREEN}${BOLD}🎉 Instalação concluída!${RESET}"
echo ""
echo -e "${BOLD}Próximos passos:${RESET}"
echo "  1. Configure sua chave de API:"
echo "       ${YELLOW}nano $INSTALL_DIR/.env${RESET}"
echo "     (recomendado: OPENROUTER_API_KEY — tem modelos grátis)"
echo ""
echo "  2. Inicie o MWCode:"
echo "       ${GREEN}mwcode${RESET}"
echo ""
echo -e "  Interface: ${BOLD}http://localhost:5173${RESET}"
echo -e "  API:       ${BOLD}http://localhost:3100${RESET}"
echo ""
echo -e "  Para VPS/produção: ${BLUE}https://github.com/mweslley/mwcode/blob/main/doc/VPS.md${RESET}"
echo ""
