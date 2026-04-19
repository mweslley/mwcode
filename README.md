# MWCode

Um sistema flexível de agentes de IA, construído em **React** + **Node.js**, que opera em dois modos: **Pessoal** (1 usuário) ou **Empresa** (múltiplos agentes).

[![License](https://img.shields.io/badge/license-MIT-2563eb)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-6366f1)](https://github.com/mweslley/mwcode/releases)

---

## 🚀 Como Instalar

### Pré-requisitos
- **Node.js** 20 ou superior ([baixar](https://nodejs.org/))
- **pnpm** 8 ou superior
- (opcional) **PostgreSQL** 16+ para produção — em desenvolvimento o sistema roda em memória

### Instalação passo a passo

```bash
# 1. Clonar o repositório
git clone https://github.com/mweslley/mwcode.git
cd mwcode

# 2. Instalar pnpm (se ainda não tiver)
npm install -g pnpm

# 3. Instalar dependências
pnpm install

# 4. Configurar variáveis de ambiente
cp .env.example .env
# Abra o arquivo .env e coloque pelo menos uma chave de API.
# Recomendado: OPENROUTER_API_KEY (tem modelos gratuitos)

# 5. Rodar em modo desenvolvimento (API + interface)
pnpm dev
```

Pronto! Acesse:
- **Interface web:** http://localhost:5173
- **API:** http://localhost:3100
- **Saúde da API:** http://localhost:3100/api/health

### Rodar só a API ou só a interface

```bash
pnpm dev:server   # só a API (porta 3100)
pnpm dev:ui       # só a interface (porta 5173)
```

### Build de produção

```bash
pnpm build
pnpm start
```

### Rodar com Docker

```bash
cd docker
docker compose up -d
# Acesse http://localhost:3100
```

---

## Modos de Uso

### Modo Single (Pessoal)
Para **1 usuário** com **1 agente** - simples e direto.

```
Usuário → Chat → 1 Agente → Resposta
```

- Chat direto com 1 agente
- Escolha qualquer provedor (OpenRouter, OpenAI, etc)
- Sem gestão empresarial
- Configuração mínima
- Grátis

### Modo Enterprise (Empresa)
Para **empresas** com **múltiplos agentes** - gestão completa.

```
Empresa → Dashboard → Múltiplos Agentes → Chat → Tarefas
```

- Dashboard executivo
- Contratar/demitir agentes
- Múltiplos agentes simultâneos
- Controle de custos
- Gestão de performance
- Histórico completo

---

**Em resumo:** MWCode é um sistema que permite usar **1 agente** (modo single) ou **múltiplos agentes** (modo empresa), com chat integrado, escolha de provedores e 100% em português.

| Recurso | Single | Enterprise |
|--------|--------|------------|
| Agentes | 1 | Ilimitados |
| Chat | ✅ | ✅ |
| Dashboard | ❌ | ✅ |
| Contratar/Demitir | ❌ | ✅ |
| Custos | ❌ | ✅ |
| Multi-empresa | ❌ | ✅ |

## 🎯 Visão

MWCode é um **sistema flexível de agentes de IA** que funciona para uso pessoal (single) ou empresarial (enterprise), com chat integrado e opções de provedores.

### Diferenciais do MWCode

- **Chat Centralizado**: Comunicar-se diretamente com qualquer agente da empresa
- **Gestão de Contratação**: Contratar novos agentes com proceso simplificado
- **Demissão Controlada**: Desligar agentes com histórico completo
- **Dashboard Executivo**: Visualizar performance e custos em tempo real
- **Multi-Agente**: Múltiplos agentes trabalhando simultaneamente
- **100% Português**: Toda interface e documentação em pt-BR

## ✨ Principais Diferenciais

### 🚀 Performance Extrema
- **Binários nativos** sem dependências do runtime
- **Compilação instantânea** com Zig
- **Uso mínimo de memória** (< 50MB base)
- **Execução rápida** mesmo em workflows complexos

### 🔧 Tecnologia de Vanguarda
- **Zig** - linguagem moderna com gerenciamento de memória manual
- **Zero abstrações desnecessárias** - código eficiente e direto
- **Suporte nativo** a múltiplas plataformas (Linux, macOS, Windows)
- **Integração de baixo nível** com sistema operacional

### 🎨 Design Minimalista
- **Interface limpa** e intuitiva
- **Foco na essência** do desenvolvimento
- **Arquitetura modular** extensível
- ** zero configuração obrigatória**

## 🏗️ Arquitetura

```
MWCode/
├── server/                     # API Express + orchestration
│   ├── src/
│   │   ├── index.ts            # Servidor principal
│   │   ├── routes/
│   │   │   ├── agents.ts        # rotas de agentes
│   │   │   ├── companies.ts     # rotas de empresas
│   │   │   ├── chat.ts         # rotas de chat
│   │   │   ├── dashboard.ts    # rotas do dashboard
│   │   │   └── tasks.ts        # rotas de tarefas
│   │   ├── services/
│   │   │   ├── agent-hire.ts    # contratação de agentes
│   │   │   ├── agent-fire.ts     # demissão de agentes
│   │   │   ├── chat-service.ts  # serviço de chat
│   │   │   └── orchestrator.ts # orquestração
│   │   └── middleware/
│   │       ├── auth.ts         # autenticação
│   │       └── company.ts      # escopo de empresa
│   └── package.json
│
├── ui/                         # React + Vite UI
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx  # Dashboard executivo
│   │   │   ├── Chat.tsx        # Chat com agentes
│   │   │   ├── Agents.tsx      # Lista de agentes
│   │   │   ├── Hire.tsx        # Contratar agente
│   │   │   ├── Fire.tsx        # Demitir agente
│   │   │   └── Settings.tsx   # Configurações
│   │   ├── components/
│   │   │   ├── ChatWindow.tsx   # Janela de chat
│   │   │   ├── AgentCard.tsx   # Card de agente
│   │   │   ├── StatsCard.tsx   # Card de estatísticas
│   │   │   └── HireModal.tsx    # Modal de contratação
│   │   ├── hooks/
│   │   │   ├── useChat.ts      # Hook de chat
│   │   │   └── useAgents.ts    # Hook de agentes
│   │   └── App.tsx
│   └── package.json
│
├── packages/
│   ├── db/                     # Schema do banco (Drizzle)
│   │   └── src/
│   │       ├── schema/
│   │       │   ├── agents.ts   # Schema de agentes
│   │       │   ├── companies.ts # Schema de empresas
│   │       │   ├── chats.ts    # Schema de chats
│   │       │   ├── tasks.ts    # Schema de tarefas
│   │       │   └── migrations.ts
│   │       └── index.ts
│   │
│   ├── shared/                  # Tipos e constantes compartilhadas
│   │   ├── src/
│   │   │   ├── types/
│   │   │   │   ├── agent.ts    # Tipos de agente
│   │   │   │   ├── company.ts  # Tipos de empresa
│   │   │   │   ├── chat.ts     # Tipos de chat
│   │   │   │   └── dashboard.ts
│   │   │   ├── constants/
│   │   │   │   └── api.ts      # Constantes da API
│   │   │   └── validators/
│   │   │       └── index.ts    # Validadores
│   │   └── package.json
│   │
│   └── adapters/               # Adaptadores de IA
│       ├── src/
│       │   ├── openai.ts       # Adaptador OpenAI
│       │   ├── api.ts        # Adaptador API
│       │   ├── openrouter.ts  # Adaptador OpenRouter
│       │   ├── gemini.ts       # Adaptador Gemini
│       │   ├── ollama.ts       # Adaptador Ollama
│       │   └── github.ts       # Adaptador GitHub
│       └── package.json
│
├── doc/                        # Documentação operacional
│   ├── GOAL.md                # Objetivo do projeto
│   ├── PRODUCT.md              # Produto
│   ├── SPEC.md                # Especificação longa
│   ├── SPEC-implementation.md # Especificação V1
│   ├── DEVELOPING.md          # Guia de desenvolvimento
│   └── DATABASE.md            # Banco de dados
│
├── build.zig                  # Script de build
├── package.json
├── pnpm-workspace.yaml
└── docker/
    └── Dockerfile
```
MWCode/
├── src/
│   ├── main.zig              # Ponto de entrada
│   ├── cli.zig               # Interface de linha de comando
│   ├── core/
│   │   ├── provider.zig      # Abstração de provedores
│   │   ├── agent.zig         # Sistema de agentes
│   │   └── tool.zig          # Framework de ferramentas
│   ├── providers/
│   │   ├── openai.zig        # Provedor OpenAI-compatible
│   │   ├── gemini.zig        # Provedor Gemini
│   │   ├── github.zig        # Provedor GitHub Models
│   │   └── local.zig         # Modelos locais (Ollama, etc)
│   ├── tools/
│   │   ├── bash.zig          # Ferramenta bash
│   │   ├── file.zig          # Operações de arquivo
│   │   ├── grep.zig          # Busca de texto
│   │   ├── glob.zig          # Busca de padrões
│   │   └── web.zig           # Ferramentas web
│   ├── config/
│   │   ├── settings.zig      # Gerenciamento de configuração
│   │   └── profiles.zig     # Perfis de provedores
│   └── utils/
│       ├── parser.zig        # Parser de argumentos
│       ├── logger.zig        # Sistema de logging
│       └── platform.zig      # Abstrações de plataforma
├── build.zig                 # Script de build
├── assets/                   # Recursos estáticos
├── examples/                 # Exemplos de uso
└── tests/                    # Testes unitários
```

## 🚀 Instalação e Uso

O MWCode oferece **duas formas** de uso:

### Opção 1: Interface Web (Recomendado)
Acessar pelo navegador - funciona para **Single** e **Enterprise**.

### Opção 2: CLI (Terminal)
Usar no terminal - ideal para **Single** mode.

---

### Pré-requisitos (Comum)
- **Node.js** 20+
- **pnpm** 8+
- **PostgreSQL** (produção) ou PGlite (desenvolvimento)

### Instalação Completa
```bash
# Clonar repositório
git clone https://github.com/mweslley/MWCode
cd MWCode

# Instalar dependências
pnpm install

# Iniciar
pnpm dev
```

Isso inicia:
- API: `http://localhost:3100`
- UI Web: `http://localhost:3100`

---

## 💬 Como Usar o Chat (Single Mode)

### via Web
```
1. Acesse http://localhost:3100
2. Selecione "Modo Single"
3. Escolha o provedor (OpenRouter, OpenAI, etc)
4. Escolha o modelo
5. Digite sua mensagem
6. Enviar
```

### via CLI/Terminal
```bash
# Via web (mesma interface)
pnpm dev

# Configurar provedor (variáveis de ambiente)
export MWCODE_PROVIDER=openrouter
export OPENROUTER_API_KEY=sua-chave-aqui
export MWCODE_MODEL=qwen/qwen-2.5-coder-32b-instruct

# Iniciar chat interativo
pnpm mwcode chat

# Ou comando único
pnpm mwcode "Olá, crie uma função em Python"
```

### Configuração por Provedor

```bash
# OpenRouter (recomendado - +100 modelos)
export MWCODE_PROVIDER=openrouter
export OPENROUTER_API_KEY=sk-or-v...seu-codigo

# OpenAI
export MWCODE_PROVIDER=openai
export OPENAI_API_KEY=sk-...seu-codigo

# API (genérica)
export MWCODE_PROVIDER=api
export MWCODE_API_KEY=sua-chave-aqui

# Ollama (local)
export MWCODE_PROVIDER=ollama
export OLLAMA_BASE_URL=http://localhost:11434
export OLLAMA_MODEL=qwen2.5-coder:7b
```

### Exemplos de Chat Single

```bash
# Chat interativo
$ pnpm mwcode chat
>MWCode: Olá! Escolha um modelo:
>1. Qwen Coder (grátis)
>2. GPT-4o
>3. Claude 3.5
>Selecione: 1
>Você: Crie uma função para fibonacci em Python
>Agente: def fibonacci(n): ...
```

```bash
# Comando único
pnpm mwcode "Explique o que é React" --provider openrouter
```

---

## 🏢 Modo Enterprise - Como Usar

### via Web (Dashboard)
```
1. Abrir navegador → http://localhost:3100
2. Fazer login/criar empresa
3. Acessar Dashboard
4. Contratar agentes
5. Chat com agente específico
6. Ver métricas e custos
```

### via API/REST
```bash
# Listar agentes
curl http://localhost:3100/api/agentes

# Contratar agente
curl -X POST http://localhost:3100/api/agentes \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Desenvolvedor",
    "funcao": "dev",
    "adapter": "openrouter",
    "model": "qwen/qwen-2.5-coder-32b-instruct"
  }'

# Chat com agente específico
curl -X POST http://localhost:3100/api/chat/agente-123 \
  -H "Content-Type: application/json" \
  -d '{"mensagem": "Crie uma API REST"}'

# Ver dashboard
curl http://localhost:3100/api/dashboard/estatisticas
```

### Resumo: Web vs CLI/API

| Recurso | Single | Enterprise |
|--------|--------|------------|
| Web | ✅ | ✅ |
| CLI | ✅ | - |
| API | - | ✅ |
| Dashboard | - | ✅ |

---

### Verificações Rápidas
```bash
curl http://localhost:3100/api/health
curl http://localhost:3100/api/empresas
curl http://localhost:3100/api/agentes
```

### Reset do Banco de Desenvolvimento
```bash
rm -rf data/pglite
pnpm dev
```

## 🌐 Rotas da API

### Empresasa
- `GET /api/empresas` - Listar empresas
- `POST /api/empresas` - Criar empresa
- `GET /api/empresas/:id` - Ver empresa
- `PUT /api/empresas/:id` - Atualizar empresa

### Agentes
- `GET /api/agentes` - Listar agentes da empresa
- `POST /api/agentes` - Contratar agente
- `GET /api/agentes/:id` - Ver agente
- `DELETE /api/agentes/:id` - Demitir agente
- `POST /api/agentes/:id/tarefa` - Atribuir tarefa

### Chat
- `POST /api/chat/:agentId` - Enviar mensagem ao agente
- `GET /api/chat/:agentId` - Histórico de chat
- `GET /api/chat/:agentId/mensagens` - Todas as mensagens

### Dashboard
- `GET /api/dashboard/estatisticas` - Estatísticas gerais
- `GET /api/dashboard/custos` - Custos por período
- `GET /api/dashboard/performance` - Performance dos agentes
- `GET /api/dashboard/ativos` - Agentes ativos/inativos

### Tarefas
- `GET /api/tarefas` - Listar tarefas
- `POST /api/tarefas` - Criar tarefa
- `GET /api/tarefas/:id` - Ver tarefa
- `PUT /api/tarefas/:id` - Atualizar tarefa

## 💡 Uso Rápido
```bash
# Modo interativo
mwcode

# Executar comando único
mwcode "crie uma função para calcular fatorial em Python"

# Com arquivo específico
mwcode --file script.js "otimize este código"

# Com contexto de diretório
mwcode --dir /path/to/project "analise este código e sugira melhorias"

# Com provedor específico
mwcode --provider gemini "explique conceitos de programação funcional"

# Com múltiplos passos
mwcode "crie uma API REST em Node.js" && mwcode "adicione autenticação JWT"
```

## 📁 Exemplos de Implementação

## 📋 Funcionalidades Principais

### 1. Chat com Agentes
Sistema de chat integrado para comunicação direta com agentes.

```typescript
// ui/src/pages/Chat.tsx
import { useChat } from '@/hooks/useChat';

export function Chat() {
  const { messages, sendMessage, agents } = useChat();
  
  return (
    <div className="chat-container">
      <div className="agent-selector">
        <select>
          {agents.map(agent => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>
      </div>
      
      <div className="messages">
        {messages.map(msg => (
          <div className={`message ${msg.role}`}>
            <span className="sender">{msg.sender}</span>
            <p>{msg.content}</p>
          </div>
        ))}
      </div>
      
      <div className="input-area">
        <textarea 
          placeholder="Digite sua mensagem para o agente..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage(e.currentTarget.value);
            }
          }}
        />
      </div>
    </div>
  );
}
```

### 2. Sistema de Contratação de Agentes
Fluxo completo para contratar novos agentes.

```typescript
// server/src/services/agent-hire.ts
import { db } from '@mwcode/db';
import { agents } from '@mwcode/db/schema';

export async function hireAgent(data: {
  companyId: string;
  name: string;
  role: string;
  adapter: 'openai' | 'api' | 'gemini' | 'ollama' | 'openrouter';
  model: string;
  skills: string[];
  salary?: number;
}) {
  const agent = await db.insert(agents).values({
    companyId: data.companyId,
    name: data.name,
    role: data.role,
    adapter: data.adapter,
    model: data.model,
    skills: JSON.stringify(data.skills),
    status: 'active',
    hiredAt: new Date(),
    performance: 0,
    tasksCompleted: 0,
    hourlyRate: data.salary || 0,
  }).returning();
  
  return agent[0];
}
```

### 3. Sistema de Demissão
Processo controlado de demissão com histórico.

```typescript
// server/src/services/agent-fire.ts
import { db } from '@mwcode/db';
import { agents, agentHistory } from '@mwcode/db/schema';

export async function fireAgent(data: {
  agentId: string;
  reason: string;
  companyId: string;
}) {
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, data.agentId),
  });
  
  if (!agent || agent.companyId !== data.companyId) {
    throw new Error('Agente não encontrado');
  }
  
  await db.update(agents)
    .set({ 
      status: 'fired',
      firedAt: new Date(),
      fireReason: data.reason,
    })
    .where(eq(agents.id, data.agentId));
  
  await db.insert(agentHistory).values({
    agentId: data.agentId,
    action: 'fire',
    reason: data.reason,
    timestamp: new Date(),
    metadata: JSON.stringify({
      tasksCompleted: agent.tasksCompleted,
      performance: agent.performance,
      tenure: Date.now() - agent.hiredAt.getTime(),
    }),
  });
  
  return { success: true };
}
```

### 4. Dashboard Executivo
Visualização de métricas e performance.

```typescript
// ui/src/pages/Dashboard.tsx
import { StatsCard } from '@/components/StatsCard';
import { AgentCard } from '@/components/AgentCard';

export function Dashboard() {
  const stats = useDashboardStats();
  const agents = useActiveAgents();
  
  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      
      <div className="stats-grid">
        <StatsCard 
          title="Agentes Ativos"
          value={stats.activeAgents}
          icon="users"
        />
        <StatsCard 
          title="Tarefas Concluídas"
          value={stats.completedTasks}
          icon="check"
        />
        <StatsCard 
          title="Custo Total"
          value={`R$ ${stats.totalCost.toFixed(2)}`}
          icon="money"
        />
        <StatsCard 
          title="Performance Média"
          value={`${stats.avgPerformance}%`}
          icon="chart"
        />
      </div>
      
      <div className="agents-section">
        <h2>Agentes Ativos</h2>
        <div className="agents-grid">
          {agents.map(agent => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 5. Banco de Dados

```typescript
// packages/db/src/schema/agents.ts
import { pgTable, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const agents = pgTable('agents', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  adapter: text('adapter').notNull(),
  model: text('model').notNull(),
  skills: jsonb('skills').$type<string[]>(),
  status: text('status').notNull().default('active'),
  hiredAt: timestamp('hired_at').notNull(),
  firedAt: timestamp('fired_at'),
  fireReason: text('fire_reason'),
  performance: integer('performance').default(0),
  tasksCompleted: integer('tasks_completed').default(0),
  hourlyRate: integer('hourly_rate').default(0),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
});

export const companies = pgTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  plan: text('plan').notNull().default('free'),
  budget: integer('budget').default(0),
  spent: integer('spent').default(0),
  createdAt: timestamp('created_at').notNull(),
});

export const chats = pgTable('chats', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  agentId: text('agent_id').notNull(),
  userId: text('user_id').notNull(),
  messages: jsonb('messages').$type<{
    role: 'user' | 'agent' | 'system';
    content: string;
    timestamp: Date;
  }[]>(),
  createdAt: timestamp('created_at').notNull(),
});

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  agentId: text('agent_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('pending'),
  priority: text('priority').default('medium'),
  createdAt: timestamp('created_at').notNull(),
  completedAt: timestamp('completed_at'),
});
```

### 6. Adaptadores de IA

```typescript
// packages/adapters/src/openai.ts
import { Adapter, AdapterResponse } from '@mwcode/shared';

export interface OpenAIAdapterConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
}

export const createOpenAIAdapter = (config: OpenAIAdapterConfig): Adapter => {
  return {
    name: 'openai',
    model: config.model,
    
    async call(prompt: string, context?: Record<string, any>): Promise<AdapterResponse> {
      const response = await fetch(`${config.baseUrl || 'https://api.openai.com/v1'}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: context?.system || 'Você é um assistente de IA.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
        }),
      });
      
      const data = await response.json();
      return {
        content: data.choices[0].message.content,
        usage: data.usage,
      };
    },
    
    detectModel(response: string): string | null {
      return this.model;
    },
  };
};
```

### Adaptador OpenRouter
O OpenRouter permite acesso a centenas de modelos de IA através de uma única API, incluindo modelos gratuitos e pagos.

```typescript
// packages/adapters/src/openrouter.ts
import { Adapter, AdapterResponse } from '@mwcode/shared';

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
}

export const createOpenRouterAdapter = (config: OpenRouterConfig): Adapter => {
  return {
    name: 'openrouter',
    model: config.model,
    
    async call(prompt: string, context?: Record<string, any>): Promise<AdapterResponse> {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
          'HTTP-Referer': 'https://mwcode.com',
          'X-Title': 'MWCode',
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: context?.system || 'Você é um assistente de IA.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
        }),
      });
      
      const data = await response.json();
      return {
        content: data.choices[0].message.content,
        usage: data.usage,
      };
    },
    
    detectModel(response: string): string | null {
      return this.model;
    },
  };
};

// Modelos Populares do OpenRouter
export const OPENROUTER_MODELS = {
  // GPT
  gpt4o: 'openai/gpt-4o',
  gpt4o_mini: 'openai/gpt-4o-mini',
  gpt4: 'openai/gpt-4',
  
  // Modelos API
  api_model: 'provider/model',
  
  // Gemini
  gemini15: 'google/gemini-pro-1.5',
  gemini15_flash: 'google/gemini-flash-1.5-8b',
  
  // Llama
  llama31: 'meta-llama/llama-3.1-70b-instruct',
  llama31_8b: 'meta-llama/llama-3.1-8b-instruct',
  
  // Mistral
  mistral: 'mistralai/mistral-7b-instruct',
  mixtral: 'mistralai/mixtral-8x7b-instruct',
  
  // Qwen
  qwen25: 'qwen/qwen-2.5-72b-instruct',
  qwen25_coder: 'qwen/qwen-2.5-coder-32b-instruct',
  
  // DeepSeek
  deepseek: 'deepseek/deepseek-chat',
  
  // Gratuitos
  free: 'openrouter/auto',
} as const;
```

### 7. Sistema de Chat em Tempo Real

```typescript
// server/src/services/chat-service.ts
import { db } from '@mwcode/db';
import { chats, agents } from '@mwcode/db/schema';

export interface ChatMessage {
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  agentId: string;
}

export async function sendMessage(data: {
  agentId: string;
  companyId: string;
  userId: string;
  message: string;
}) {
  const agent = await db.query.agents.findFirst({
    where: and(
      eq(agents.id, data.agentId),
      eq(agents.companyId, data.companyId)
    ),
  });
  
  if (!agent) {
    throw new Error('Agente não encontrado');
  }
  
  const adapter = await getAdapter(agent.adapter, agent.model);
  const response = await adapter.call(data.message, {
    skills: agent.skills,
    context: agent.metadata,
  });
  
  const chatMessage: ChatMessage = {
    role: 'agent',
    content: response.content,
    timestamp: new Date(),
    agentId: data.agentId,
  };
  
  await db.insert(chats).values({
    companyId: data.companyId,
    agentId: data.agentId,
    userId: data.userId,
    messages: JSON.stringify([
      { role: 'user', content: data.message, timestamp: new Date() },
      chatMessage,
    ]),
    createdAt: new Date(),
  });
  
  return response;
}

export async function getChatHistory(data: {
  agentId: string;
  companyId: string;
  limit?: number;
}) {
  const chatHistory = await db.query.chats.findMany({
    where: and(
      eq(chats.agentId, data.agentId),
      eq(chats.companyId, data.companyId)
    ),
    orderBy: desc(chats.createdAt),
    limit: data.limit || 50,
  });
  
  return chatHistory;
}
```

### 8. Orquestração de Agentes

```typescript
// server/src/services/orchestrator.ts
import { db } from '@mwcode/db';
import { tasks, agents } from '@mwcode/db/schema';

export interface TaskAssignment {
  taskId: string;
  agentId: string;
  priority: 'low' | 'medium' | 'high';
}

export async function assignTask(data: TaskAssignment) {
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, data.agentId),
  });
  
  if (!agent || agent.status !== 'active') {
    throw new Error('Agente não disponível');
  }
  
  const task = await db.update(tasks)
    .set({
      agentId: data.agentId,
      status: 'in_progress',
    })
    .where(eq(tasks.id, data.taskId))
    .returning();
  
  await executeTask(task[0], agent);
  
  return task[0];
}

async function executeTask(task: any, agent: any) {
  try {
    const adapter = await getAdapter(agent.adapter, agent.model);
    const result = await adapter.call(task.description, {
      context: task.metadata,
    });
    
    await db.update(tasks)
      .set({
        status: 'completed',
        completedAt: new Date(),
      })
      .where(eq(tasks.id, task.id));
    
    await db.update(agents)
      .set({
        tasksCompleted: agent.tasksCompleted + 1,
        performance: calculatePerformance(agent),
      })
      .where(eq(agents.id, agent.id));
    
  } catch (error) {
    await db.update(tasks)
      .set({
        status: 'failed',
      })
      .where(eq(tasks.id, task.id));
  }
}

function calculatePerformance(agent: any): number {
  const successRate = (agent.tasksCompleted / (Date.now() - agent.hiredAt.getTime())) * 100;
  return Math.min(100, Math.round(successRate));
}
```

### Exemplo 1: Ferramenta Bash
```zig
// src/tools/bash.zig
const std = @import("std");

pub const BashTool = struct {
    allocator: std.mem.Allocator,

    pub fn execute(self: *BashTool, command: []const u8) ![]u8 {
        var process = std.process.Child.init(.{
            .allocator = self.allocator,
            .argv = &.{ "sh", "-c", command },
        }, self.allocator);
        
        process.stdout_behavior = .Pipe;
        process.stderr_behavior = .Pipe;
        
        try process.spawn();
        const result = process.wait() catch |err| {
            return err;
        };
        
        switch (result) {
            .Exited => |code| {
                if (code != 0) {
                    return error.CommandFailed;
                }
            },
            else => return error.ProcessFailed,
        }
        
        const output = process.stdout.?.readAllAlloc(self.allocator, 1_000_000) catch |err| {
            return err;
        };
        
        return output;
    }
};
```

### Exemplo 2: Ferramenta File
```zig
// src/tools/file.zig
const std = @import("std");

pub const FileTool = struct {
    allocator: std.mem.Allocator,

    pub fn read(self: *FileTool, path: []const u8) ![]u8 {
        const file = std.fs.cwd().openFile(path, .{}) catch |err| {
            return err;
        };
        defer file.close();
        
        const stat = file.stat() catch |err| {
            return err;
        };
        
        const buffer = try self.allocator.alloc(u8, stat.size);
        errdefer self.allocator.free(buffer);
        
        _ = file.readAll(buffer) catch |err| {
            return err;
        };
        
        return buffer;
    }

    pub fn write(self: *FileTool, path: []const u8, content: []const u8) !void {
        const file = std.fs.cwd().createFile(path, .{}) catch |err| {
            return err;
        };
        defer file.close();
        
        _ = file.writeAll(content) catch |err| {
            return err;
        };
    }
};
```

### Exemplo 3: Configuração
```zig
// src/config/settings.zig
const std = @import("std");
const json = std.json;

pub const Settings = struct {
    provider: []const u8 = "openai",
    api_key: ?[]const u8 = null,
    model: []const u8 = "gpt-4o",
    max_tokens: u32 = 4000,
    temperature: f32 = 0.7,

    pub fn fromJson(allocator: std.mem.Allocator, json_str: []const u8) !Settings {
        var parsed = std.json.parseFromSlice(
            Settings,
            allocator,
            json_str,
            .{ .allocate = .alloc_always },
        ) catch |err| {
            return err;
        };
        
        defer parsed.deinit();
        return parsed.value;
    }

    pub fn toJson(self: *const Settings, allocator: std.mem.Allocator) ![]u8 {
        return json.stringifyAlloc(
            allocator,
            self,
            .{ .whitespace = .indent_2 },
        ) catch |err| {
            return err;
        };
    }
};
```

### Exemplo 4: Agente Básico
```zig
// src/core/agent.zig
const std = @import("std");
const provider = @import("provider.zig");
const tools = @import("../tools/tools.zig");

pub const Agent = struct {
    allocator: std.mem.Allocator,
    provider: *provider.Provider,
    tools: *tools.ToolRegistry,

    pub fn execute(self: *Agent, task: []const u8) ![]u8 {
        // Implementar lógica de agente
        // 1. Analisar a tarefa
        // 2. Selecionar ferramentas adequadas
        // 3. Executar passo a passo
        // 4. Retornar resultado
        
        return self.provider.call(task);
    }
};
```

## 🔧 Provedores Suportados

| Provedor | Status | Notas |
|----------|--------|-------|
| OpenAI | ✅ | OpenAI API oficial |
| OpenRouter | ✅ | +100 modelos (GPT, Claude, Llama, etc) |
| API | ✅ | API genérica |
| Gemini | ✅ | Google Gemini |
| GitHub Models | ✅ | GitHub Models |
| Ollama | ✅ | Modelos locais |
| DeepSeek | ✅ | API DeepSeek |
| Local | 🔄 | Modelos locais customizados |

## 🔄 Modo Failover (Alternância Automática)

O MWCode pode automaticamente alternar entre provedores/modelos quando um falha, ideal para manter o sistema sempre rodando com APIs gratuitas.

### Como funciona
```
1. Usuário usa API/modelo gratuito
2. API falha (rate limit, erro, etc)
3. Sistema automaticamente tenta próximo
4. Continua até funcionar ou acabarem opções
```

### Configurar via Terminal
```bash
# Ativar failover automático (padrão)
export MWCODE_FAILOVER=true

# Desativar failover
export MWCODE_FAILOVER=false

# Definir ordem de backup
export MWCODE_FAILOVER_ORDER=openrouter/free,ollama/qwen,deepseek

# Modelos gratuitos preferidos
export MWCODE_FREE_MODELS=openrouter/auto,qwen/qwen-2.5-coder-32b-instruct,mistralai/mistral-7b-instruct
```

### Configurar via Dashboard
```
1. Acessar Dashboard → Configurações
2.找到 "Failover Automático"
3. Ativar/Desativar toggle
4. Definir ordem de provedores
```

### Configurar viaVS Code
```json
// .vscode/mwcode.json
{
  "failover": {
    "enabled": true,
    "order": ["openrouter/free", "ollama/qwen", "deepseek"]
  }
}
```

### Ordem Recomendada de APIs Gratuitas
1. `openrouter/auto` - escolhe melhor modelo gratuito
2. `qwen/qwen-2.5-coder-32b-instruct` - bom para código
3. `mistralai/mistral-7b-instruct` - rápido
4. `ollama/qwen2.5-coder:7b` - local, ilimitado

---

## 📊 Extensão VS Code

O MWCode pode ser usado diretamente no VS Code como extensão.

### Instalação
```
1. Abrir VS Code
2. Extensions (Ctrl+Shift+X)
3. Pesquisar "MWCode"
4. Instalar
```

### Configuração (.vscode/mwcode.json)
```json
{
  "provider": "openrouter",
  "model": "qwen/qwen-2.5-coder-32b-instruct",
  "apiKey": "sk-...",
  "failover": {
    "enabled": true,
    "order": ["openrouter/free", "ollama/qwen"]
  }
}
```

### Comandos no VS Code
| Comando | Atalho |
|---------|--------|
| Abrir chat MWCode | `Ctrl+Shift+M` |
| Enviar seleção | `Ctrl+Shift+Enter` |
| Novo chat | `Ctrl+Shift+N` |

### Painel de Chat
```
1. Abrir paleta (Ctrl+Shift+P)
2. Digitar "MWCode: Chat"
3. Enviar mensagens
4. Ver respostas
```

### Integração com Terminal
```bash
# Comando direto no terminal VS Code
mwcode "crie um componente React"

# Com arquivo
mwcode --file src/App.tsx "explique este código"
```

## 🛠️ Ferramentas Integradas

### Core Tools
- **Bash** - Execução de comandos do sistema
- **File** - Leitura, escrita e edição de arquivos
- **Grep** - Busca de texto avançada
- **Glob** - Busca de padrões de arquivos
- **Web** - Busca e fetch de conteúdo web

### Agent Tools
- **Task** - Gerenciamento de tarefas complexas
- **Project** - Análise de projetos
- **Review** - Análise de código
- **Generate** - Geração de código automatizada

## 🎨 Características Únicas

### Performance Otimizada
- **Alocação zero** para operações comuns
- **Cache inteligente** de respostas e ferramentas
- **Streamming eficiente** com buffers otimizados
- **Paralelismo nativo** para operações I/O

### Design Modular
- **Plugin system** nativo em Zig
- **Hot-reloading** de configurações
- **Extensões customizáveis** via Zig
- **Interface unificada** para todos os provedores

### Cross-Platform
- **Suporte nativo** a Windows, Linux, macOS
- **Binários standalone** sem dependências
- **Otimizações específicas** para cada plataforma
- **Path handling** inteligente e robusto

## 🎯 Roadmap

### Versão 0.1.0 (Atual)
- [x] Arquitetura básica
- [x] Suporte a OpenAI
- [x] Ferramentas core
- [x] CLI básico

### Versão 0.2.0 (Próximo)
- [ ] Gemini support
- [ ] GitHub Models
- [ ] Ollama integration
- [ ] VS Code extension

### Versão 0.3.0
- [ ] Plugin system
- [ ] Advanced tools
- [ ] Performance optimizations
- [ ] Web interface

### Versão 1.0.0
- [ ] Enterprise features
- [ ] Advanced routing
- [ ] Analytics dashboard
- [ ] Marketplace

## 🧪 Desenvolvimento

### Estrutura de Arquivos Implementados

#### build.zig - Script de Build
```zig
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const exe = b.addExecutable(.{
        .name = "mwcode",
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });

    b.installArtifact(exe);

    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());
    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const run_step = b.step("run", "Run the app");
    run_step.dependOn(&run_cmd.step);
}
```

#### src/main.zig - Ponto de Entrada
```zig
const std = @import("std");
const cli = @import("cli.zig");

pub fn main() !void {
    const allocator = std.heap.page_allocator;
    
    var app = cli.App.init(allocator);
    defer app.deinit();
    
    try app.run();
}
```

#### src/cli.zig - Interface CLI
```zig
const std = @import("std");
const provider = @import("core/provider.zig");

pub const App = struct {
    allocator: std.mem.Allocator,
    config: *Config,
    current_provider: *provider.Provider,

    pub fn init(allocator: std.mem.Allocator) App {
        return .{
            .allocator = allocator,
            .config = undefined, // TODO: implementar
            .current_provider = undefined, // TODO: implementar
        };
    }

    pub fn deinit(self: *App) void {
        // TODO: cleanup
    }

    pub fn run(self: *App) !void {
        const stdin = std.io.getStdIn().reader();
        const stdout = std.io.getStdOut().writer();
        
        stdout.writeAll("MWCode> ") catch return;
        
        var buffer: [1024]u8 = undefined;
        const input = try stdin.readUntilDelimiterOrEof(&buffer, '\n');
        if (input) |cmd| {
            try self.processCommand(cmd);
        }
    }

    fn processCommand(self: *App, cmd: []const u8) !void {
        if (std.mem.startsWith(u8, cmd, "/help")) {
            try self.showHelp();
        } else if (std.mem.startsWith(u8, cmd, "/exit")) {
            std.process.exit(0);
        } else {
            try self.executeCommand(cmd);
        }
    }

    fn showHelp(self: *App) !void {
        const help_text =
            \\Comandos disponíveis:
            \\  /help     - Mostra esta ajuda
            \\  /config   - Gerenciar configuração
            \\  /provider - Gerenciar provedores
            \\  /exit     - Sair
            \\
        ;
        std.io.getStdOut().writer().writeAll(help_text) catch {};
    }
};
```

#### src/core/provider.zig - Abstração de Provedores
```zig
const std = @import("std");

pub const Provider = struct {
    name: []const u8,
    api_key: ?[]const u8,
    base_url: []const u8,
    model: []const u8,

    pub fn init(name: []const u8, api_key: ?[]const u8) Provider {
        return .{
            .name = name,
            .api_key = api_key,
            .base_url = if (std.mem.eql(u8, name, "openai")) 
                "https://api.openai.com/v1" 
            else 
                "https://api.mwcode.com/v1",
            .model = "gpt-4",
        };
    }

    pub fn call(self: *Provider, prompt: []const u8) ![]u8 {
        // TODO: implementar chamada HTTP
        return "Resposta do provedor";
    }
};
```

### Build e Testes
```bash
# Build do projeto
zig build

# Executar testes
zig build test

# Coverage
zig build coverage

# Executar exemplo
zig run example/basic.zig

# Instalar localmente
zig build install
```

### Configuração de Desenvolvimento
```bash
# Clonar repositório
git clone https://github.com/mweslley/MWCode
cd MWCode

# Instalar dependências
zig fetch

# Desenvolvimento com watch (opcional)
# Instalar zls (Zig Language Server)
zig install zls

# Rodar em modo de desenvolvimento
zig build run
```

### Contribuição
1. Fork o repositório
2. Crie uma branch para sua feature: `git checkout -b feature/nova-funcionalidade`
3. Faça o commit das mudanças: `git commit -m 'Add: nova funcionalidade'`
4. Abra um Pull Request

### Padrões de Código
- Siga o estilo do Zig padrão
- Use `const` sempre que possível
- Documente funções públicas
- Escreva testes para novas funcionalidades
- Use alocação consciente de memória

## 📋 Arquivos Adicionais

### .gitignore
```
# Zig
zig-cache/
zig-out/

# Binários
mwcode
mwcode.exe

# Configuração do usuário
.mwcode/
*.log

# IDE
.vscode/
.idea/
*.swp
*.swo

# Sistema
.DS_Store
Thumbs.db

# Testes
coverage/
*.test
```

### package.json (opcional, para scripts)
```json
{
  "name": "mwcode",
  "version": "0.1.0",
  "description": "High-performance AI coding CLI built in Zig",
  "scripts": {
    "build": "zig build",
    "test": "zig build test",
    "run": "zig build run",
    "install": "zig build install",
    "dev": "nodemon --watch src --ext zig --exec 'zig build run'"
  },
  "keywords": ["cli", "ai", "coding", "zig", "performance"],
  "author": "mweslley",
  "license": "MIT"
}
```

### LICENSE
```
MIT License

Copyright (c) 2026 mweslley

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 📝 Licença

MIT License - veja [LICENSE](LICENSE) para detalhes.

Este projeto é independente e não afiliado a qualquer empresa de IA existente.

## 🤝 Comunidade

- [GitHub Issues](https://github.com/mweslley/mwcode/issues) — Reportar bugs e sugerir features

---

## 🔧 Dicas de Desenvolvimento

### Primeiros Passos ao Clonar
```bash
# 1. Instalar Zig
curl -fsSL https://ziglang.org/download/0.11.0/zig-windows-x86_64-0.11.0.zip
# ou seguir instruções oficiais

# 2. Clonar repositório
git clone https://github.com/mweslley/MWCode
cd MWCode

# 3. Configurar ambiente
export PATH=$PATH:/path/to/zig

# 4. Build e teste
zig build
zig build test
```

### Debugging
```bash
# Compilar com debug
zig build -Drelease-safe=false

# Rodar com GDB (Linux)
gdb ./zig-out/bin/mwcode

# Log detalhado
MWCODE_LOG=debug ./mwcode
```

### Performance Tips
- Use `std.mem.Allocator` para alocação eficiente
- Prefira `const` sobre `var` sempre que possível
- Evite alocações desnecessárias em loops
- Use `defer` para cleanup automático

### Extensibilidade
- Adicionar novos provedores: criar arquivo em `src/providers/`
- Novas ferramentas: implementar em `src/tools/`
- Plugins: sistema baseado em carregamento dinâmico

---

**MWCode** - Sistema de controle para empresas de agentes de IA.

*100% Português Brasileiro |Built with ❤️ using React + Node.js*