# Guia de Desenvolvimento

## Pré-requisitos

- Node.js 20+
- pnpm 8+ (`npm install -g pnpm`)

> Não é necessário banco de dados. O servidor usa arquivos JSON em `~/.mwcode/data/`.

## Setup inicial

```bash
git clone https://github.com/mweslley/mwcode
cd mwcode
pnpm install
cp .env.example .env
# (opcional) adicione uma chave de API padrão do servidor no .env
# usuários também podem configurar a própria chave dentro do app
```

## Rodar em modo dev

```bash
# Terminal 1 — servidor Node
pnpm dev:server     # http://localhost:3100

# Terminal 2 — UI Vite
pnpm dev:ui         # http://localhost:5173
```

Ou tudo junto:

```bash
pnpm dev
```

## Estrutura do monorepo

```
mwcode/
├── server/              # API Express + TypeScript
│   └── src/
│       ├── routes/      # auth, chat, enterprise, skills, workflows, models, ...
│       ├── middleware/  # JWT, company scope
│       └── lib/         # data-dir, adapters
├── ui/                  # React + Vite
│   └── src/
│       ├── pages/       # Login, Onboarding, Dashboard, Chat, Agents, Workflows, Settings
│       └── components/  # ModelPicker, MessageRenderer, ...
├── packages/
│   ├── shared/          # tipos, constantes e listas de modelos
│   ├── adapters/        # provedores de IA (OpenRouter, OpenAI, Gemini, DeepSeek, Ollama)
│   └── db/              # schemas Drizzle (reservado para futura integração com PostgreSQL)
├── cli/                 # modo chat interativo no terminal
├── bin/                 # CLI global (mwcode)
├── docker/              # Dockerfile + docker-compose
├── vscode-extension/    # extensão VS Code (em desenvolvimento)
├── scripts/
│   └── skills.sh        # CLI para gerenciar skills pelo terminal
└── doc/                 # documentação
```

## Como adicionar um novo provedor de IA

1. Criar `packages/adapters/src/novo-provedor.ts` seguindo o padrão dos existentes
2. Exportar em `packages/adapters/src/index.ts`
3. Adicionar case em `packages/adapters/src/factory.ts`
4. Adicionar opção em `ui/src/pages/Onboarding.tsx` (array `PROVIDER_OPTIONS`)
5. Adicionar caso em `server/src/routes/models.ts` (validate + list)

## Armazenamento de dados

O servidor usa arquivos JSON em `~/.mwcode/data/`. Veja [DATABASE.md](DATABASE.md) para a estrutura completa.

Para sobrescrever o diretório durante desenvolvimento:

```bash
MWCODE_DATA_DIR=./dev-data pnpm dev:server
```

## Build de produção

```bash
pnpm build   # compila UI + server
pnpm start   # inicia servidor (serve a UI compilada em /api/* + static)
```
