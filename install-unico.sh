#!/bin/bash
#
# MWCode — Instalador Único + Launcher Interativo
# Execute:
#   cd /tmp && curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/install-unico.sh | bash
#
set -euo pipefail

# IMPORTANTE: Mudar para diretório seguro ANTES DE TUDO
cd /tmp 2>/dev/null || cd / 2>/dev/null || true

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
die() { err "$1"; exit 1; }

has() { command -v "$1" &>/dev/null; }

INSTALL_DIR="${MWCODE_HOME:-$HOME/.mwcode}"
BIN_DIR="${MWCODE_BIN:-$HOME/.local/bin}"

log "${BOLD}🚀 MWCode — Instalador Único${RESET}"
log "Sistema: Linux"
log ""

# ============================================================
# 0. Garantir diretório válido
# ============================================================
cd /tmp 2>/dev/null || cd / 2>/dev/null || true

# ============================================================
# 1. Limpar instalação anterior
# ============================================================
log "Verificando instalação anterior..."
cd /tmp 2>/dev/null || cd / 2>/dev/null || true

[ -d "$INSTALL_DIR" ] && rm -rf "$INSTALL_DIR"
ok "Instalação anterior removida"

rm -f "$BIN_DIR/mwcode" 2>/dev/null || true
rm -f "/usr/local/bin/mwcode" 2>/dev/null || true

cd /tmp 2>/dev/null || cd / 2>/dev/null || true

# ============================================================
# 2. Node.js 20+
# ============================================================
log "Verificando Node.js..."
cd /tmp 2>/dev/null || cd / 2>/dev/null || true

NODE_OK=false
if has node; then
    NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
    [ "$NODE_VER" -ge 20 ] && NODE_OK=true
fi

if [ "$NODE_OK" = false ]; then
    warn "Node.js 20+ não encontrado. Instalando..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - || true
    sudo apt-get install -y nodejs 2>/dev/null || true
fi

has node || die "Node.js não instalado"
ok "Node.js: $(node -v)"

cd /tmp 2>/dev/null || cd / 2>/dev/null || true

# ============================================================
# 3. pnpm
# ============================================================
log "Instalando pnpm..."
cd /tmp 2>/dev/null || cd / 2>/dev/null || true

if ! has pnpm; then
    npm install -g pnpm 2>/dev/null || sudo npm install -g pnpm 2>/dev/null || true
fi

has pnpm || die "pnpm não instalado"
ok "pnpm: $(pnpm -v)"

cd /tmp 2>/dev/null || cd / 2>/dev/null || true

# ============================================================
# 4. Baixar MWCode
# ============================================================
log "Baixando MWCode..."
cd /tmp 2>/dev/null || cd / 2>/dev/null || true

rm -rf /tmp/mwcode-temp 2>/dev/null || true
git clone --depth 1 --branch main https://github.com/mweslley/mwcode.git /tmp/mwcode-temp || die "Falha ao baixar"

cd /tmp/mwcode-temp
ok "MWCode baixado"

# ============================================================
# 5. Mover para diretório final
# ============================================================
log "Instalando..."
cd /tmp 2>/dev/null || cd / 2>/dev/null || true

mkdir -p "$INSTALL_DIR"
cp -r /tmp/mwcode-temp/* "$INSTALL_DIR/"
cp -r /tmp/mwcode-temp/.* "$INSTALL_DIR/" 2>/dev/null || true
rm -rf /tmp/mwcode-temp

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
pnpm install || die "Falha ao instalar dependências"
ok "Dependências instaladas"

# ============================================================
# 8. Criar .env
# ============================================================
[ ! -f .env ] && cp .env.example .env && chmod 600 .env
ok ".env criado"

# ============================================================
# 9. Menu Interativo de Provedor
# ============================================================
log ""
log "${BOLD}🤖 Escolha seu Provedor de IA:${RESET}"
log ""
log "  1. ${GREEN}OpenRouter${RESET}   (推荐 - modelos gratuitos disponíveis)"
log "  2. OpenAI       (GPT-4, GPT-4o)"
log "  3. Gemini       (Google - gratuito)"
log "  4. DeepSeek    (IA chinesa - económico)"
log "  5. Ollama      (modelos locais - offline)"
log ""

printf "Digite o número (1-5): "
read -r escolha

case "$escolha" in
    1) PROVEDOR="openrouter";;
    2) PROVEDOR="openai";;
    3) PROVEDOR="gemini";;
    4) PROVEDOR="deepseek";;
    5) PROVEDOR="ollama";;
    *) PROVEDOR="openrouter";;
esac

log ""
log "Provedor selecionado: ${YELLOW}$PROVEDOR${RESET}"
log ""

# ============================================================
# 10. Pedir chave API
# ============================================================
if [ "$PROVEDOR" != "ollama" ]; then
    log "${BOLD}🔑 Configure sua chave API:${RESET}"
    
    case "$PROVEDOR" in
        openrouter) log "  PEGUE SUA CHAVE EM: ${CYAN}https://openrouter.ai/keys${RESET}";;
        openai)    log "  PEGUE SUA CHAVE EM: ${CYAN}https://platform.openai.com/api-keys${RESET}";;
        gemini)    log "  PEGUE SUA CHAVE EM: ${CYAN}https://aistudio.google.com/app/apikey${RESET}";;
        deepseek) log "  PEGUE SUA CHAVE EM: ${CYAN}https://platform.deepseek.com/api-keys${RESET}";;
    esac
    
    log ""
    printf "Cole sua chave API: "
    read -r API_KEY
    
    # Atualizar .env
    sed -i "/^${PROVEDOR^^}_API_KEY=/d" .env 2>/dev/null || true
    
    case "$PROVEDOR" in
        openrouter) echo "OPENROUTER_API_KEY=$API_KEY" >> .env ;;
        openai)     echo "OPENAI_API_KEY=$API_KEY" >> .env ;;
        gemini)    echo "GEMINI_API_KEY=$API_KEY" >> .env ;;
        deepseek)  echo "DEEPSEEK_API_KEY=$API_KEY" >> .env ;;
    esac
    
    # Definir provedor padrão
    sed -i '/^MWCODE_PROVIDER=/d' .env
    echo "MWCODE_PROVIDER=$PROVEDOR" >> .env
    
    ok "Chave API salva!"
else
    # Para Ollama, definir URL local
    sed -i '/^MWCODE_PROVIDER=/d' .env
    echo "MWCODE_PROVIDER=ollama" >> .env
    echo "OLLAMA_BASE_URL=http://localhost:11434" >> .env
    ok "Ollama configurado (certifique-se que está rodando em localhost:11434)"
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

log ""
log "${GREEN}${BOLD}🎉 Instalação concluída!${RESET}"
log ""
log "Acesso:"
log "  UI:    ${GREEN}http://localhost:5173${RESET}"
log "  API:   ${GREEN}http://localhost:3100${RESET}"
log "  Saúde: ${GREEN}http://localhost:3100/api/health${RESET}"
log ""

# ============================================================
# 13. Iniciar automaticamente
# ============================================================
log "${CYAN}🚀 Iniciando MWCode...${RESET}"
log ""

cd "$INSTALL_DIR"
nohup pnpm dev > /tmp/mwcode.log 2>&1 &
sleep 8

# Verificar se iniciou
sleep 2
if curl -s http://localhost:3100/api/health > /dev/null 2>&1; then
    ok "MWCode iniciado com sucesso!"
    log ""
    log "${GREEN}🎉 Tudo pronto!${RESET}"
    log ""
    log "Acesse no navegador:"
    log "  ${YELLOW}http://localhost:5173${RESET}"
    log ""
    
    # Tentar abrir navegador
    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open http://localhost:5173 &
    elif command -v firefox >/dev/null 2>&1; then
        firefox http://localhost:5173 &
    elif command -v chromium >/dev/null 2>&1; then
        chromium http://localhost:5173 &
    fi
else
    warn "Verificando início..."
    sleep 3
    if curl -s http://localhost:3100/api/health > /dev/null 2>&1; then
        ok "MWCode iniciado!"
        log ""
        log "Acesse: ${YELLOW}http://localhost:5173${RESET}"
    else
        warn "Servidor pode estar iniciando. Verifique manualmente:"
        log "  cd $INSTALL_DIR && pnpm dev"
        log ""
        log "Logs: tail /tmp/mwcode.log"
    fi
fi