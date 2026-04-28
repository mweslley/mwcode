# Armazenamento de Dados

O MWCode usa **arquivos JSON** para persistência — sem banco de dados externo, sem configuração extra. Tudo funciona direto após a instalação.

## Onde os dados ficam

```
~/.mwcode/data/
├── users.json              # contas de usuário (hash de senha, JWT)
├── keys/
│   └── {userId}.json       # chaves de API por usuário
├── agents/
│   └── {userId}/
│       └── {agentId}.json  # agentes contratados
├── chats/
│   └── {userId}/
│       └── {agentId}.json  # histórico de conversa por agente
├── memories/
│   └── {userId}.json       # memórias persistidas
├── skills/
│   └── {userId}.json       # skills criadas
└── workflows/
    └── {userId}.json       # workflows agendados
```

O código fica em `/opt/mwcode/` e os dados em `~/.mwcode/data/` — atualizar o código não apaga dados.

## Backup

```bash
tar -czf backup-mwcode-$(date +%F).tgz ~/.mwcode/data/
```

Para agendar backup diário (cron):

```bash
crontab -e
```

Adicione:

```
0 3 * * * tar -czf ~/backups/mwcode-$(date +\%F).tgz ~/.mwcode/data/
```

## Restore

```bash
tar -xzf backup-mwcode-YYYY-MM-DD.tgz -C ~/
```

## Override do caminho de dados

Para usar um diretório personalizado (testes, múltiplas instâncias):

```bash
MWCODE_DATA_DIR=/meu/caminho pnpm dev
```

## Migração automática

Se você usava uma versão antiga que guardava dados em `/opt/mwcode/data/`, o servidor migra automaticamente na primeira execução para `~/.mwcode/data/`. Os dados antigos são mantidos em `/opt/mwcode/data/` e podem ser removidos manualmente após confirmar que tudo funciona.

## Nota sobre `packages/db`

O diretório `packages/db/` contém schemas Drizzle para uma futura integração com PostgreSQL. **Não está ativo no servidor atual.** O suporte a banco relacional é planejado para quando o volume de dados justificar — por enquanto os arquivos JSON atendem bem e simplificam a instalação.
