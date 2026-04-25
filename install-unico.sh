#!/bin/bash
#
# MWCode — Instalador Único + Launcher Interativo
# Execute:
#   curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/install-unico.sh | bash
#
# Para garantir diretório válido:
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/install-unico.sh)"
#

# NÃO usar exit on error - precisa ser interativo
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

# Função para mudar para diretório válido
mudar_dir() {
    for dir in /tmp /var/tmp "$HOME" "$HOME/.mwcode" /; do
        if [ -d "$dir" ] && [ -w "$dir" ] 2>/dev/null; then
            cd "$dir" 2>/dev/null && return 0
        fi
    done
    cd / 2>/dev/null && return 0
}

# MUDAR PARA DIRETÓRIO VÁLIDO PRIMEIRO
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

if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
    ok "Instalação anterior removida"
else
    ok "Nenhuma instalação anterior"
fi

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
    if [ "$NODE_VER" -ge 20 ] 2>/dev/null; then
        NODE_OK=true
    fi
fi

if [ "$NODE_OK" = false ]; then
    warn "Node.js 20+ não encontrado."
    echo "Por favor, instale o Node.js 20+ primeiro:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -"
    echo "  sudo apt-get install -y nodejs"
    exit 1
fi

ok "Node.js: $(node -v)"

mudar_dir

# ============================================================
# 3. pnpm
# ============================================================
log "Instalando pnpm..."
mudar_dir

if ! has pnpm; then
    npm install -g pnpm 2>/dev/null || sudo npm install -g pnpm 2>/dev/null || true
fi

if ! has pnpm; then
    err "pnpm não instalado"
    exit 1
fi

ok "pnpm: $(pnpm -v)"

mudar_dir

# ============================================================
# 4. Baixar MWCode
# ============================================================
log "Baixando MWCode..."
mudar_dir

# Criar diretório temporário alternativo
TEMP_DIR="/tmp"
[ ! -w "$TEMP_DIR" ] && TEMP_DIR="$HOME"
[ ! -w "$TEMP_DIR" ] && TEMP_DIR="/var/tmp"

rm -rf "$TEMP_DIR/mwcode-temp" 2>/dev/null || true
git clone --depth 1 --branch main https://github.com/mweslley/mwcode.git "$TEMP_DIR/mwcode-temp" || {
    err "Falha ao baixar do GitHub"
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
pnpm install || {
    err "Falha ao instalar dependências"
    exit 1
}
ok "Dependências instaladas"

# ============================================================
# 8. Criar .env
# ============================================================
[ ! -f .env ] && cp .env.example .env && chmod 600 .env
ok ".env criado"

# O problema é que `read` não funciona bem com pipe
# Por isso vamos usar uma abordagem alternativa

# ============================================================
# 9. MENU INTERATIVO DE PROVEDOR (corrigido para funcionar com pipe)
# ============================================================

# Verificar se podemos usar modo interativo
if [ -t 0 ]; then
    # Terminal interativo - usar read normal
    echo ""
    echo -e "${BOLD}🤖 Escolha seu Provedor de IA:${RESET}"
    echo ""
    echo -e "  1. ${GREEN}OpenRouter${RESET}   (Recomendado - modelos gratuitos)"
    echo -e "  2. OpenAI       (GPT-4, GPT-4o)"
    echo -e "  3. Gemini       (Google - gratuito)"
    echo -e "  4. DeepSeek    (IA chinesa)"
    echo -e "  5. Ollama       (modelos locais)"
    echo ""
    printf "Digite o número (1-5): "
    read -r escolha
else
    # Modo não-interativo (pipe) - usar argumento ou padrão
    echo ""
    echo -e "${BOLD}🤖 Escolha seu Provedor de IA:${RESET}"
    echo ""
    echo -e "  1. ${GREEN}OpenRouter${RESET}   (Recomendado - modelos gratuitos)"
    echo -e "  2. OpenAI       (GPT-4, GPT-4o)"
    echo -e "  3. Gemini       (Google - gratuito)"
    echo -e "  4. DeepSeek    (IA chinesa)"
    echo -e "  5. Ollama       (modelos locais)"
    echo ""
    echo "  Passing with pipe detected. Using OpenRouter by default."
    echo "  To choose another provider, run with: PROVEDOR=openai bash install-unico.sh"
    echo ""
    escolha="1"
fi

case "$escolha" in
    1) PROVEDOR="${PROVEDOR:-openrouter}";;
    2) PROVEDOR="${PROVEDOR:-openai}";;
    3) PROVEDOR="${PROVEDOR:-gemini}";;
    4) PROVEDOR="${PROVEDOR:-deepseek}";;
    5) PROVEDOR="${PROVEDOR:-ollama}";;
    *) PROVEDOR="openrouter";;
esac

echo ""
echo -e "Provedor selecionado: ${YELLOW}$PROVEDOR${RESET}"
echo ""

# ============================================================
# 10. PEDIR CHAVE API (corrigido para funcionar com pipe)
# ============================================================
if [ "$PROVEDOR" != "ollama" ]; then
    echo -e "${BOLD}🔑 Configure sua chave API:${RESET}"
    
    case "$PROVEDOR" in
        openrouter) echo "  PEGUE SUA CHAVE EM: ${CYAN}https://openrouter.ai/keys${RESET}";;
        openai)    echo "  PEGUE SUA CHAVE EM: ${CYAN}https://platform.openai.com/api-keys${RESET}";;
        gemini)    echo "  PEGUE SUA CHAVE EM: ${CYAN}https://aistudio.google.com/app/apikey${RESET}";;
        deepseek) echo "  PEGUE SUA CHAVE EM: ${CYAN}https://platform.deepseek.com/api-keys${RESET}";;
    esac
    
    # Verificar se tem chave via variável de ambiente
    if [ -n "$API_KEY" ]; then
        echo ""
        echo "Usando chave API da variável de ambiente."
    elif [ -t 0 ]; then
        # Terminal interativo
        echo ""
        printf "Cole sua chave API: "
        read -r API_KEY
    else
        # Modo pipe
        echo ""
        echo "Nenhuma chave API fornecida (use API_KEY=chave bash install-unico.sh)"
        echo "Configure manualmente depois: nano $INSTALL_DIR/.env"
        API_KEY=""
    fi
    
    if [ -n "$API_KEY" ]; then
        # Atualizar .env
        case "$PROVEDOR" in
            openrouter) echo "OPENROUTER_API_KEY=$API_KEY" >> .env ;;
            openai)     echo "OPENAI_API_KEY=$API_KEY" >> .env ;;
            gemini)    echo "GEMINI_API_KEY=$API_KEY" >> .env ;;
            deepseek)  echo "DEEPSEEK_API_KEY=$API_KEY" >> .env ;;
        esac
        
        # Definir provedor padrão
        echo "MWCODE_PROVIDER=$PROVEDOR" >> .env
        
        ok "Chave API salva!"
    else
        warn "Nenhuma chave inserida. Configure manualmente depois."
    fi
else
    # Para Ollama
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
echo -e "  Saúde: ${GREEN}http://localhost:3100/api/health${RESET}"
echo ""

# ============================================================
# 13. INICIAR AUTOMATICAMENTE
# ============================================================
echo -e "${CYAN}🚀 Iniciando MWCode...${RESET}"
echo ""

cd "$INSTALL_DIR"

# Iniciar em background
nohup pnpm dev > /tmp/mwcode.log 2>&1 &
PID=$!

# Aguardar inicialização
for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 2
    if curl -s http://localhost:3100/api/health > /dev/null 2>&1; then
        break
    fi
done

# Verificar se iniciou
if curl -s http://localhost:3100/api/health > /dev/null 2>&1; then
    ok "MWCode iniciado com sucesso!"
    echo ""
    echo -e "${GREEN}🎉 Tudo pronto!${RESET}"
    echo ""
    echo "Acesse no navegador:"
    echo -e "  ${YELLOW}http://localhost:5173${RESET}"
    echo ""
else
    warn "Verificando início..."
    sleep 5
    if curl -s http://localhost:3100/api/health > /dev/null 2>&1; then
        ok "MWCode iniciado!"
        echo ""
        echo "Acesse: ${YELLOW}http://localhost:5173${RESET}"
    else
        warn "Servidor pode estar iniciando. Verifique manualmente:"
        echo "  cd $INSTALL_DIR && pnpm dev"
        echo ""
        echo "Logs: tail /tmp/mwcode.log"
    fi
fi