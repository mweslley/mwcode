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
        [ -d "$dir" ] && [ -w "$dir" 2>/dev/null && { cd "$dir" 2>/dev/null; return 0; }
    done
    cd / 2>/dev/null
}

mudar_dir
INSTALL_DIR="${MWCODE_HOME:-$HOME/.mwcode}"
BIN_DIR="${MWCODE_BIN:-$HOME/.local/bin}"

echo ""
echo -e "${BOLD}🚀 MWCode — Instalador Único${RESET}"
echo -e "Sistema: $(uname -s)"
echo ""

# 1. Limpar
log "Verificando instalação anterior..."
mudar_dir
[ -d "$INSTALL_DIR" ] && rm -rf "$INSTALL_DIR"
ok "Instalação anterior removida"
rm -f "$BIN_DIR/mwcode" 2>/dev/null || true

mudar_dir

# 2. Node.js
log "Verificando Node.js..."
mudar_dir
has() { command -v "$1" &>/dev/null; }
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

# 4. Baixar
log "Baixando MWCode..."
mudar_dir
TEMP_DIR="/tmp"; [ ! -w "$TEMP_DIR" ] && TEMP_DIR="$HOME"
rm -rf "$TEMP_DIR/mwcode-temp" 2>/dev/null || true
git clone --depth 1 --branch main https://github.com/mweslley/mwcode.git "$TEMP_DIR/mwcode-temp" || { err "Falha ao baixar"; exit 1; }
cd "$TEMP_DIR/mwcode-temp"
ok "MWCode baixado"

# 5. Mover
log "Instalando..."
mudar_dir
mkdir -p "$INSTALL_DIR"
cp -r "$TEMP_DIR/mwcode-temp/"* "$INSTALL_DIR/" 2>/dev/null || true
cp -r "$TEMP_DIR/mwcode-temp/."* "$INSTALL_DIR/" 2>/dev/null || true
rm -rf "$TEMP_DIR/mwcode-temp"
cd "$INSTALL_DIR"
ok "MWCode instalado: $INSTALL_DIR"

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

# Install com rebuild forçada
pnpm install --force || pnpm rebuild || true
pnpm install || { err "Falha ao instalar dependências"; exit 1; }

# Reinstalar tsx com force
pnpm add tsx@latest -D --force 2>/dev/null || true

# Se tsx ainda não funcionar, usar npx
if [ ! -f "$INSTALL_DIR/node_modules/.bin/tsx" ]; then
    log "tsx não disponível, usando npx..."
fi

ok "Dependências instaladas"

# 8. Criar .env
[ ! -f .env ] && cp .env.example .env && chmod 600 .env
ok ".env criado"

# 9. ESCOLHER PROVEDOR
echo ""
echo -e "${BOLD}🤖 Escolha seu Provedor de IA:${RESET}"
echo ""
echo "  1. OpenRouter   (Recomendado)"
echo "  2. OpenAI"
echo "  3. Gemini"
echo "  4. DeepSeek"
echo "  5. Ollama"
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

# 10. CHAVE API (invisível)
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
    
    # Usar -s para senha invisível
    echo -n "Cole sua chave API: "
    read -s API_KEY
    echo ""
    
    if [ -n "$API_KEY" ]; then
        # SALVAR ANTES DE TESTAR
        case "$PROVIDER_NAME" in
            openrouter) echo "OPENROUTER_API_KEY=$API_KEY" >> .env ;;
            openai)     echo "OPENAI_API_KEY=$API_KEY" >> .env ;;
            gemini)    echo "GEMINI_API_KEY=$API_KEY" >> .env ;;
            deepseek)  echo "DEEPSEEK_API_KEY=$API_KEY" >> .env ;;
        esac
        echo "MWCODE_PROVIDER=$PROVIDER_NAME" >> .env
        
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
# 12. INSTALAR UFW E LIBERAR PORTAS
# ============================================================
log "Verificando portas..."

# Matar processos existentes primeiro
pkill -f "node.*3100" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

# Usar portas fixas (3100 para API, 5173 para UI)
PORTA_UI=5173
PORTA_API=3100

# Salvar as portas no .env
echo "PORT=$PORTA_API" >> .env
echo "UI_PORT=$PORTA_UI" >> .env

log "Usando portas: UI=$PORTA_UI, API=$PORTA_API"

# Instalar UFW
log "Instalando UFW..."

# Atualizar pacotes primeiro
apt update -qq 2>/dev/null || apt update 2>/dev/null || true

# Instalar UFW
if ! command -v ufw >/dev/null 2>&1; then
    apt install -y ufw 2>/dev/null || true
fi

# Se UFW foi instalado, configurar regras
if command -v ufw >/dev/null 2>&1; then
    # SSH (importante!)
    ufw allow 22/tcp 2>/dev/null || true
    
    # Portas do MWCode
    ufw allow 3100/tcp 2>/dev/null || true
    ufw allow 5173/tcp 2>/dev/null || true
    
    # Não habilitar por padrão para evitar lockout em VPS
    # ufw --force enable 2>/dev/null || true
    
    ok "UFW instaladas e portas liberadas (3100, 5173)"
else
    # Fallback para iptables
    iptables -I INPUT -p tcp --dport 3100 -j ACCEPT 2>/dev/null || true
    iptables -I INPUT -p tcp --dport 5173 -j ACCEPT 2>/dev/null || true
    ok "Portas liberadas (iptables)"
fi

# PRIMEIRO: matar qualquer processo que use a porta 3100
log "Verificando processos na porta 3100..."

# Encontrar e matar processos na porta 3100
if command -v lsof >/dev/null 2>&1; then
    lsof -ti:3100 | xargs -r kill -9 2>/dev/null || true
fi

if command -v fuser >/dev/null 2>&1; then
    fuser -k 3100/tcp 2>/dev/null || true
fi

# Matar processos pnpm/node na porta
pkill -f "pnpm dev" 2>/dev/null || true
pkill -f "node.*3100" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# Também matar PM2 se estiver rodando
if command -v pm2 >/dev/null 2>&1; then
    pm2 delete mwcode 2>/dev/null || true
    pm2 stop all 2>/dev/null || true
fi

# Aguardar um momento
sleep 2

log "Processos anteriores finalizados"

# Tentar liberar porta no firewall
sudo ufw allow 3100/tcp 2>/dev/null || true
sudo iptables -I INPUT -p tcp --dport 3100 -j ACCEPT 2>/dev/null || true
sudo iptables -A INPUT -p tcp --dport 3100 -j ACCEPT 2>/dev/null || true
sudo firewall-cmd --add-port=3100/tcp --permanent 2>/dev/null || true
sudo firewall-cmd --reload 2>/dev/null || true

# Verificar se porta está realmente liberada
sleep 1
log "Verificando porta 3100..."

# Testar se consegue bind na porta
PORTA_OK=false

# Verificar se a porta está livre para bind
if command -v nc >/dev/null 2>&1; then
    # Tentar conectar na porta
    if ! nc -z localhost 3100 2>/dev/null; then
        PORTA_OK=true
    fi
elif command -v nmap >/dev/null 2>&1; then
    if ! nmap -p 3100 localhost 2>/dev/null | grep -q "open"; then
        PORTA_OK=true
    fi
else
    # Fallback: simplesmente tentar
    PORTA_OK=true
fi

# Verificar se firewall permite
if command -v ufw >/dev/null 2>&1; then
    if sudo ufw status 2>/dev/null | grep -q "3100.*ALLOW"; then
        ok "Porta 3100 liberada (ufw)"
        PORTA_OK=true
    fi
fi

if command -v iptables >/dev/null 2>&1; then
    if sudo iptables -L INPUT -n 2>/dev/null | grep -q "3100"; then
        ok "Porta 3100 liberada (iptables)"
        PORTA_OK=true
    fi
fi

[ "$PORTA_OK" = true ] && ok "Porta 3100 pronta" || warn "Configure porta 3100 manualmente se necessário"

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

# Iniciar server
cd "$INSTALL_DIR/server"

# Usar npx se tsx local não funcionar
if [ -f "$INSTALL_DIR/node_modules/.bin/tsx" ]; then
    ./node_modules/.bin/tsx src/index.ts &
else
    npx tsx src/index.ts &
fi
SERVER_PID=$!

# Esperar ate iniciar
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

# Verificar se iniciou
if curl -s http://localhost:$PORTA_API/api/health > /dev/null 2>&1; then
    # Testar se a API responde com chave
    TESTE=$(curl -s http://localhost:$PORTA_API/api/health 2>&1)
    
    if echo "$TESTE" | grep -q "ok"; then
        ok "MWCode iniciado com sucesso!"
        echo ""
        echo -e "${GREEN}🎉 Tudo pronto!${RESET}"
        echo ""
        echo "Acesse:"
        echo -e "  UI:    ${GREEN}http://localhost:$PORTA_UI${RESET}"
        echo -e "  API:   ${GREEN}http://localhost:$PORTA_API${RESET}"
        echo -e "  Saude: ${GREEN}http://localhost:$PORTA_API/api/health${RESET}"
        echo ""
        echo "Provedor: $PROVIDER_NAME"
    else
        warn "Servidor iniciou mas com problemas."
        echo "Verifique: tail /tmp/mwcode.log"
    fi
else
    warn "Servidor não iniciou a tempo."
    echo ""
    echo "Aguarde 10 segundos e verifique:"
    echo "  tail /tmp/mwcode.log"
    echo ""
    echo " ou tente iniciar manualmente:"
    echo "  cd $INSTALL_DIR && pnpm dev"
fi