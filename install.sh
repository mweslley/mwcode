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

# Instalações apt em modo não-interativo
export DEBIAN_FRONTEND=noninteractive

echo -e "${BOLD}🚀 MWCode — Instalador${RESET}"
echo ""

# ============================================================
# Detectar sudo (vazio se já é root)
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

# Helper: roda comando como root (com ou sem sudo)
run_root() {
    if [ -n "$SUDO" ]; then
        sudo "$@"
    else
        "$@"
    fi
}

# ============================================================
# Detectar sistema operacional e gerenciador de pacotes
# ============================================================
OS="unknown"
PKG_MGR=""

if [ "$(uname)" = "Darwin" ]; then
    OS="macos"
    if command -v brew &> /dev/null; then
        PKG_MGR="brew"
    fi
elif [ -f /etc/os-release ]; then
    . /etc/os-release
    OS="${ID:-linux}"

    if command -v apt-get &> /dev/null; then
        PKG_MGR="apt"
    elif command -v dnf &> /dev/null; then
        PKG_MGR="dnf"
    elif command -v yum &> /dev/null; then
        PKG_MGR="yum"
    elif command -v pacman &> /dev/null; then
        PKG_MGR="pacman"
    elif command -v apk &> /dev/null; then
        PKG_MGR="apk"
    elif command -v zypper &> /dev/null; then
        PKG_MGR="zypper"
    fi
fi

if [ -n "$PKG_MGR" ]; then
    echo -e "${GREEN}✓${RESET} Sistema: ${BOLD}$OS${RESET} (gerenciador: $PKG_MGR)"
else
    echo -e "${YELLOW}⚠${RESET}  Sistema não reconhecido — auto-install de dependências desativado"
fi
echo ""

# ============================================================
# Wrappers: pkg_update e pkg_install
# ============================================================
pkg_update() {
    case "$PKG_MGR" in
        apt)     run_root apt-get update -qq ;;
        dnf)     run_root dnf check-update -q || true ;;
        yum)     run_root yum check-update -q || true ;;
        pacman)  run_root pacman -Sy --noconfirm ;;
        apk)     run_root apk update ;;
        zypper)  run_root zypper --non-interactive refresh ;;
        brew)    brew update ;;
        *)       return 0 ;;
    esac
}

pkg_install() {
    case "$PKG_MGR" in
        apt)     run_root apt-get install -y -qq "$@" ;;
        dnf)     run_root dnf install -y -q "$@" ;;
        yum)     run_root yum install -y -q "$@" ;;
        pacman)  run_root pacman -S --noconfirm --needed "$@" ;;
        apk)     run_root apk add --no-cache "$@" ;;
        zypper)  run_root zypper --non-interactive install -y "$@" ;;
        brew)    brew install "$@" ;;
        *)       return 1 ;;
    esac
}

# ============================================================
# Função: instalar um comando se não existir, mapeando nomes de pacote por gerenciador
# ============================================================
ensure_cmd() {
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

    if [ -z "$PKG_MGR" ]; then
        echo -e "${RED}✗${RESET} Não sei instalar '$cmd' nesse sistema. Instale manualmente."
        return 1
    fi

    echo -e "${YELLOW}📦${RESET} Instalando $cmd..."

    case "$PKG_MGR" in
        apt)     pkg_install "$pkg_apt" ;;
        dnf)     pkg_install "$pkg_dnf" ;;
        yum)     pkg_install "$pkg_dnf" ;;
        pacman)  pkg_install "$pkg_pacman" ;;
        apk)     pkg_install "$pkg_apk" ;;
        brew)    pkg_install "$pkg_brew" ;;
        zypper)  pkg_install "$pkg_zypper" ;;
    esac
}

# ============================================================
# 1. Atualizar índice de pacotes (uma vez só)
# ============================================================
if [ -n "$PKG_MGR" ] && [ "${MWCODE_SKIP_DEPS:-0}" != "1" ]; then
    echo -e "${BLUE}🔄${RESET} Atualizando índice de pacotes..."
    pkg_update >/dev/null 2>&1 || echo -e "${YELLOW}⚠${RESET}  Falha ao atualizar (continuando)"
fi

# ============================================================
# 2. Dependências básicas do sistema
# ============================================================
ensure_cmd curl
ensure_cmd git
echo -e "${GREEN}✓${RESET} git $(git --version | awk '{print $3}')"

# ca-certificates — SSL
if [ "$PKG_MGR" = "apt" ] || [ "$PKG_MGR" = "apk" ]; then
    pkg_install ca-certificates >/dev/null 2>&1 || true
fi

# Build tools (pra compilar módulos nativos do npm)
echo -e "${BLUE}🔧${RESET} Verificando ferramentas de build..."
case "$PKG_MGR" in
    apt)
        if ! dpkg -s build-essential >/dev/null 2>&1; then
            echo -e "${YELLOW}📦${RESET} Instalando build-essential + python3..."
            pkg_install build-essential python3 >/dev/null 2>&1 || true
        fi
        ;;
    dnf|yum)
        pkg_install gcc gcc-c++ make python3 >/dev/null 2>&1 || true
        ;;
    pacman)
        pkg_install base-devel python >/dev/null 2>&1 || true
        ;;
    apk)
        pkg_install build-base python3 >/dev/null 2>&1 || true
        ;;
    brew)
        xcode-select --install >/dev/null 2>&1 || true
        ;;
    zypper)
        run_root zypper --non-interactive install -t pattern devel_basis >/dev/null 2>&1 || true
        pkg_install python3 >/dev/null 2>&1 || true
        ;;
esac

# ============================================================
# 3. Node.js 20+
# ============================================================
install_node() {
    echo -e "${YELLOW}📦${RESET} Instalando Node.js 20..."

    case "$PKG_MGR" in
        apt)
            curl -fsSL https://deb.nodesource.com/setup_20.x | run_root bash - >/dev/null 2>&1
            pkg_install nodejs
            ;;
        dnf|yum)
            curl -fsSL https://rpm.nodesource.com/setup_20.x | run_root bash - >/dev/null 2>&1
            pkg_install nodejs
            ;;
        pacman)
            pkg_install nodejs npm
            ;;
        apk)
            pkg_install nodejs npm
            ;;
        brew)
            pkg_install node@20
            brew link --overwrite --force node@20 2>/dev/null || true
            ;;
        zypper)
            pkg_install nodejs20 npm20
            ;;
        *)
            echo -e "${RED}✗${RESET} Instale Node 20+ manualmente: https://nodejs.org"
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

if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗${RESET} npm não encontrado após instalar Node."
    exit 1
fi
echo -e "${GREEN}✓${RESET} npm $(npm --version)"

# ============================================================
# 4. pnpm 8+
# ============================================================
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}📦${RESET} Instalando pnpm..."
    if run_root npm install -g pnpm@latest >/dev/null 2>&1; then
        :
    else
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
    run_root ln -sf "$INSTALL_DIR/bin/mwcode.js" "$BIN_DIR/mwcode"
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
