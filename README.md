# MWCode — Sistema de Agentes de IA

Plataforma open-source de agentes de IA para gerenciar equipes de assistentes como funcionários da sua empresa. Construído com **React + Node.js**, **100% em português brasileiro**.

Pertence à empresa [**Loja MWO**](https://lojamwo.com.br), fundada por **Michel Weslley**.

[![License](https://img.shields.io/badge/license-MIT-2563eb)](LICENSE)
[![Node](https://img.shields.io/badge/node-20+-339933)](https://nodejs.org/)
[![PT-BR](https://img.shields.io/badge/idioma-pt--BR-009c3b)](#)

---

## 🚀 Instalação rápida (Linux / VPS)

```bash
curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/install-unico.sh -o /tmp/install-mwcode.sh && bash /tmp/install-mwcode.sh
```

O instalador faz, em ordem:

1. Verifica Node.js 20+ e instala pnpm se necessário
2. Clona o MWCode em `/opt/mwcode`
3. Instala todas as dependências
4. Libera as portas 3100 no firewall
5. Compila a UI e inicia o servidor
6. Mostra a URL pronta para acessar

> 💡 Cada usuário configura sua própria chave de API diretamente no app — sem precisar editar o `.env` do servidor.

---

## 🌐 Como acessar

| Serviço | Porta | URL |
|---------|-------|-----|
| Interface (UI) | 3100 | `http://SEU-IP:3100` |
| API REST | 3100 | `http://SEU-IP:3100/api` |
| Status | 3100 | `http://SEU-IP:3100/api/health` |

```bash
# Descobrir o IP público do VPS
curl ifconfig.me
```

---

## ✨ Funcionalidades

### 🏢 Workspace de Agentes

- **Onboarding guiado** — configure empresa, missão, metas e chave de API em 4 passos
- **CEO automático** — um agente CEO é criado no onboarding para orquestrar sua equipe
- **Contratar / demitir agentes** — cada agente tem função, modelo, personalidade e skills próprias
- **Aprovação humana** — mensagens com `[APROVAÇÃO NECESSÁRIA]` pedem confirmação antes de agir
- **Dashboard** — visão geral dos agentes ativos, tarefas e atividade recente

### 💬 Chat

- **Histórico persistido** — conversas salvas por usuário e por agente
- **Multi-agente** — converse com vários agentes em sequência na mesma janela
- **Deletar conversa** — apague o histórico de qualquer thread pelo sidebar
- **Cancelar envio** — interrompa uma resposta em andamento

### ⚙️ Configurações por Usuário

- **Chaves de API individuais** — cada usuário usa sua própria conta (OpenRouter, OpenAI, Gemini, DeepSeek)
- **Validação em tempo real** — o sistema testa a chave no provedor e confirma antes de salvar
- **Modelos reais** — lista de modelos buscada direto da API do provedor ao configurar
- **Perfil editável** — nome, email e senha pelo painel de configurações

### 🔁 Workflows

- **Agendamento automático** — execute mensagens para agentes em horários definidos (cron)
- **Fuso Brasília** — horários configurados em BRT, convertidos automaticamente para UTC
- **Presets prontos** — "Todo dia às 9h", "Toda segunda", etc.
- **Ativar/pausar** — toggle rápido por workflow

### 🛠 Skills

- **Skills personalizadas** — crie habilidades específicas (ex: "revisor de código", "copywriter")
- **Atribuir a agentes** — associe skills a agentes pelo modal de edição
- **CLI de gerenciamento** — `bash scripts/skills.sh` para criar, listar e usar skills pelo terminal

---

## 🤖 Provedores suportados

| Provider | Modelos | Chave grátis |
|----------|---------|--------------|
| **OpenRouter** ⭐ | 200+ modelos (Llama, Gemini, DeepSeek, etc.) | [openrouter.ai/keys](https://openrouter.ai/keys) |
| OpenAI | GPT-4o, GPT-4o-mini | [platform.openai.com](https://platform.openai.com) |
| Google Gemini | Gemini 1.5 Flash, Pro | [aistudio.google.com](https://aistudio.google.com) |
| DeepSeek | DeepSeek Chat, Coder | [platform.deepseek.com](https://platform.deepseek.com) |
| Ollama | Qualquer modelo local | [ollama.com](https://ollama.com) — sem internet |

---

## 📡 API REST — endpoints principais

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/auth/register` | Criar conta |
| `POST` | `/api/auth/login` | Login (retorna JWT) |
| `PUT` | `/api/auth/profile` | Editar nome/email/senha |
| `GET/PUT` | `/api/user/keys` | Chaves de API do usuário |
| `GET` | `/api/models/validate?provider=X` | Validar chave de API |
| `GET` | `/api/models/list?provider=X` | Listar modelos do provider |
| `POST` | `/api/chat/:agentId` | Conversar com agente |
| `GET` | `/api/chat/:agentId` | Histórico de conversa |
| `DELETE` | `/api/chat/:agentId` | Apagar histórico |
| `GET` | `/api/enterprise/company` | Dados da empresa |
| `POST` | `/api/enterprise/company` | Criar/atualizar empresa |
| `GET` | `/api/enterprise/agents` | Listar agentes |
| `POST` | `/api/enterprise/agents/hire` | Contratar agente |
| `DELETE` | `/api/enterprise/agents/:id` | Demitir agente |
| `GET/POST` | `/api/skills` | Listar / criar skills |
| `GET/POST` | `/api/workflows` | Listar / criar workflows |
| `GET/POST` | `/api/memories` | Listar / salvar memórias |

---

## 📁 Estrutura do projeto

```
mwcode/
├── server/             # API REST (Express + TypeScript)
│   └── src/
│       ├── routes/     # auth, chat, skills, enterprise, workflows, models, ...
│       └── middleware/ # JWT, company scope
├── ui/                 # Frontend (React + Vite)
│   └── src/
│       ├── pages/      # Login, Onboarding, Dashboard, Chat, Agents, Workflows, Settings
│       └── components/ # ModelPicker, MessageRenderer, ...
├── packages/
│   ├── adapters/       # provedores de IA (OpenRouter, OpenAI, Gemini, Ollama, DeepSeek)
│   └── shared/         # tipos e constantes compartilhadas
├── scripts/
│   └── skills.sh       # CLI para gerenciar skills pelo terminal
├── install-unico.sh    # instalador Linux/VPS
└── install-unico.ps1   # instalador Windows
```

**Dados em runtime** ficam em `~/.mwcode/data/` (fora do código):

```
~/.mwcode/data/
├── users.json           # contas
├── keys/{userId}.json   # chaves de API por usuário
├── agents/{userId}/     # agentes contratados
├── chats/{userId}/      # histórico de conversas
├── memories/{userId}/   # memórias persistidas
└── skills/{userId}/     # skills criadas
```

---

## 🔧 Desenvolvimento local

```bash
# 1. Clonar
git clone https://github.com/mweslley/mwcode.git
cd mwcode

# 2. Instalar dependências
pnpm install

# 3. (Opcional) Chave de API padrão do servidor
cp .env.example .env
# Edite .env com sua OPENROUTER_API_KEY — usuários podem sobrescrever com a própria chave

# 4. Rodar em modo dev
pnpm dev
```

- **UI:** http://localhost:5173
- **API:** http://localhost:3100

```bash
pnpm dev:server   # só a API
pnpm dev:ui       # só a interface
```

---

## 🔄 Atualizar

```bash
bash /opt/mwcode/update.sh
```

Faz `git pull` + `pnpm install` + rebuild + reinicia o servidor.

---

## 🌍 Produção (domínio + HTTPS)

```bash
bash setup-nginx.sh              # nginx como reverse proxy
bash setup-https.sh seudominio.com  # HTTPS grátis com Let's Encrypt
pm2 startup && pm2 save          # manter rodando após reboot
```

Guia completo em [doc/VPS.md](doc/VPS.md).

---

## 🔒 Segurança

- `.env` com permissão `600` (`chmod 600 .env`)
- HTTPS obrigatório em produção
- Autenticação JWT em todas as rotas protegidas
- Dados de usuários em `~/.mwcode/data/` — faça backup regularmente
- Reportar vulnerabilidades: **suporte@lojamwo.com.br**

---

## 🤝 Comunidade

- [GitHub Issues](https://github.com/mweslley/mwcode/issues) — bugs e sugestões
- [CONTRIBUTING.md](CONTRIBUTING.md) — como contribuir
- Site: **[lojamwo.com.br](https://lojamwo.com.br)**
- E-mail: **suporte@lojamwo.com.br**

---

## 📄 Licença

[MIT](LICENSE) — use, modifique e distribua livremente.
