#!/bin/bash
#
# MWCode — Instalador Único (Versão Seguro)
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
RESET='\033[0m'

log() { echo -e "${CYAN}ℹ${RESET} ${1}"; }
ok() { echo -e "${GREEN}✓${RESET} ${1}"; }
warn() { echo -e "${YELLOW}⚠${RESET} ${1}"; }
err() { echo -e "${RED}✗${RESET} ${1}"; }
die() { err "$1"; exit 1; }

INSTALL_DIR="${MWCODE_HOME:-$HOME/.mwcode}"
BIN_DIR="${MWCODE_BIN:-$HOME/.local/bin}"

# Função has definida aqui para usar depois
has() { command -v "$1" &>/dev/null; }

log "${BOLD}🚀 MWCode — Instalador Único${RESET}"
log "Sistema: Linux"
log ""

# ============================================================
# 0. Garantir diretório válido em cada passo
# ============================================================
cd /tmp 2>/dev/null || cd / 2>/dev/null || true

# ============================================================
# 1. Limpar instalação anterior
# ============================================================
log "Verificando instalação anterior..."
cd /tmp 2>/dev/null || cd / 2>/dev/null || true

[ -d "$INSTALL_DIR" ] && rm -rf "$INSTALL_DIR"
ok "Instalação anterior removida"

# Remover symlinks antigos
rm -f "$BIN_DIR/mwcode" 2>/dev/null || true
rm -f "/usr/local/bin/mwcode" 2>/dev/null || true

cd /tmp 2>/dev/null || cd / 2>/dev/null || true

# ============================================================
# 2. Node.js 20+
# ============================================================
log "Verificando Node.js..."

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

if ! has pnpm; then
    npm install -g pnpm 2>/dev/null || sudo npm install -g pnpm 2>/dev/null || true
fi

has pnpm || die "pnpm não instalado"
ok "pnpm: $(pnpm -v)"

cd /tmp 2>/dev/null || cd / 2>/dev/null || true

# ============================================================
# 4. Baixar MWCode para /tmp primeiro
# ============================================================
log "Baixando MWCode..."
cd /tmp 2>/dev/null || cd / 2>/dev/null || true

# Clonar para /tmp primeiro
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
# 9. Criar comando
# ============================================================
log "Criando comando..."
cd "$INSTALL_DIR"
mkdir -p "$BIN_DIR"
ln -sf "$INSTALL_DIR/bin/mwcode.js" "$BIN_DIR/mwcode"
ok "Comando 'mwcode' disponível"

# ============================================================
# 10. Liberar porta
# ============================================================
log "Liberando porta 3100..."
sudo ufw allow 3100/tcp 2>/dev/null || true
ok "Porta 3100 liberada"

cd "$INSTALL_DIR"

log ""
log "${GREEN}${BOLD}🎉 Instalação concluída!${RESET}"
log ""
log "Próximos passos:"
log "  1. Configure sua chave de API:"
log "       nano $INSTALL_DIR/.env"
log "     (adicione: OPENROUTER_API_KEY=sk-or-v1-...)"
log ""
log "  2. Inicie o MWCode:"
log "       cd $INSTALL_DIR && pnpm dev"
log ""
log "Acesso:"
log "  UI:    http://localhost:5173"
log "  API:   http://localhost:3100"
log "  Saúde: http://localhost:3100/api/health"
log ""

read -p "$(echo -e '${CYAN}Deseja iniciar agora? (s/n): ${RESET}')" -n 1 -r resposta
echo
if [[ "$resposta" =~ ^[Ss]$ ]]; then
    cd "$INSTALL_DIR"
    nohup pnpm dev > /tmp/mwcode.log 2>&1 &
    sleep 5
    ok "MWCode iniciado!"
    log "Acesse: http://localhost:5173"
fi