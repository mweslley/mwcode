# MWCode — Plataforma de Agentes de IA

<p align="center">
  <strong>Gerencie equipes de agentes de IA como funcionários da sua empresa. 100% em português brasileiro.</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-9230F9" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/node-20+-339933" alt="Node 20+">
  <img src="https://img.shields.io/badge/idioma-pt--BR-009c3b" alt="PT-BR">
  <img src="https://img.shields.io/badge/stack-React%20%2B%20Node.js-00BC8A" alt="Stack">
</p>

<p align="center">
  Desenvolvido por <a href="https://lojamwo.com.br" target="_blank" rel="noopener noreferrer"><strong>Loja MWO</strong></a> · 
  <a href="https://github.com/mweslley/mwcode/issues" target="_blank" rel="noopener noreferrer">Reportar bug</a> · 
  <a href="https://github.com/mweslley/mwcode/issues" target="_blank" rel="noopener noreferrer">Sugerir feature</a>
</p>

---

## O que é o MWCode?

O MWCode é uma plataforma open-source que permite criar e gerenciar **equipes de agentes de IA** como se fossem funcionários de uma empresa. Cada agente tem cargo, personalidade, modelo de IA, habilidades (skills) e histórico de conversas. Você contrata, instrui, acompanha e demite agentes — tudo via interface web ou API.

**Diferente de outros chatbots**, o MWCode é pensado para **gestão organizacional com IA**: um CEO orquestra outros agentes, delega tarefas, pede aprovação humana antes de ações importantes e gera relatórios automáticos via workflows agendados.

---

## 🚀 Instalação rápida em VPS (Linux)

> **Pré-requisito:** Um servidor VPS com Ubuntu 22.04+, Debian 12+ ou similar, com acesso SSH.

Execute este único comando no seu servidor:

```bash
curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/install-unico.sh \
  -o /tmp/install-mwcode.sh && bash /tmp/install-mwcode.sh
```

**O que o instalador faz automaticamente:**

1. Verifica se Node.js 20+ está instalado (instala via nvm se necessário)
2. Instala o gerenciador de pacotes `pnpm`
3. Clona o repositório em `/opt/mwcode`
4. Instala todas as dependências do projeto
5. Compila a interface web (UI)
6. Libera a porta `3100` no firewall (UFW ou iptables)
7. Inicia o servidor em background
8. Exibe a URL de acesso

Após a instalação, acesse pelo navegador:

```
http://SEU-IP-DO-VPS:3100
```

Para descobrir o IP público do seu VPS:

```bash
curl ifconfig.me
```

> ⚠️ **Atenção:** Se estiver acessando de outro computador, use o IP do servidor — **não** `localhost`.  
> `localhost` aponta para o seu próprio computador, não para o VPS.

---

## 💻 Instalação no Windows

Abra o **PowerShell como Administrador** e execute:

```powershell
irm https://raw.githubusercontent.com/mweslley/mwcode/main/install-unico.ps1 | iex
```

---

## 🛠️ Instalação manual (qualquer sistema)

Caso prefira controle total sobre a instalação:

```bash
# 1. Clonar o repositório
git clone https://github.com/mweslley/mwcode.git
cd mwcode

# 2. Instalar o pnpm (se não tiver)
npm install -g pnpm

# 3. Instalar todas as dependências
pnpm install

# 4. (Opcional) Criar arquivo de configuração
cp .env.example .env
# Edite o .env se quiser definir uma chave de API padrão para o servidor
# Usuários também podem configurar a própria chave dentro do app

# 5. Iniciar em modo desenvolvimento
pnpm dev
```

Acesse:
- **Interface:** <a href="http://localhost:5173" target="_blank" rel="noopener noreferrer">http://localhost:5173</a>
- **API:** <a href="http://localhost:3100" target="_blank" rel="noopener noreferrer">http://localhost:3100</a>

---

## 🔑 Chaves de API — Como funciona

O MWCode conecta diretamente aos provedores de IA usando **a chave de API de cada usuário**. Isso significa:

- Cada usuário cadastrado usa sua própria conta no provedor de IA
- As despesas vão direto para a conta do usuário — sem intermediário
- Usuários diferentes podem usar provedores e modelos diferentes
- As chaves são configuradas no onboarding (primeiro acesso) ou depois em **Configurações → Chaves de API**
- O sistema **valida a chave em tempo real** antes de salvar — você sabe na hora se está correta

---

## 🤖 Provedores de IA suportados

### <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer">OpenRouter</a> — ⭐ Recomendado

O OpenRouter é um **agregador de modelos de IA** que dá acesso a mais de 200 modelos diferentes com uma única chave de API. É o provedor recomendado por ser o mais flexível.

**Como criar sua chave:**
1. Acesse <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">openrouter.ai/keys</a>
2. Crie uma conta gratuita (email + senha)
3. Gere uma chave API — é instantâneo e gratuito

**⚠️ Importante — Modelos gratuitos vs. pagos:**

A chave OpenRouter em si **não custa nada**, mas o uso dos modelos depende:

| Tipo de modelo | Como identificar | Custo |
|---|---|---|
| **Modelos gratuitos** | Têm `:free` no ID (ex: `meta-llama/llama-3.1-8b-instruct:free`) | **$0** — sem custo nenhum |
| **Modelos pagos** | Sem `:free` (ex: `openai/gpt-4o`, `anthropic/claude-3.5-sonnet`) | Cobrado por token, deduzido dos seus créditos |

**Para usar de graça:** Você precisa **escolher modelos com a rota `:free`** na hora de configurar os agentes. O MWCode já exibe quais modelos são gratuitos na tela de seleção — são os marcados com a tag **GRÁTIS**.

**Modelos gratuitos disponíveis no OpenRouter (exemplos):**

| Modelo | ID para usar | Capacidade |
|---|---|---|
| Llama 3.1 8B | `meta-llama/llama-3.1-8b-instruct:free` | Conversas gerais, rápido |
| Llama 3.2 3B | `meta-llama/llama-3.2-3b-instruct:free` | Tarefas simples, muito rápido |
| DeepSeek V3 | `deepseek/deepseek-chat:free` | Raciocínio e código |
| Gemma 3 27B | `google/gemma-3-27b-it:free` | Bom em português |
| Qwen 3 | `qwen/qwen3-8b:free` | Tarefas gerais |

> 💡 **Dica:** No MWCode, ao clicar em "Ver todos os modelos", a lista é buscada diretamente do OpenRouter usando a sua chave — você sempre vê os modelos gratuitos mais recentes disponíveis.

**Créditos (para modelos pagos):** Se quiser usar GPT-4o, Claude, Gemini Pro e outros modelos premium, adicione créditos em <a href="https://openrouter.ai/credits" target="_blank" rel="noopener noreferrer">openrouter.ai/credits</a> a partir de $5. O desconto vem na quantidade de tokens que cada modelo cobra.

---

### <a href="https://platform.openai.com" target="_blank" rel="noopener noreferrer">OpenAI</a>

Acesso direto aos modelos GPT da OpenAI.

- **Modelos:** GPT-4o, GPT-4o mini, GPT-4 Turbo, o1, o3-mini
- **Chave:** <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">platform.openai.com/api-keys</a>
- **Custo:** Pago por uso (sem tier gratuito). Créditos a partir de $5.
- **Melhor para:** Quando você precisa da máxima qualidade em raciocínio e geração de texto

---

### <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer">Google Gemini</a>

Modelos Gemini diretamente do Google.

- **Modelos:** Gemini 1.5 Flash, Gemini 1.5 Pro, Gemini 2.0 Flash
- **Chave:** <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com/apikey</a>
- **Custo:** Gemini 1.5 Flash tem um tier gratuito generoso (requisições por minuto limitadas). Gemini Pro é pago.
- **Melhor para:** Análise de documentos longos (contexto de 1M tokens), bom desempenho em português

---

### <a href="https://platform.deepseek.com" target="_blank" rel="noopener noreferrer">DeepSeek</a>

Modelos da empresa chinesa DeepSeek — excelente relação custo-benefício.

- **Modelos:** DeepSeek Chat (V3), DeepSeek Coder
- **Chave:** <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer">platform.deepseek.com/api_keys</a>
- **Custo:** Pago, porém muito mais barato que OpenAI (~10x mais barato por token)
- **Melhor para:** Programação e raciocínio lógico com baixo custo

---

### <a href="https://ollama.com" target="_blank" rel="noopener noreferrer">Ollama</a> — Modelos Locais

Rode modelos de IA **no seu próprio computador ou servidor**, sem enviar dados para a nuvem.

- **Modelos:** Llama 3, Mistral, Qwen, DeepSeek, Phi e dezenas de outros
- **Custo:** $0 — zero, roda localmente
- **Sem internet:** Após baixar o modelo, funciona offline
- **Privacidade total:** Nenhum dado sai da sua máquina
- **Instalação:** <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer">ollama.com/download</a>

**Para usar com o MWCode:** Instale o Ollama, baixe um modelo (`ollama pull llama3`) e configure o endereço `http://localhost:11434` nas configurações do agente.

> ⚠️ **Requisito de hardware:** Modelos locais exigem memória RAM/VRAM. Um modelo de 8B parâmetros usa ~8GB de RAM. Para VPS, precisa de uma máquina com pelo menos 16GB de RAM.

---

## ✨ Funcionalidades

### 🏢 Área de Trabalho (Workspace)

**Onboarding guiado em 4 passos:**
1. **Sua empresa** — nome, área de atuação e tamanho da equipe
2. **Missão e objetivos** — define o propósito e metas que guiam o comportamento dos agentes
3. **Chave de API** — configura e valida o acesso ao provedor de IA escolhido
4. **Modelo do CEO** — escolhe o modelo de IA para o agente principal

**Editar workspace:** Após o onboarding, acesse **Área de Trabalho** na sidebar para alterar nome, missão, objetivos e área da empresa — sem precisar reiniciar o sistema.

---

### 🤖 Sistema Autônomo de Agentes (CEO Loop)

O MWCode opera como uma **empresa autônoma** — os agentes trabalham sem intervenção humana constante:

- **CEO acorda periodicamente** (padrão: a cada 4h, configurável via `CEO_HEARTBEAT_HOURS`) e analisa o estado da empresa
- **Contrata agentes automaticamente** usando `[CONTRATAR AGENTE: nome="..."; função="..."; instruções="..."]`
- **Cria e delega tarefas** para os agentes via `[CRIAR TAREFA: título="..."; agente="..."]`
- **Agentes executam e reportam** — quando uma tarefa é concluída, o CEO é notificado automaticamente
- **Escalona decisões importantes** ao humano via `[APROVAÇÃO NECESSÁRIA: ...]` — aparece na Caixa de Entrada
- Primeira execução ocorre **2 segundos após o onboarding** — agentes já começam a trabalhar enquanto você configura

**Contratar e gerenciar agentes:**
- Cada agente tem: nome, cargo, título, personalidade/alma, modelo de IA, skills e objetivos
- Seletor de provedor com validação de chave em tempo real (OpenRouter, OpenAI, Gemini, DeepSeek, Ollama)
- Agentes inativos ficam arquivados (histórico preservado), podem ser reativados
- Mudanças de modelo, personalidade e skills aplicadas **na hora**, sem reiniciar o sistema

---

### 📋 Tarefas e Caixa de Entrada

**Tarefas (Issues):**
- Status: Pendente → A fazer → Em progresso → Em revisão → Concluído
- Prioridade: Crítico, Alto, Médio, Baixo
- Atribuição a agentes específicos
- Criadas pelo CEO automaticamente ou pelo usuário no chat/painel
- Quando uma tarefa é concluída, o CEO recebe notificação e pode criar tarefas de acompanhamento

**Caixa de Entrada:**
- Centraliza todas as solicitações de aprovação dos agentes
- Badge de contagem no sidebar atualizado em tempo real
- Aprovar ou rejeitar com nota opcional
- Histórico de aprovações e rejeições

---

### 💬 Chat

- **Conversa direta** com qualquer agente
- **Multi-agente** — selecione múltiplos agentes para responderem em sequência
- **Histórico persistido** — cada conversa é salva por agente
- **Criar tarefa pelo chat** — botão "📋 Criar tarefa" atribui uma tarefa ao agente da conversa
- **Assistente Geral** — chat livre sem agente específico
- **Badges de modelo** — cada resposta exibe qual modelo de IA foi usado

---

### 📡 Atividade ao Vivo

Feed em tempo real de tudo que acontece na empresa:
- Atualização automática a cada 3 segundos
- Layout compacto de log: `HH:MM:SS | 👔 Agente | mensagem...`
- Filtro por agente específico
- Expandir mensagens longas com um clique
- Badge de novas mensagens quando não está no final

---

### 📈 Uso de Tokens e Controle de Gastos

- **Rastreamento em tempo real** de tokens consumidos por cada chamada de IA
- Valores em **USD e BRL** (câmbio configurável)
- Breakdown por agente — veja quem consome mais
- Histórico de chamadas com modelo, horário, tokens e custo
- **Limites de gasto configuráveis:**
  - Limite diário (bloqueia todos os agentes se ultrapassar)
  - Limite mensal (idem)
  - Barra de progresso no sidebar mostra uso do mês em tempo real
  - Agentes são **bloqueados automaticamente** quando o limite é atingido
- Tabela de referência de preços por modelo (GPT-4o, Claude, Gemini, DeepSeek, modelos gratuitos = $0)

---

### ⚙️ Configurações por Usuário

- **Chaves de API individuais** — cada conta usa suas próprias chaves
- **Validação em tempo real** — testa a chave no provedor e exibe ✅/❌ + créditos disponíveis
- **Lista de modelos dinâmica** — busca modelos diretamente do provedor com a sua chave
- **Perfil** — edite nome, email e senha a qualquer momento

---

### 🔁 Rotinas (Workflows Automáticos)

Enviam mensagens automaticamente para agentes em horários programados.

Exemplos:
- CEO envia relatório semanal toda segunda às 9h
- Agente de marketing gera sugestões de conteúdo todo dia às 8h
- Agente financeiro consolida custos na última sexta do mês

**Configurações:**
- Horário personalizado com seletor visual (sem escrever cron manualmente)
- Presets prontos: "Todo dia", "Toda segunda", "Dias úteis", etc.
- Horário de Brasília (BRT) — conversão para UTC automática
- Ativar/pausar/editar rotinas individualmente

---

### 🎯 Habilidades (Skills)

Skills são instruções especializadas atribuíveis a qualquer agente:

```bash
bash scripts/skills.sh list   # listar
bash scripts/skills.sh add    # criar
```

---

### 📊 Painel (Dashboard)

- Agentes ativos, tarefas em andamento e atividade recente
- Auto-refresh a cada 15 segundos

---

## 📡 API REST

Todas as operações disponíveis pelo app também estão acessíveis via API REST. Útil para integrações com outros sistemas.

**Autenticação:** Todas as rotas protegidas exigem header `Authorization: Bearer <token>` com o JWT retornado pelo login.

### Autenticação

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/auth/register` | Criar nova conta de usuário |
| `POST` | `/api/auth/login` | Login — retorna JWT + dados do usuário |
| `PUT` | `/api/auth/profile` | Editar nome, email ou senha |

### Chaves de API

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/user/keys` | Listar chaves configuradas (retorna quais provedores têm chave) |
| `PUT` | `/api/user/keys` | Salvar ou atualizar chaves de API |
| `GET` | `/api/models/validate?provider=X` | Testar se a chave do provider X é válida |
| `GET` | `/api/models/list?provider=X` | Listar modelos disponíveis no provider X |

### Empresa e Agentes

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/enterprise/company` | Dados da empresa do usuário logado |
| `POST` | `/api/enterprise/company` | Criar ou atualizar empresa |
| `GET` | `/api/enterprise/agents` | Listar todos os agentes (ativos e inativos) |
| `GET` | `/api/enterprise/agents/:id` | Dados de um agente específico |
| `POST` | `/api/enterprise/agents/hire` | Contratar novo agente |
| `DELETE` | `/api/enterprise/agents/:id` | Demitir agente |

### Chat

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/chat/:agentId` | Enviar mensagem para um agente específico |
| `GET` | `/api/chat/:agentId` | Buscar histórico de conversa com o agente |
| `DELETE` | `/api/chat/:agentId` | Apagar histórico de conversa |
| `POST` | `/api/chat/single` | Chat livre sem agente (Assistente Geral) |

### Outros

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET/POST` | `/api/skills` | Listar ou criar skills |
| `GET/PUT/DELETE` | `/api/skills/:id` | Gerenciar skill específica |
| `GET/POST` | `/api/workflows` | Listar ou criar workflows agendados |
| `PUT/DELETE` | `/api/workflows/:id` | Editar ou remover workflow |
| `GET/POST` | `/api/memories` | Listar ou salvar memórias do agente |
| `GET` | `/api/health` | Status do servidor (versão, provider, modelo) |

---

## 📁 Estrutura do projeto

```
mwcode/
├── server/                  # API REST (Express + TypeScript)
│   └── src/
│       ├── routes/          # Endpoints: auth, chat, enterprise, skills, workflows, models, ...
│       ├── middleware/       # Autenticação JWT, escopo de empresa
│       └── lib/             # data-dir (armazenamento), adapters
├── ui/                      # Interface web (React + Vite)
│   └── src/
│       ├── pages/           # Login, Register, Onboarding, Dashboard, Chat, Agents, Workflows, Settings
│       ├── components/      # ModelPicker, MessageRenderer, e outros componentes
│       └── lib/             # Cliente HTTP (api.ts)
├── packages/
│   ├── adapters/            # Adaptadores dos provedores de IA
│   │   └── src/             # openrouter.ts, openai.ts, gemini.ts, deepseek.ts, ollama.ts
│   ├── shared/              # Tipos TypeScript e constantes compartilhadas entre server e ui
│   └── db/                  # Schemas Drizzle ORM (para futura integração com PostgreSQL)
├── scripts/
│   └── skills.sh            # CLI para gerenciar skills pelo terminal
├── cli/                     # Modo chat interativo no terminal
├── bin/                     # Binário CLI global
├── docker/                  # Dockerfile + docker-compose
├── vscode-extension/        # Extensão para VS Code (em desenvolvimento)
├── doc/                     # Documentação detalhada
│   ├── INSTALL.md           # Guia de instalação completo
│   ├── VPS.md               # Deploy em produção
│   ├── DEVELOPING.md        # Guia para desenvolvedores
│   ├── DATABASE.md          # Armazenamento de dados
│   └── GOAL.md              # Objetivos do projeto
├── install-unico.sh         # Instalador automático Linux/VPS
├── install-unico.ps1        # Instalador automático Windows
├── setup-nginx.sh           # Configuração do nginx (reverse proxy)
├── setup-https.sh           # Certificado HTTPS com Let's Encrypt
└── update.sh                # Atualizar para a versão mais recente
```

### Onde ficam os dados (em runtime)

Os dados dos usuários ficam **separados do código** em `~/.mwcode/data/`. Isso significa que atualizar ou reinstalar o MWCode **não apaga** os dados.

```
~/.mwcode/data/
├── users.json               # Contas de usuário (senha com hash bcrypt)
├── keys/
│   └── {userId}.json        # Chaves de API de cada usuário (isoladas por conta)
├── agents/
│   └── {userId}/
│       └── {agentId}.json   # Agentes contratados (personalidade, modelo, skills)
├── chats/
│   └── {userId}/
│       └── {agentId}.json   # Histórico de conversas por agente
├── memories/
│   └── {userId}.json        # Memórias persistidas dos agentes
├── skills/
│   └── {userId}.json        # Skills criadas pelo usuário
└── workflows/
    └── {userId}.json        # Workflows agendados
```

**Backup simples:**

```bash
tar -czf backup-mwcode-$(date +%F).tgz ~/.mwcode/data/
```

---

## 🔧 Desenvolvimento local

Para contribuir ou testar mudanças no código:

```bash
# Clonar
git clone https://github.com/mweslley/mwcode.git
cd mwcode

# Instalar dependências (requer pnpm)
npm install -g pnpm
pnpm install

# Copiar e editar configurações (opcional)
cp .env.example .env

# Rodar em modo dev com hot reload
pnpm dev
```

Para rodar partes separadas:

```bash
pnpm dev:server   # Só a API (porta 3100)
pnpm dev:ui       # Só a interface (porta 5173)
```

Veja o guia completo de desenvolvimento em <a href="doc/DEVELOPING.md">doc/DEVELOPING.md</a>.

---

## 🌍 Deploy em produção (domínio + HTTPS)

Após instalar com o script automático:

```bash
# Configurar nginx como reverse proxy
bash /opt/mwcode/setup-nginx.sh

# Ativar HTTPS com Let's Encrypt (substitua pelo seu domínio)
bash /opt/mwcode/setup-https.sh seudominio.com

# Configurar PM2 para iniciar automaticamente após reboot
pm2 startup
pm2 save
```

Guia completo em <a href="doc/VPS.md">doc/VPS.md</a>.

---

## 🔄 Atualizar

```bash
bash /opt/mwcode/update.sh
```

O script faz `git pull` + reinstala dependências + recompila a UI + reinicia o servidor automaticamente.

---

## 🔒 Segurança

- Autenticação **JWT** em todas as rotas protegidas (login obrigatório)
- Chaves de API armazenadas **isoladas por usuário** em `~/.mwcode/data/keys/`
- Senhas com **hash bcrypt** — nunca armazenadas em texto puro
- Arquivo `.env` nunca commitado (consta no `.gitignore`)
- Em produção: HTTPS obrigatório, firewall UFW, PM2

Guia de boas práticas em <a href="SECURITY.md">SECURITY.md</a>.  
Para reportar vulnerabilidades: **suporte@lojamwo.com.br** (não abra issue pública).

---

## 🤝 Como contribuir

1. Faça um fork do repositório
2. Crie uma branch: `git checkout -b feat/minha-feature`
3. Commit com mensagem descritiva: `git commit -m "feat: descrição da mudança"`
4. Abra um Pull Request

Veja o guia completo em <a href="CONTRIBUTING.md">CONTRIBUTING.md</a>.

**Ideias bem-vindas:**
- Novos provedores de IA (Anthropic Claude direto, Mistral, Groq, Cohere)
- Integração com ferramentas externas (Notion, Slack, GitHub Actions)
- Testes automatizados
- Melhorias na UI e acessibilidade

---

## 🤝 Comunidade e Suporte

<a href="https://github.com/mweslley/mwcode/issues" target="_blank" rel="noopener noreferrer">📌 GitHub Issues</a> — Bugs, sugestões e discussões  
<a href="https://lojamwo.com.br" target="_blank" rel="noopener noreferrer">🌐 lojamwo.com.br</a> — Site da empresa  
✉️ **suporte@lojamwo.com.br** — Contato direto

---

## 📄 Licença

Distribuído sob a licença <a href="LICENSE">MIT</a> — use, modifique e distribua livremente, inclusive em projetos comerciais.
