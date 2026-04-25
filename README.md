# MWCode - Sistema Único de Agentes de IA

Um sistema de agentes de IA open-source, construído com React + Node.js.

## 🇧🇷 100% Português Brasileiro

---

## 🚀 Instalação Rápida

```bash
curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/install-unico.sh -o /tmp/install-mwcode.sh && bash /tmp/install-mwcode.sh
```

O instalador pergunta:
1. Provedor de IA
2. Chave API (escondida)

---

## 🌐 Acessos

| Serviço | Porta | URL |
|--------|-------|-----|
| UI (Frontend) | 5173 | http://localhost:5173 |
| API (Backend) | 3100 | http://localhost:3100 |

---

## ✨ Funcionalidades

### Modo Pessoal
- Chat com IA
- Múltiplos provedores (OpenRouter, OpenAI, Gemini, DeepSeek, Ollama)
- Memórias persistidas
- Skills customizáveis

### Modo Empresa (Dashboard)
- Sistema de agentes como funcionários
- Hierarquia: CEO → CTO → Engs → etc
- Controle de orçamento
- Contratar/demitir agentes
- Login JWT

---

## 📁 Estrutura

```
mwcode/
├── server/          # API REST (Express)
│   └── src/
│       ├── routes/   # /auth, /chat, /agents, /enterprise
│       └── middleware/
├── ui/             # Frontend (React + Vite)
│   └── src/
│       ├── pages/   # Login, Register, Dashboard, Chat
│       └── lib/     # API client
├── packages/       # Workspace
│   ├── adapters/   # Provedores de IA
│   └── shared/     # Types
└── data/          # Dados (JSON)
    ├── users.json
    ├── memories/
    ├── skills/
    └── agents/
```

---

## 📡 API

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | /api/auth/register | Criar conta |
| POST | /api/auth/login | Login |
| GET | /api/chat/single | Chat modo pessoal |
| POST | /api/chat/:agentId | Chat com agente |
| GET | /api/enterprise/company | Dados da empresa |
| POST | /api/enterprise/agents/hire | Contratar agente |
| GET | /api/skills | Listar skills |
| POST | /api/skills | Criar skill |
| GET | /api/memories | Listar memórias |
| POST | /api/memories | Salvar memória |

---

## 🤖 Modelos Gratuitos

| Modelo | Provider | Uso |
|--------|----------|-----|
| deepseek/deepseek-coder | OpenRouter | Código |
| meta-llama/llama-3.2-90b | OpenRouter | Qualidade |
| qwen/qwen-2.5-72b | OpenRouter | Melhor qualidade |

---

## 🔧 Desenvolvimento

```bash
# Clone
git clone https://github.com/mweslley/mwcode.git
cd mwcode

# Instalar
pnpm install

# Dev
pnpm dev
```

---

## ⚙️ Variáveis de Ambiente

```bash
OPENROUTER_API_KEY=sk-...    # OpenRouter
OPENAI_API_KEY=sk-...    # OpenAI
GEMINI_API_KEY=...        # Google
MWCODE_PROVIDER=openrouter
MWCODE_MODEL=qwen/qwen-2.5-72b-instruct
```

---

## 📄 Licença

MIT

---

## 🙏 Agradecimentos

Inspirado em:
- [Paperclip](https://github.com/peakcool/paperclip)
- [OpenCode](https://github.com/opencode-ai/opencode)
- [OpenClaude](https://github.com/nickcarlos/OpenClaude)