# Guia de Desenvolvimento

## Pré-requisitos

- Node.js 20+
- pnpm 8+ (`npm install -g pnpm`)
- PostgreSQL 16+ (ou use Docker)

## Setup inicial

```bash
git clone https://github.com/mweslley/mwcode
cd mwcode
pnpm install
cp .env.example .env
# edite .env com suas chaves de API
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
├── server/              # API Express
├── ui/                  # React + Vite
├── packages/
│   ├── shared/         # tipos e constantes
│   ├── db/              # schema Drizzle
│   └── adapters/       # provedores de IA
├── cli/                # CLI para modo Single no terminal
├── docker/             # Dockerfile + compose
└── doc/                # documentação
```

## Como adicionar um novo provedor

1. Criar `packages/adapters/src/novo-provedor.ts` seguindo o padrão dos existentes
2. Exportar em `packages/adapters/src/index.ts`
3. Adicionar case em `packages/adapters/src/factory.ts`
4. Adicionar opção em `ui/src/components/HireModal.tsx`

## Banco de dados

**Desenvolvimento:** opera em memória (sem DATABASE_URL definido).

**Produção:**
```bash
# definir DATABASE_URL no .env
pnpm db:generate  # gera migrations
pnpm db:push      # aplica no banco
```

## Build de produção

```bash
pnpm build
pnpm start
```
