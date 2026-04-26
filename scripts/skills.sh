#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# skills.sh — CLI para gerenciar Skills do MWCode
#
# Uso:
#   skills.sh list                            Lista suas skills
#   skills.sh get <id|nome>                   Mostra detalhes de uma skill
#   skills.sh add <nome> <prompt>             Cria nova skill (prompt = system prompt)
#   skills.sh add -f <nome> <arquivo.txt>     Cria skill lendo prompt de arquivo
#   skills.sh use <id|nome>                   Define como skill padrão (salva em ~/.mwcode/skill)
#   skills.sh default                         Mostra skill padrão atual
#   skills.sh delete <id|nome>                Remove uma skill
#   skills.sh chat <id|nome> "<mensagem>"     Chata com uma skill específica
#   skills.sh templates                       Lista templates disponíveis
#
# Config:
#   MWCODE_URL  — URL do servidor (padrão: http://localhost:3100)
#   MWCODE_TOKEN — JWT de autenticação (salvo em ~/.mwcode/token após login)
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

MWCODE_URL="${MWCODE_URL:-http://localhost:3100}"
TOKEN_FILE="${HOME}/.mwcode/token"
SKILL_FILE="${HOME}/.mwcode/skill"

# ── Helpers ───────────────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()  { echo -e "${CYAN}ℹ${RESET}  $*"; }
ok()    { echo -e "${GREEN}✓${RESET}  $*"; }
warn()  { echo -e "${YELLOW}⚠${RESET}  $*"; }
err()   { echo -e "${RED}✗${RESET}  $*" >&2; exit 1; }

need_cmd() { command -v "$1" &>/dev/null || err "Necessário: $1 (não encontrado)"; }

need_cmd curl
need_cmd jq

get_token() {
  local t="${MWCODE_TOKEN:-}"
  [[ -z "$t" && -f "$TOKEN_FILE" ]] && t=$(cat "$TOKEN_FILE")
  [[ -z "$t" ]] && err "Token não encontrado. Faça login primeiro:\n  skills.sh login <email> <senha>"
  echo "$t"
}

api() {
  local method="$1" path="$2" data="${3:-}"
  local token; token=$(get_token)
  local url="${MWCODE_URL}/api${path}"
  local args=(-s -f -X "$method" -H "Authorization: Bearer $token" -H "Content-Type: application/json")
  [[ -n "$data" ]] && args+=(-d "$data")
  curl "${args[@]}" "$url" || err "Falha na requisição: $method $url"
}

resolve_skill_id() {
  # Aceita ID direto ou nome parcial
  local query="$1"
  local skills; skills=$(api GET /skills)
  # Tenta ID exato primeiro, depois nome case-insensitive
  local found; found=$(echo "$skills" | jq -r --arg q "$query" '
    .[] | select(.id == $q or (.name | ascii_downcase | contains($q | ascii_downcase))) | .id' | head -1)
  [[ -z "$found" ]] && err "Skill não encontrada: $query"
  echo "$found"
}

# ── Comandos ─────────────────────────────────────────────────────────────────

cmd_login() {
  [[ $# -lt 2 ]] && err "Uso: skills.sh login <email> <senha>"
  local email="$1" pass="$2"
  local resp; resp=$(curl -s -X POST "${MWCODE_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\",\"password\":\"${pass}\"}")
  local token; token=$(echo "$resp" | jq -r '.token // empty')
  [[ -z "$token" ]] && err "Login falhou: $(echo "$resp" | jq -r '.error // "erro desconhecido"')"
  mkdir -p "$(dirname "$TOKEN_FILE")"
  echo "$token" > "$TOKEN_FILE"
  chmod 600 "$TOKEN_FILE"
  ok "Login realizado! Token salvo em $TOKEN_FILE"
}

cmd_list() {
  local skills; skills=$(api GET /skills)
  local count; count=$(echo "$skills" | jq length)
  local default_id=""
  [[ -f "$SKILL_FILE" ]] && default_id=$(cat "$SKILL_FILE")

  echo ""
  echo -e "${BOLD}Skills (${count})${RESET}"
  echo "─────────────────────────────────────────────────────"
  echo "$skills" | jq -r --arg def "$default_id" '
    .[] |
    (if .id == $def then "⭐" else "  " end) + " " +
    "\(.name)" + (if .description != "" then " — \(.description)" else "" end) +
    "\n     id: \(.id)"
  '
  echo ""
  [[ -n "$default_id" ]] && info "Skill padrão salva: $default_id"
}

cmd_get() {
  [[ $# -lt 1 ]] && err "Uso: skills.sh get <id|nome>"
  local id; id=$(resolve_skill_id "$1")
  local s; s=$(api GET "/skills/${id}")
  echo ""
  echo -e "${BOLD}$(echo "$s" | jq -r '.name')${RESET}"
  echo "─────────────────────────────────────────────────────"
  echo "$s" | jq -r '"Descrição: \(.description // "(sem descrição)")\nID:        \(.id)\nCriado em: \(.createdAt)"'
  echo ""
  echo -e "${BOLD}Prompt:${RESET}"
  echo "$s" | jq -r '.prompt'
  echo ""
}

cmd_add() {
  local from_file=false
  if [[ "${1:-}" == "-f" ]]; then
    from_file=true
    shift
  fi
  [[ $# -lt 2 ]] && err "Uso: skills.sh add <nome> <prompt>\n       skills.sh add -f <nome> <arquivo.txt>"
  local name="$1" prompt_or_file="$2"
  local desc="${3:-}"

  local prompt
  if $from_file; then
    [[ -f "$prompt_or_file" ]] || err "Arquivo não encontrado: $prompt_or_file"
    prompt=$(cat "$prompt_or_file")
  else
    prompt="$prompt_or_file"
  fi

  local payload; payload=$(jq -n --arg n "$name" --arg p "$prompt" --arg d "$desc" \
    '{"name":$n,"prompt":$p,"description":$d}')
  local result; result=$(api POST /skills "$payload")
  local id; id=$(echo "$result" | jq -r '.id')
  ok "Skill criada: $name (id: $id)"
}

cmd_use() {
  [[ $# -lt 1 ]] && err "Uso: skills.sh use <id|nome>"
  local id; id=$(resolve_skill_id "$1")
  local name; name=$(api GET "/skills/${id}" | jq -r '.name')
  mkdir -p "$(dirname "$SKILL_FILE")"
  echo "$id" > "$SKILL_FILE"
  ok "Skill padrão definida: $name ($id)"
  info "Salvo em $SKILL_FILE"
}

cmd_default() {
  [[ -f "$SKILL_FILE" ]] || { info "Nenhuma skill padrão definida."; return; }
  local id; id=$(cat "$SKILL_FILE")
  local s; s=$(api GET "/skills/${id}" 2>/dev/null || echo '{}')
  local name; name=$(echo "$s" | jq -r '.name // "Skill removida"')
  echo -e "Skill padrão: ${BOLD}${name}${RESET} (${id})"
}

cmd_delete() {
  [[ $# -lt 1 ]] && err "Uso: skills.sh delete <id|nome>"
  local id; id=$(resolve_skill_id "$1")
  local name; name=$(api GET "/skills/${id}" | jq -r '.name')
  read -r -p "Confirmar exclusão de '${name}'? [s/N] " ans
  [[ "$ans" =~ ^[sS]$ ]] || { warn "Cancelado."; return; }
  api DELETE "/skills/${id}" > /dev/null
  ok "Skill removida: $name"
  # Limpa padrão se era esta
  if [[ -f "$SKILL_FILE" ]] && [[ "$(cat "$SKILL_FILE")" == "$id" ]]; then
    rm "$SKILL_FILE"
    warn "Skill padrão foi limpa."
  fi
}

cmd_chat() {
  [[ $# -lt 2 ]] && err "Uso: skills.sh chat <id|nome> \"<mensagem>\""
  local id; id=$(resolve_skill_id "$1")
  local msg="$2"
  local s; s=$(api GET "/skills/${id}")
  local skill_prompt; skill_prompt=$(echo "$s" | jq -r '.prompt')
  local name; name=$(echo "$s" | jq -r '.name')
  info "Usando skill: $name"
  local payload; payload=$(jq -n --arg m "$msg" --arg sys "$skill_prompt" \
    '{"message":$m,"system":$sys}')
  local result; result=$(api POST /chat/single "$payload")
  echo ""
  echo -e "${BOLD}Resposta:${RESET}"
  echo "$result" | jq -r '.content'
  echo ""
}

cmd_templates() {
  echo ""
  echo -e "${BOLD}Templates disponíveis no MWCode${RESET}"
  echo "─────────────────────────────────────────────────────"
  printf "%-30s %s\n" "Nome" "Descrição"
  echo "─────────────────────────────────────────────────────"
  local templates=(
    "Revisor de código|Revisa código apontando bugs, performance e melhorias"
    "Copywriter Instagram|Cria legendas otimizadas com hashtags e CTA"
    "Tradutor PT ↔ EN|Traduz textos preservando tom e contexto"
    "Analista de dados|Analisa dados, gera insights e propõe ações"
    "Suporte ao cliente|Atende clientes com empatia"
    "Estrategista de marketing|Cria estratégias baseadas em objetivos"
  )
  for t in "${templates[@]}"; do
    local name="${t%%|*}" desc="${t##*|}"
    printf "%-30s %s\n" "$name" "$desc"
  done
  echo ""
  info "Para adicionar um template: abra o MWCode no navegador → Skills → Adicionar"
}

# ── Main ──────────────────────────────────────────────────────────────────────

usage() {
  echo ""
  echo -e "${BOLD}skills.sh${RESET} — MWCode Skills CLI"
  echo ""
  echo "Uso: skills.sh <comando> [args...]"
  echo ""
  echo "Comandos:"
  printf "  %-30s %s\n" "login <email> <senha>"    "Autentica e salva o token"
  printf "  %-30s %s\n" "list"                      "Lista todas as suas skills"
  printf "  %-30s %s\n" "get <id|nome>"             "Mostra detalhes de uma skill"
  printf "  %-30s %s\n" "add <nome> <prompt>"       "Cria nova skill"
  printf "  %-30s %s\n" "add -f <nome> <arquivo>"   "Cria skill com prompt de arquivo"
  printf "  %-30s %s\n" "use <id|nome>"             "Define skill padrão"
  printf "  %-30s %s\n" "default"                   "Mostra skill padrão atual"
  printf "  %-30s %s\n" "delete <id|nome>"          "Remove uma skill"
  printf "  %-30s %s\n" "chat <id|nome> \"mensagem\"" "Conversa usando a skill"
  printf "  %-30s %s\n" "templates"                 "Lista templates disponíveis"
  echo ""
  echo "Variáveis de ambiente:"
  printf "  %-30s %s\n" "MWCODE_URL"   "URL do servidor (padrão: http://localhost:3100)"
  printf "  %-30s %s\n" "MWCODE_TOKEN" "JWT de autenticação (ou salvo em ~/.mwcode/token)"
  echo ""
}

cmd="${1:-}"
shift || true

case "$cmd" in
  login)      cmd_login "$@" ;;
  list|ls)    cmd_list ;;
  get|show)   cmd_get "$@" ;;
  add|create) cmd_add "$@" ;;
  use|set)    cmd_use "$@" ;;
  default)    cmd_default ;;
  delete|rm)  cmd_delete "$@" ;;
  chat)       cmd_chat "$@" ;;
  templates)  cmd_templates ;;
  ""|-h|--help|help) usage ;;
  *) err "Comando desconhecido: $cmd\n$(usage)" ;;
esac
