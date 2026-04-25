#!/bin/bash
#
# MWCode — Instalador Único
# Execute:
#   curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/install-unico.sh -o /tmp/install-mwcode.sh && bash /tmp/install-mwcode.sh
#
set +u

# Workaround para Node.js 24 + pnpm tsx bug
export PNPM_SCRIPT_SRC_ALLOW='*=*'

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

mudar_dir() {
    for dir in /tmp /var/tmp "$HOME" /; do
        if [ -d "$dir" ] && [ -w "$dir" ] 2>/dev/null; then
            cd "$dir" 2>/dev/null && return 0
        fi
    done
    cd / 2>/dev/null
}

mudar_dir
MWCODE_DIR="${MWCODE_DIR:-/opt/mwcode}"
INSTALL_DIR="$MWCODE_DIR"
BIN_DIR="${MWCODE_BIN:-$HOME/.local/bin}"

echo ""
echo -e "${BOLD}🚀 MWCode — Instalador Único${RESET}"
echo -e "Sistema: $(uname -s)"
echo ""

# ============================================================
# 1. DETECTAR INSTALAÇÃO ANTERIOR
# ============================================================
mudar_dir
MODO_INSTALACAO="nova"   # "nova" | "atualizar"

if [ -d "$INSTALL_DIR" ] && [ -d "$INSTALL_DIR/.git" ]; then
    echo ""
    echo -e "${YELLOW}MWCode já está instalado${RESET} em $INSTALL_DIR"
    echo ""
    echo -e "  ${GREEN}1)${RESET} Atualizar    ${CYAN}(recomendado — preserva seus dados)${RESET}"
    echo -e "  ${YELLOW}2)${RESET} Reinstalar   ${RED}(apaga tudo)${RESET}"
    echo -e "  ${RED}3)${RESET} Cancelar"
    echo ""
    read -p "Escolha [1]: " escolha_existente
    escolha_existente=${escolha_existente:-1}

    case "$escolha_existente" in
        1)
            MODO_INSTALACAO="atualizar"
            ok "Modo atualizar — seus dados serão preservados"
            [ -f "$INSTALL_DIR/.env" ] && cp "$INSTALL_DIR/.env" "/tmp/mwcode.env.backup"
            [ -d "$INSTALL_DIR/data" ] && cp -r "$INSTALL_DIR/data" "/tmp/mwcode.data.backup"
            ;;
        2)
            read -p "Confirma apagar tudo? Digite 'sim': " conf
            if [ "$conf" != "sim" ]; then
                log "Cancelado."
                exit 0
            fi
            rm -rf "$INSTALL_DIR"
            rm -f "$BIN_DIR/mwcode" 2>/dev/null || true
            ok "Instalação anterior removida"
            ;;
        3|*)
            log "Cancelado."
            exit 0
            ;;
    esac
fi

mudar_dir

# 2. Node.js
log "Verificando Node.js..."
mudar_dir
has() { command -v "$1" > /dev/null 2>&1; }
NODE_OK=false
if has node; then
    NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
    [ "$NODE_VER" -ge 20 ] 2>/dev/null && NODE_OK=true
fi
[ "$NODE_OK" = false ] && { warn "Node.js 20+ não encontrado."; exit 1; }
ok "Node.js: $(node -v)"

mudar_dir

# 3. pnpm
log "Instalando pnpm..."
mudar_dir
! has pnpm && npm install -g pnpm 2>/dev/null || sudo npm install -g pnpm 2>/dev/null || true
! has pnpm && { err "pnpm não instalado"; exit 1; }
ok "pnpm: $(pnpm -v)"

mudar_dir

# 4. Baixar / Atualizar código
if [ "$MODO_INSTALACAO" = "atualizar" ]; then
    log "Atualizando código (git pull)..."
    cd "$INSTALL_DIR"
    git fetch --quiet origin main || { err "Falha ao buscar updates do GitHub"; exit 1; }
    git reset --hard origin/main --quiet || { err "Falha ao aplicar updates"; exit 1; }
    ok "Código atualizado pra última versão"
else
    log "Baixando MWCode..."
    mudar_dir
    TEMP_DIR="/tmp"; [ ! -w "$TEMP_DIR" ] && TEMP_DIR="$HOME"
    rm -rf "$TEMP_DIR/mwcode-temp" 2>/dev/null || true
    git clone --depth 1 --branch main https://github.com/mweslley/mwcode.git "$TEMP_DIR/mwcode-temp" || { err "Falha ao baixar"; exit 1; }
    ok "MWCode baixado"

    log "Instalando em $INSTALL_DIR..."
    mudar_dir
    mkdir -p "$INSTALL_DIR"
    cp -r "$TEMP_DIR/mwcode-temp/"* "$INSTALL_DIR/" 2>/dev/null || true
    cp -r "$TEMP_DIR/mwcode-temp/."* "$INSTALL_DIR/" 2>/dev/null || true
    rm -rf "$TEMP_DIR/mwcode-temp"
    cd "$INSTALL_DIR"
    ok "MWCode instalado: $INSTALL_DIR"
fi

# 6. Corrigir bugs
log "Verificando correções..."
sed -i 's/mkdir_safe/mkdir -p/g' install.sh 2>/dev/null || true
ok "Correções aplicadas"

# 7. Instalar dependências
log "Instalando dependências..."
cd "$INSTALL_DIR"

# Aprovar todos os builds
echo "y
y
y
y" | pnpm approve-builds 2>/dev/null || true

# Install normal
pnpm install || { err "Falha ao instalar dependências"; exit 1; }

# Corrigir caminho do .env no server
log "Corrigindo configurações..."
sed -i "s|../.env|../../.env|g" server/src/index.ts 2>/dev/null || true

ok "Dependências instaladas"

# 8. Criar/restaurar .env e data/
cd "$INSTALL_DIR"

if [ "$MODO_INSTALACAO" = "atualizar" ]; then
    # Restaura .env e data/ que salvamos antes
    if [ -f "/tmp/mwcode.env.backup" ]; then
        cp "/tmp/mwcode.env.backup" "$INSTALL_DIR/.env"
        chmod 600 "$INSTALL_DIR/.env"
        ok ".env restaurado (suas chaves preservadas)"
    fi
    if [ -d "/tmp/mwcode.data.backup" ]; then
        cp -r "/tmp/mwcode.data.backup" "$INSTALL_DIR/data"
        ok "Pasta data/ restaurada (usuários, memórias, skills preservadas)"
    fi

    log "Pulando configuração de provedor (modo atualização)"

    # Pula direto pra seção de portas e início — sem perguntar provedor/chave
    SKIP_PROVIDER_SETUP=true
else
    > .env
    [ -f .env-example ] && cp .env-example .env
    chmod 600 .env
    ok ".env criado"
    SKIP_PROVIDER_SETUP=false
fi

# 9. ESCOLHER PROVEDOR (empresa configurada na UI)
if [ "$SKIP_PROVIDER_SETUP" = "true" ]; then
    # Pula o bloco de configuração de provedor inteiro
    # Define variáveis necessárias pras seções abaixo
    PROVIDER_NAME=$(grep -E "^MWCODE_PROVIDER=" "$INSTALL_DIR/.env" | cut -d= -f2 || echo "openrouter")
    : "${PROVIDER_NAME:=openrouter}"
fi

if [ "$SKIP_PROVIDER_SETUP" != "true" ]; then
echo ""
echo -e "${BOLD}🤖 Escolha seu Provedor de IA:${RESET}"
echo ""
echo "  1. OpenRouter   (Recomendado - gratuito)"
echo "  2. OpenAI       (GPT-4)"
echo "  3. Gemini       (Google)"
echo "  4. DeepSeek    (Barato)"
echo "  5. Ollama       (Local)"
echo ""
read -p "Digite o número (1-5) [1]: " escolha

# Default para openrouter se vazio
escolha=${escolha:-1}

case "$escolha" in
    1) PROVIDER_NAME="openrouter" ;;
    2) PROVIDER_NAME="openai" ;;
    3) PROVIDER_NAME="gemini" ;;
    4) PROVIDER_NAME="deepseek" ;;
    5) PROVIDER_NAME="ollama" ;;
    *) PROVIDER_NAME="openrouter" ;;
esac

echo "Provedor: $PROVIDER_NAME"
echo ""

# 9b. MODELO (opcional - pode escolher por agente na Dashboard)

# 10. CHAVE API (prompt interativo)
if [ "$PROVIDER_NAME" != "ollama" ]; then
    case "$PROVIDER_NAME" in
        openrouter) LINK="https://openrouter.ai/keys" ;;
        openai)    LINK="https://platform.openai.com/api-keys" ;;
        gemini)   LINK="https://aistudio.google.com/app/apikey" ;;
        deepseek) LINK="https://platform.deepseek.com/api-keys" ;;
    esac
    
    echo -e "${BOLD}🔑 Configure sua chave API:${RESET}"
    echo "  Pegue em: $LINK"
    echo ""
    echo -n "Cole sua chave API: "
    stty -echo
    read -s API_KEY
    stty echo
    echo ""
    
    if [ -n "$API_KEY" ]; then
        # SALVAR (substituir, nao append)
        cd "$INSTALL_DIR"
        case "$PROVIDER_NAME" in
            openrouter) echo "OPENROUTER_API_KEY=$API_KEY" > .env ;;
            openai)     echo "OPENAI_API_KEY=$API_KEY" > .env ;;
            gemini)    echo "GEMINI_API_KEY=$API_KEY" > .env ;;
            deepseek)  echo "DEEPSEEK_API_KEY=$API_KEY" > .env ;;
        esac
        echo "MWCODE_PROVIDER=$PROVIDER_NAME" >> .env
        [ -n "$MODELO" ] && echo "MWCODE_MODEL=$MODELO" >> .env
        ok "Chave salva em $INSTALL_DIR/.env"
        
        # VERIFICAR CHAVE
        log "Verificando chave API..."
        
        case "$PROVIDER_NAME" in
            openrouter)
                # Testar chave
                TESTE=$(curl -s -H "Authorization: Bearer $API_KEY" -H "HTTP-Referer: https://mwcode.com" -H "X-Title: MWCode" "https://openrouter.ai/api/v1/models" 2>&1)
                if echo "$TESTE" | grep -q "error"; then
                    err "Chave inválida!"
                    # Remover chave inválida
                    sed -i "/OPENROUTER_API_KEY/d" .env
                    sed -i "/MWCODE_PROVIDER/d" .env
                    exit 1
                fi
                ;;
            openai)
                TESTE=$(curl -s -H "Authorization: Bearer $API_KEY" "https://api.openai.com/v1/models" 2>&1)
                if echo "$TESTE" | grep -q "error"; then
                    err "Chave inválida!"
                    sed -i "/OPENAI_API_KEY/d" .env
                    sed -i "/MWCODE_PROVIDER/d" .env
                    exit 1
                fi
                ;;
            gemini)
                TESTE=$(curl -s "https://generativelanguage.googleapis.com/v1/models?key=$API_KEY" 2>&1)
                if echo "$TESTE" | grep -q "error"; then
                    err "Chave inválida!"
                    sed -i "/GEMINI_API_KEY/d" .env
                    sed -i "/MWCODE_PROVIDER/d" .env
                    exit 1
                fi
                ;;
            deepseek)
                TESTE=$(curl -s -H "Authorization: Bearer $API_KEY" "https://api.deepseek.com/v1/models" 2>&1)
                if echo "$TESTE" | grep -q "error"; then
                    err "Chave inválida!"
                    sed -i "/DEEPSEEK_API_KEY/d" .env
                    sed -i "/MWCODE_PROVIDER/d" .env
                    exit 1
                fi
                ;;
        esac
        
        ok "Chave API verificada e salva!"
    else
        warn "Nenhuma chave inserida."
    fi
else
    echo "OLLAMA_BASE_URL=http://localhost:11434" >> .env
    echo "MWCODE_PROVIDER=ollama" >> .env
    ok "Ollama configurado"
fi

fi   # /SKIP_PROVIDER_SETUP — fim do bloco de configuração de provedor

# Funções de porta DEVEM vir antes do uso
test_porta_uso() {
    local PORTA=$1
    if command -v nc >/dev/null 2>&1; then
        if nc -z localhost $PORTA 2>/dev/null; then
            return 1
        fi
    fi
    if command -v timeout >/dev/null 2>&1; then
        if timeout 1 bash -c "echo >/dev/tcp/localhost/$PORTA" 2>/dev/null; then
            return 1
        fi
    fi
    return 0
}

# 11. Criar comando
log "Criando comando..."
cd "$INSTALL_DIR"
mkdir -p "$BIN_DIR"
ln -sf "$INSTALL_DIR/bin/mwcode.js" "$BIN_DIR/mwcode"
ok "Comando 'mwcode' disponível"

mudar_dir

# ============================================================
# 12. PORTAS, FIREWALL E LIMPAR PROCESSOS
# ============================================================

# Portas fixas (3100 = API, 5173 = UI)
PORTA_API=3100
PORTA_UI=5173

# Salvar no .env
echo "PORT=$PORTA_API" >> .env
echo "UI_PORT=$PORTA_UI" >> .env
log "Portas configuradas: API=$PORTA_API, UI=$PORTA_UI"

# Encerrar processos anteriores que possam estar usando as portas
log "Encerrando processos anteriores..."
pkill -f "pnpm dev" 2>/dev/null || true
pkill -f "node.*$PORTA_API" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
[ -x "$(command -v lsof)" ] && lsof -ti:$PORTA_API | xargs -r kill -9 2>/dev/null || true
[ -x "$(command -v lsof)" ] && lsof -ti:$PORTA_UI | xargs -r kill -9 2>/dev/null || true
[ -x "$(command -v fuser)" ] && fuser -k $PORTA_API/tcp 2>/dev/null || true
[ -x "$(command -v pm2)" ] && pm2 delete mwcode 2>/dev/null || true
sleep 2
ok "Processos anteriores encerrados"

# Liberar portas no firewall
log "Liberando portas no firewall..."
apt update -qq 2>/dev/null || true
if ! command -v ufw >/dev/null 2>&1; then
    apt install -y ufw 2>/dev/null || true
fi

if command -v ufw >/dev/null 2>&1; then
    ufw allow 22/tcp 2>/dev/null || true       # SSH (não trave fora!)
    ufw allow $PORTA_API/tcp 2>/dev/null || true
    ufw allow $PORTA_UI/tcp 2>/dev/null || true
    # Não chama "ufw enable" automaticamente (evita lockout em VPS sem console)
    ok "UFW configurado (portas $PORTA_API e $PORTA_UI liberadas)"
elif command -v iptables >/dev/null 2>&1; then
    iptables -I INPUT -p tcp --dport $PORTA_API -j ACCEPT 2>/dev/null || true
    iptables -I INPUT -p tcp --dport $PORTA_UI -j ACCEPT 2>/dev/null || true
    ok "Portas liberadas via iptables"
else
    warn "Nenhum firewall encontrado. Libere $PORTA_API/$PORTA_UI manualmente se precisar."
fi

cd "$INSTALL_DIR"

echo ""
echo -e "${GREEN}${BOLD}🎉 Instalação concluída!${RESET}"
echo ""

# 13. INICIAR COM MAIS FEEDBACK
echo -e "${CYAN}🚀 Iniciando MWCode...${RESET}"
echo ""
log "Iniciando servidor..."
log "Isso pode levar alguns segundos..."
echo ""

cd "$INSTALL_DIR"

# Build da UI primeiro
log "Compilando UI..."
pnpm --filter @mwcode/ui build || { err "UI nao compilada"; exit 1; }

export PORT="$PORTA_API"
export UI_PORT="$PORTA_UI"

# Exportar vars para o servidor (com debugging)
log "Carregando configurações do .env..."

# Carregar todas variaveis do .env
if [ -f "$INSTALL_DIR/.env" ]; then
    set -a
    source "$INSTALL_DIR/.env"
    set +a
    log "Configurações carregadas do .env"
else
    err ".env não encontrado!"
fi

# Exportar vars
export OPENROUTER_API_KEY
export MWCODE_PROVIDER
log "Provider: $MWCODE_PROVIDER"
log "API Key: $(echo $OPENROUTER_API_KEY | cut -c1-8)..."

# Iniciar server
cd "$INSTALL_DIR/server"

# Usar tsx do node_modules
TSX="$INSTALL_DIR/node_modules/.bin/tsx"
if [ -x "$TSX" ]; then
    $TSX src/index.ts > /tmp/mwcode.log 2>&1 &
else
    npx tsx src/index.ts > /tmp/mwcode.log 2>&1 &
fi
SERVER_PID=$!

# Esperar server iniciar
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    sleep 2
    
    if curl -s http://localhost:$PORTA_API/api/health > /dev/null 2>&1; then
        break
    fi
    
    # Verificar se processo ainda esta rodando
    if ! kill -0 $SERVER_PID 2>/dev/null; then
        err "Servidor parou!"
        log "Verificando log..."
        tail -20 /tmp/mwcode.log 2>/dev/null || true
        break
    fi
    
    echo -n "."
done
echo ""

# Verificar se server iniciou
if ! curl -s http://localhost:$PORTA_API/api/health > /dev/null 2>&1; then
    err "Server nao iniciou!"
    tail -20 /tmp/mwcode.log 2>/dev/null || true
    exit 1
fi
ok "Server iniciado!"

# Iniciar UI em background
cd "$INSTALL_DIR/ui"
npx vite --host --port $PORTA_UI > /tmp/mwcode-ui.log 2>&1 &
UI_PID=$!

# Esperar UI iniciar
for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    
    if curl -s http://localhost:$PORTA_UI > /dev/null 2>&1; then
        break
    fi
    
    echo -n "."
done
echo ""

if curl -s http://localhost:$PORTA_UI > /dev/null 2>&1; then
    ok "UI iniciada!"
else
    warn "UI pode nao ter iniciado. Verifique: tail /tmp/mwcode-ui.log"
fi

echo ""
echo -e "${GREEN}🎉 Tudo pronto!${RESET}"
echo ""
echo "Acesse:"
echo -e "  UI:    ${GREEN}http://localhost:$PORTA_UI${RESET}"
echo -e "  API:   ${GREEN}http://localhost:$PORTA_API${RESET}"
echo -e "  Saude: ${GREEN}http://localhost:$PORTA_API/api/health${RESET}"
echo ""
echo "Provedor: $PROVIDER_NAME"