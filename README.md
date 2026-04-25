# MWCode - Sistema Unico de Agentes de IA

Um sistema flexível de agentes de IAopen-source, construido com React + Node.js.

## 🇧🇷 100% Português Brasileiro

---

## 🚀 Instalação Rápida

```bash
curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/install-unico.sh -o /tmp/install.sh && bash /tmp/install.sh
```

---

## ✨ Funcionalidades

### Para Usuários
- **Modo Pessoal** - Seu assistente de IA pessoal
- **Interface Moderna** - UI bonita e intuitiva
- **Multi-Provedor** - OpenRouter, OpenAI, Gemini, DeepSeek, Ollama

### Para Empresas
- **Dashboard Corporativa** - Gestão completa
- **Sistema de Agentes** - Contrate agentes como funcionários
- **Hierarquia** - CEO → CTO → Engs → etc
- **Orçamento** - Controle de custos por agente
- **Skills** - Customize seu agente

### Segurança
- **Login Seguro** - JWT + bcrypt
- **Auth middleware** - Todas rotas protegidas
- **Multi-usuário** - Cada empresa com seus dados

---

## 📱 Screenshots

![Dashboard](./docs/dashboard.png)

---

## 🏗️ Arquitetura

```
mwcode/
├── server/          # API REST (Express)
│   └── src/
│       ├── routes/   # /auth, /chat, /agents, /skills
│       └── services/
├── ui/             # Frontend (React + Vite)
│   └── src/
│       ├── pages/   # Login, Dashboard, Chat
│       └── components/
├── packages/       # Workspace compartilhado
│   ├── adapters/   # OpenRouter, OpenAI, etc
│   ├── shared/     # Types, validators
│   └── db/         # Schema (futuro)
└── data/           # Dados persistidos
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
| GET | /api/enterprise/agents | Listar agentes |
| POST | /api/enterprise/agents/hire | Contratar agente |
| DELETE | /api/enterprise/agents/:id | Demitir agente |
| GET | /api/skills | Listar skills |
| POST | /api/skills | Criar skill |
| GET | /api/memories | Listar memórias |
| POST | /api/memories | Salvar memória |

---

## 🤖 Modelos Gratuitos

| Modelo | Custo | Melhor para |
|--------|------|-------------|
| deepseek/deepseek-coder | Grátis | Código |
| meta-llama/llama-3.2-90b | Grátis | Qualidade |
| qwen/qwen-2.5-72b | Grátis | Melhor qualidade |

---

## 🛠️ Développement

```bash
# Clone
git clone https://github.com/mweslley/mwcode.git
cd mwcode

# Install
pnpm install

# Dev
pnpm dev
```

---

## 📄 Licença

MIT

---

## 🙏 Agradecimentos

Inspirado em:
- [Paperclip](https://github.com/peakcool/paperclip) - Sistema de agentes empresariales
- [OpenCode](https://github.com/opencode-ai/opencode) - IA agent
- [OpenClaude](https://github.com/nickcarlos/OpenClaude) - Claude CLI