# 📦 Guia de Instalação

---

## 1. Instalação rápida (Linux / VPS) — recomendado

```bash
curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/install-unico.sh -o /tmp/install-mwcode.sh && bash /tmp/install-mwcode.sh
```

O instalador:
1. Verifica Node.js 20+ (instala via nvm se faltar)
2. Instala pnpm se necessário
3. Clona o MWCode em `/opt/mwcode`
4. Instala dependências
5. Compila a UI
6. Libera porta 3100 no firewall
7. Inicia o servidor em background

Acesse em: `http://SEU-IP:3100`

> As chaves de API são configuradas pelo próprio usuário dentro do app — sem precisar editar o `.env`.

---

## 2. Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/mweslley/mwcode/main/install-unico.ps1 | iex
```

---

## 3. Manual (qualquer sistema)

```bash
# 1. Clonar
git clone https://github.com/mweslley/mwcode.git
cd mwcode

# 2. Instalar pnpm (se não tiver)
npm install -g pnpm

# 3. Instalar dependências
pnpm install

# 4. (Opcional) Configurar chave padrão do servidor
cp .env.example .env
# edite .env com OPENROUTER_API_KEY ou outra chave

# 5. Rodar em dev
pnpm dev
```

- UI: http://localhost:5173
- API: http://localhost:3100

---

## 4. Docker

```bash
git clone https://github.com/mweslley/mwcode.git
cd mwcode/docker
cp ../.env.example ../.env
docker compose up -d
```

Acesse: http://localhost:3100

---

## 🔑 Chaves de API

Cada usuário configura sua própria chave diretamente no app (onboarding ou aba Configurações → Chaves de API).

Provedores suportados:

| Provider | Chave grátis |
|----------|-------------|
| **OpenRouter** ⭐ | [openrouter.ai/keys](https://openrouter.ai/keys) |
| OpenAI | [platform.openai.com](https://platform.openai.com/api-keys) |
| Google Gemini | [aistudio.google.com](https://aistudio.google.com/apikey) |
| DeepSeek | [platform.deepseek.com](https://platform.deepseek.com/api_keys) |
| Ollama | local, sem chave ([ollama.com](https://ollama.com)) |

---

## 🔄 Atualizar

```bash
bash /opt/mwcode/update.sh
```

Ou manualmente:

```bash
cd /opt/mwcode
git pull
pnpm install
pnpm build
pm2 restart mwcode
```

---

## 🗑️ Desinstalar

```bash
# Remover código
sudo rm -rf /opt/mwcode

# Remover dados (CUIDADO: apaga todos os usuários, agentes e histórico)
rm -rf ~/.mwcode/data
```
