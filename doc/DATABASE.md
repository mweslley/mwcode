# Banco de Dados

O MWCode usa Drizzle ORM com PostgreSQL em produção. Em dev o servidor opera em memória até `DATABASE_URL` ser definido.

## Tabelas

- `companies` — empresas (Enterprise mode)
- `agents` — agentes contratados
- `agent_history` — histórico de ações (contratação, demissão)
- `chats` — sessões de chat
- `tasks` — tarefas atribuídas a agentes

Schemas em `packages/db/src/schema/`.

## Migrations

```bash
pnpm db:generate    # cria SQL a partir dos schemas TS
pnpm db:migrate     # roda as migrations
pnpm db:push        # sincroniza schema direto (só dev)
```

## Backup

```bash
pg_dump $DATABASE_URL > backup.sql
```
