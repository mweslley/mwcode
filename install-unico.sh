#!/bin/bash
#
# MWCode — Instalador Único + Launcher Interativo
# Execute:
#   curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/install-unico.sh | bash
#
# Com variáveis:
#   PROVEDOR=openrouter API_KEY=sk-or-v1-... bash install-unico.sh

set -u

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
DIM='\033[2m'
RESET='\033[0m'

log() { echo -e "${CYAN}ℹ${RESET} ${1}"; }
ok() { echo -e "${GREEN}✓${RESET} ${1}"; }
warn() { echo -e "${YELLOW}⚠${RESET} ${1}"; }
err() { echo -e "${RED}✗${RESET} ${1}"; }

mudar_dir() {
    for dir in /tmp /var/tmp "$HOME" /; do
        if [ -d "$dir" ] && [ -w "$dir" ] 2>/dev/null; then
            cd "$dir" 2>/dev/null && return 0
        fi
    done
    cd / 2>/dev/null && return 0
}

mudar_dir
has() { command -v "$1" &>/dev/null; }

INSTALL_DIR="${MWCODE_HOME:-$HOME/.mwcode}"
BIN_DIR="${MWCODE_BIN:-$HOME/.local/bin}"

echo ""
echo -e "${BOLD}🚀 MWCode — Instalador Único${RESET}"
echo -e "Sistema: $(uname -s)"
echo ""

# ============================================================
# 1. Limpar instalação anterior
# ============================================================
log "Verificando instalação anterior..."
mudar_dir

[ -d "$INSTALL_DIR" ] && rm -rf "$INSTALL_DIR"
ok "Instalação anterior removida"

rm -f "$BIN_DIR/mwcode" 2>/dev/null || true
rm -f "/usr/local/bin/mwcode" 2>/dev/null || true

mudar_dir

# ============================================================
# 2. Node.js 20+
# ============================================================
log "Verificando Node.js..."
mudar_dir

NODE_OK=false
if has node; then
    NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
    [ "$NODE_VER" -ge 20 ] 2>/dev/null && NODE_OK=true
fi

[ "$NODE_OK" = false ] && {
    warn "Node.js 20+ não encontrado."
    echo "Instale primeiro: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -"
    exit 1
}

ok "Node.js: $(node -v)"

mudar_dir

# ============================================================
# 3. pnpm
# ============================================================
log "Instalando pnpm..."
mudar_dir

! has pnpm && npm install -g pnpm 2>/dev/null || sudo npm install -g pnpm 2>/dev/null || true
! has pnpm && { err "pnpm não instalado"; exit 1; }

ok "pnpm: $(pnpm -v)"

mudar_dir

# ============================================================
# 4. Baixar MWCode
# ============================================================
log "Baixando MWCode..."
mudar_dir

TEMP_DIR="/tmp"
[ ! -w "$TEMP_DIR" ] && TEMP_DIR="$HOME"
[ ! -w "$TEMP_DIR" ] && TEMP_DIR="/var/tmp"

rm -rf "$TEMP_DIR/mwcode-temp" 2>/dev/null || true
git clone --depth 1 --branch main https://github.com/mweslley/mwcode.git "$TEMP_DIR/mwcode-temp" || {
    err "Falha ao baixar"
    exit 1
}

cd "$TEMP_DIR/mwcode-temp"
ok "MWCode baixado"

# ============================================================
# 5. Mover para diretório final
# ============================================================
log "Instalando..."
mudar_dir

mkdir -p "$INSTALL_DIR"
cp -r "$TEMP_DIR/mwcode-temp/"* "$INSTALL_DIR/" 2>/dev/null || true
cp -r "$TEMP_DIR/mwcode-temp/."* "$INSTALL_DIR/" 2>/dev/null || true
rm -rf "$TEMP_DIR/mwcode-temp"

cd "$INSTALL_DIR"
ok "MWCode instalado: $INSTALL_DIR"

# ============================================================
# 6. Corrigir bugs
# ============================================================
log "Verificando correções..."
cd "$INSTALL_DIR"
sed -i 's/mkdir_safe/mkdir -p/g' install.sh 2>/dev/null || true
ok "Correções aplicadas"

# ============================================================
# 7. Instalar dependências
# ============================================================
log "Instalando dependências..."
cd "$INSTALL_DIR"
pnpm install || { err "Falha ao instalar dependências"; exit 1; }
ok "Dependências instaladas"

# ============================================================
# 8. Criar .env
# ============================================================
[ ! -f .env ] && cp .env.example .env && chmod 600 .env
ok ".env criado"

# ============================================================
# 9. ESCOLHER PROVEDOR
# ============================================================

# Se PROVEDOR não está definido, verificar se há entrada do usuário
if [ -z "${PROVEDOR:-}" ]; then
    # Tentar detectar modo interativo
    if [ -t 0 ] || [ -t 1 ]; then
        echo ""
        echo -e "${BOLD}🤖 Escolha seu Provedor de IA:${RESET}"
        echo ""
        echo -e "  1. ${GREEN}OpenRouter${RESET}   (Recomendado - modelos gratuitos)"
        echo -e "  2. OpenAI       (GPT-4, GPT-4o)"
        echo -e "  3. Gemini       (Google)"
        echo -e "  4. DeepSeek    (Barato)"
        echo -e "  5. Ollama       (Local)"
        echo ""
        printf "Digite o número (1-5): "
        read -r escolha
    else
        # Pipe - usar padrão ou variável de ambiente
        echo ""
        echo -e "${BOLD}🤖 Provedor:${RESET}"
        echo ""
        echo -e "  Usando: ${GREEN}OpenRouter${RESET} (padrão)"
        echo -e "  Para mudar: PROVEDOR=gemini bash install-unico.sh"
        echo ""
        escolha="1"
    fi
fi

# Processar escolha
case "${escolha:-1}" in
    1) PROVIDER_NAME="openrouter" ;;
    2) PROVIDER_NAME="openai" ;;
    3) PROVIDER_NAME="gemini" ;;
    4) PROVIDER_NAME="deepseek" ;;
    5) PROVIDER_NAME="ollama" ;;
    *) PROVIDER_NAME="${PROVEDOR:-openrouter}" ;;
esac

# Se PROVEDOR foi definido via variável, usar ele
[ -n "${PROVEDOR:-}" ] && PROVIDER_NAME="$PROVEDOR"

echo -e "Provedor: ${YELLOW}$PROVIDER_NAME${RESET}"
echo ""

# ============================================================
# 10. CONFIGURAR CHAVE API
# ============================================================
if [ "$PROVIDER_NAME" != "ollama" ]; then
    case "$PROVIDER_NAME" in
        openrouter) LINK="https://openrouter.ai/keys" ;;
        openai)    LINK="https://platform.openai.com/api-keys" ;;
        gemini)   LINK="https://aistudio.google.com/app/apikey" ;;
        deepseek) LINK="https://platform.deepseek.com/api-keys" ;;
    esac
    
    # Verificar se tem API_KEY da variável
    if [ -n "${API_KEY:-}" ]; then
        echo "Usando API_KEY da variável de ambiente."
    elif [ -t 0 ] || [ -t 1 ]; then
        echo -e "${BOLD}🔑 Configure sua chave API:${RESET}"
        echo "  Pegue em: $LINK"
        echo ""
        printf "Cole sua chave API: "
        read -r API_KEY
    else
        echo -e "${YELLOW}⚠ Sem chave API. Configure manualmente depois.${RESET}"
        echo "  Edite: nano $INSTALL_DIR/.env"
        API_KEY=""
    fi
    
    if [ -n "$API_KEY" ]; then
        case "$PROVIDER_NAME" in
            openrouter) echo "OPENROUTER_API_KEY=$API_KEY" >> .env ;;
            openai)     echo "OPENAI_API_KEY=$API_KEY" >> .env ;;
            gemini)    echo "GEMINI_API_KEY=$API_KEY" >> .env ;;
            deepseek)  echo "DEEPSEEK_API_KEY=$API_KEY" >> .env ;;
        esac
        echo "MWCODE_PROVIDER=$PROVIDER_NAME" >> .env
        ok "Chave API salva!"
    fi
else
    echo "OLLAMA_BASE_URL=http://localhost:11434" >> .env
    echo "MWCODE_PROVIDER=ollama" >> .env
    ok "Ollama configurado"
fi

# ============================================================
# 11. Criar comando
# ============================================================
log "Criando comando..."
cd "$INSTALL_DIR"
mkdir -p "$BIN_DIR"
ln -sf "$INSTALL_DIR/bin/mwcode.js" "$BIN_DIR/mwcode"
ok "Comando 'mwcode' disponível"

# ============================================================
# 12. Liberar porta
# ============================================================
log "Liberando porta 3100..."
sudo ufw allow 3100/tcp 2>/dev/null || true
ok "Porta 3100 liberada"

cd "$INSTALL_DIR"

echo ""
echo -e "${GREEN}${BOLD}🎉 Instalação concluída!${RESET}"
echo ""
echo "Acesso:"
echo -e "  UI:    ${GREEN}http://localhost:5173${RESET}"
echo -e "  API:   ${GREEN}http://localhost:3100${RESET}"
echo ""

# ============================================================
# 13. INICIAR
# ============================================================
echo -e "${CYAN}🚀 Iniciando MWCode...${RESET}"
echo ""

cd "$INSTALL_DIR"
nohup pnpm dev > /tmp/mwcode.log 2>&1 &

for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 2
    curl -s http://localhost:3100/api/health > /dev/null 2>&1 && break
done

if curl -s http://localhost:3100/api/health > /dev/null 2>&1; then
    ok "MWCode iniciado!"
    echo ""
    echo -e "${GREEN}🎉 Tudo pronto!${RESET}"
    echo ""
    echo "Acesse: ${YELLOW}http://localhost:5173${RESET}"
else
    warn "Verificando..."
    sleep 5
    if curl -s http://localhost:3100/api/health > /dev/null 2>&1; then
        ok "MWCode iniciado!"
        echo "Acesse: ${YELLOW}http://localhost:5173${RESET}"
    else
        warn "Use: cd $INSTALL_DIR && pnpm dev"
        echo "Logs: tail /tmp/mwcode.log"
    fi
fi