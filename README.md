# MWCode — Sistema Único de Agentes de IA

Plataforma open-source de agentes de IA que une **Modo Pessoal** (assistente individual) e **Modo Empresa** (gestão de múltiplos agentes como funcionários) em uma única instalação. Construído com **React + Node.js**, **100% em português brasileiro**.

Pertence à empresa [**Loja MWO**](https://lojamwo.com.br), fundada por **Michel Weslley**. O projeto democratiza o acesso a agentes de IA para empresas e desenvolvedores brasileiros, permitindo criar **assistentes personalizados**, gerenciar equipes de agentes e integrar múltiplos provedores em uma única plataforma.

[![License](https://img.shields.io/badge/license-MIT-2563eb)](LICENSE)
[![Node](https://img.shields.io/badge/node-20+-339933)](https://nodejs.org/)
[![PT-BR](https://img.shields.io/badge/idioma-pt--BR-009c3b)](#)

---

## 🚀 Instalação rápida (Linux / VPS)

Um comando instala, configura e inicia tudo:

```bash
curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/install-unico.sh -o /tmp/install-mwcode.sh && bash /tmp/install-mwcode.sh
```

O instalador faz, em ordem:

1. Verifica Node.js 20+ e instala pnpm se faltar
2. Clona o MWCode em `/opt/mwcode`
3. Instala todas as dependências (`pnpm install`)
4. **Pergunta seu provedor de IA** (1=OpenRouter, 2=OpenAI, 3=Gemini, 4=DeepSeek, 5=Ollama)
5. **Pede sua chave de API** (digitação invisível) e **valida** com o provedor antes de salvar
6. Libera as portas 3100 (API) e 5173 (UI) no firewall (UFW ou iptables)
7. Compila a UI (`pnpm build`)
8. Inicia o servidor + UI em background
9. Mostra as URLs prontas pra acessar

> 💡 **Onde pegar chave grátis:** [openrouter.ai/keys](https://openrouter.ai/keys) — modelos como Llama 3.2, DeepSeek e Qwen são gratuitos.

---

## 🌐 Como acessar depois de instalar

| Serviço | Porta | URL local | URL via VPS |
|---------|-------|-----------|-------------|
| Interface (UI) | 5173 | `http://localhost:5173` | `http://SEU-IP:5173` |
| API REST | 3100 | `http://localhost:3100` | `http://SEU-IP:3100` |
| Status / saúde | 3100 | `http://localhost:3100/api/health` | — |

Pra descobrir o IP público do seu VPS:
```bash
curl ifconfig.me
```

> ⚠️ Em VPS, **não** use `localhost` no navegador do seu PC — `localhost` aponta pro seu próprio computador. Use o IP do servidor.

---

## ✨ Funcionalidades

### 👤 Modo Pessoal — para uso individual

Cada usuário tem seu próprio espaço com:

- **Chat com IA** — converse direto com qualquer modelo dos provedores configurados
- **Múltiplos provedores** — OpenRouter, OpenAI, Gemini, DeepSeek e Ollama (modelos locais)
- **Memórias persistidas** — o agente lembra de conversas anteriores e preferências (salvas em `data/memories/`)
- **Skills customizáveis** — você cria habilidades específicas (ex: "revisor de código", "tradutor jurídico") e ativa quando precisar
- **Login com JWT** — sua conta protegida, dados isolados de outros usuários

### 🏢 Modo Empresa — gestão de equipes de agentes

Trate agentes de IA como funcionários da sua empresa:

- **Hierarquia organizacional** — CEO → CTO → Engenheiros → outros cargos
- **Contratar / demitir agentes** — adicione agentes com função, modelo e personalidade definidos
- **Controle de orçamento** — limite gastos por agente, monitore custos em tempo real
- **Dashboard executivo** — veja todos os agentes ativos, tarefas em andamento e desempenho
- **Atribuição de tarefas** — distribua trabalho entre agentes com prioridades
- **Auditoria** — histórico de cada agente (contratação, tarefas concluídas, demissão e motivo)

---

## 🤖 Modelos gratuitos recomendados

Disponíveis via OpenRouter (basta colocar a chave grátis):

| Modelo | Melhor para | Provider |
|--------|-------------|----------|
| `deepseek/deepseek-coder` | Programação e geração de código | OpenRouter |
| `meta-llama/llama-3.2-90b-instruct` | Conversas longas e raciocínio | OpenRouter |
| `qwen/qwen-2.5-72b-instruct` | Melhor qualidade geral grátis | OpenRouter |
| `google/gemini-2.0-flash-exp:free` | Rápido e bom em pt-BR | OpenRouter |

Pra modelos locais (sem chave nem internet), use **Ollama**: [ollama.com/download](https://ollama.com/download)

---

## 📡 API REST — endpoints principais

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/auth/register` | Criar conta de usuário |
| `POST` | `/api/auth/login` | Login (retorna JWT) |
| `GET` | `/api/chat/single` | Chat do modo pessoal |
| `POST` | `/api/chat/:agentId` | Conversar com um agente específico |
| `GET` | `/api/enterprise/company` | Dados da empresa do usuário logado |
| `POST` | `/api/enterprise/agents/hire` | Contratar novo agente |
| `DELETE` | `/api/enterprise/agents/:id` | Demitir agente |
| `GET` | `/api/skills` | Listar suas skills |
| `POST` | `/api/skills` | Criar nova skill |
| `GET` | `/api/memories` | Listar memórias |
| `POST` | `/api/memories` | Salvar memória |

Documentação completa de cada rota em [doc/](doc/).

---

## 📁 Estrutura do projeto

```
mwcode/
├── server/             # API REST (Express)
│   └── src/
│       ├── routes/      # /auth, /chat, /skills, /memories, /enterprise
│       └── middleware/  # autenticação, escopo de empresa
├── ui/                 # Frontend (React + Vite)
│   └── src/
│       ├── pages/       # Login, Register, Onboarding, Dashboard, Chat
│       └── lib/         # cliente HTTP da API
├── packages/           # workspace pnpm
│   ├── adapters/       # provedores de IA (OpenRouter, OpenAI, Gemini, ...)
│   └── shared/         # tipos compartilhados
├── data/               # dados persistidos (criado em runtime)
│   ├── users.json       # contas de usuário
│   ├── memories/        # 1 arquivo JSON por usuário
│   ├── skills/          # 1 arquivo JSON por usuário
│   └── agents/          # agentes empresariais
├── install-unico.sh    # instalador único (Linux/VPS)
├── install-unico.ps1   # instalador único (Windows)
└── doc/                # documentação operacional
```

---

## 🔧 Desenvolvimento (rodar localmente)

Pra contribuir ou testar mudanças no código:

```bash
# 1. Clonar
git clone https://github.com/mweslley/mwcode.git
cd mwcode

# 2. Instalar dependências
pnpm install

# 3. Configurar chave de API
cp .env.example .env
nano .env   # cole sua OPENROUTER_API_KEY (ou outra)

# 4. Rodar em modo dev (hot reload)
pnpm dev
```

- **UI:** http://localhost:5173 (Vite, hot reload)
- **API:** http://localhost:3100 (tsx watch)

Pra rodar só uma parte:
```bash
pnpm dev:server   # só a API
pnpm dev:ui       # só a interface
```

---

## 🌍 Deploy em VPS (produção)

Depois de instalar com `install-unico.sh`, pra colocar em produção com domínio próprio + HTTPS:

```bash
# 1. nginx como reverse proxy
bash setup-nginx.sh

# 2. HTTPS grátis com Let's Encrypt
bash setup-https.sh seudominio.com

# 3. Manter rodando após reboot (PM2)
pm2 startup
pm2 save
```

Guia completo em [doc/VPS.md](doc/VPS.md).

---

## 🔄 Atualizar para a versão mais nova

```bash
bash /opt/mwcode/update.sh
```

Faz `git pull` + `pnpm install` + reinicia o servidor automaticamente.

---

## 🔒 Segurança

Antes de expor em produção, leia [SECURITY.md](SECURITY.md). Pontos essenciais:

- `.env` com permissão `600` (`chmod 600 .env`)
- HTTPS obrigatório (nginx + Let's Encrypt)
- Autenticação JWT já implementada — **ative em produção**
- Rate limiting recomendado (express-rate-limit)
- Backup do diretório `data/` (contém usuários, memórias, skills)
- Reportar vulnerabilidades: **suporte@lojamwo.com.br**

---

## 🤝 Comunidade & Contribuir

- [GitHub Issues](https://github.com/mweslley/mwcode/issues) — bugs e sugestões
- [CONTRIBUTING.md](CONTRIBUTING.md) — como fazer fork, abrir PR, padrões de código
- [SECURITY.md](SECURITY.md) — práticas de segurança e como reportar vulnerabilidades
- E-mail: **suporte@lojamwo.com.br**
- Site da empresa: **[lojamwo.com.br](https://lojamwo.com.br)**

---

## 📄 Licença

[MIT](LICENSE) — use, modifique e distribua livremente, inclusive comercialmente.
