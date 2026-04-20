# 🔒 Segurança — MWCode

Guia de práticas de segurança para rodar o MWCode em produção.

---

## Reportar vulnerabilidades

Se você descobriu uma falha de segurança, **NÃO abra uma issue pública**.

Envie um e-mail para: **suporte@lojamwo.com.br** com:
- Descrição da falha
- Passos para reproduzir
- Impacto estimado

Responderemos em até 72h. Após o fix, você será creditado (se quiser).

---

## 1. Proteção das chaves de API

O `.env` contém credenciais sensíveis. **Nunca commite esse arquivo**.

```bash
# No VPS, restrinja permissões
chmod 600 ~/.mwcode/.env

# Verificar
ls -la ~/.mwcode/.env
# -rw------- 1 usuario usuario ...
```

O `.gitignore` já ignora `.env`, mas confira antes de cada push:

```bash
git status --ignored | grep .env
```

---

## 2. Variáveis sensíveis

| Variável | Onde guardar |
|----------|--------------|
| `OPENROUTER_API_KEY` | `.env` com `chmod 600` |
| `OPENAI_API_KEY` | `.env` com `chmod 600` |
| `DATABASE_URL` | `.env` com `chmod 600` |
| `SESSION_SECRET` | Gerar com `openssl rand -hex 32` |

Nunca coloque chaves em:
- Código fonte
- Logs
- Commits
- Screenshots
- Mensagens de erro expostas ao cliente

---

## 3. CORS em produção

Por padrão o servidor aceita qualquer origem (`*`) para facilitar dev. Em produção, restrinja:

```env
# .env
CORS_ORIGIN=https://seudominio.com
```

No código (`server/src/index.ts`):

```ts
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
```

---

## 4. Autenticação

O MWCode inclui middleware de autenticação mas **não ativa por padrão** (para facilitar desenvolvimento local).

**Em produção você DEVE ativar.** Opções:

### Opção A — Bearer token simples

```env
MWCODE_AUTH_TOKEN=gere-um-token-aleatorio-longo
```

Requisições passam a exigir:
```
Authorization: Bearer <token>
```

### Opção B — JWT

Implemente com `jsonwebtoken`. Veja [doc/AUTH.md](doc/AUTH.md) (quando disponível).

### Opção C — Reverse proxy com auth básica

No nginx:
```nginx
location / {
    auth_basic "MWCode";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://localhost:3100;
}
```

Criar usuário:
```bash
sudo apt install apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd admin
```

---

## 5. Rate limiting

Para prevenir abuso da API (principalmente endpoints de chat que custam tokens):

```bash
pnpm add express-rate-limit
```

Em `server/src/index.ts`:

```ts
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 100,                   // 100 req por janela
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', apiLimiter);

// Chat tem limite mais apertado (custa tokens)
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minuto
  max: 10                     // 10 msgs/min
});

app.use('/api/chat', chatLimiter);
```

---

## 6. Validação de input

Todos os endpoints que recebem dados usam validators em `packages/shared/src/validators/`. Eles:

- Rejeitam strings vazias em campos obrigatórios
- Validam formato de e-mail, UUID
- Limitam tamanho de texto (anti-DoS)

**Se adicionar um novo endpoint, valide o body antes de usar.**

---

## 7. SQL Injection

Usamos **Drizzle ORM** com queries parametrizadas. Isso elimina SQL injection automaticamente:

```ts
// ✅ SEGURO (parametrizado)
await db.select().from(agents).where(eq(agents.id, userInput));

// ❌ NUNCA faça (string concat)
await db.execute(`SELECT * FROM agents WHERE id = '${userInput}'`);
```

---

## 8. XSS (Cross-Site Scripting)

React escapa HTML por padrão. O perigo está em:

```tsx
// ❌ NUNCA use dangerouslySetInnerHTML com input do usuário
<div dangerouslySetInnerHTML={{ __html: userMessage }} />

// ✅ Deixe o React escapar
<div>{userMessage}</div>
```

Se precisar renderizar markdown, use `react-markdown` com sanitização.

---

## 9. HTTPS obrigatório em produção

**Nunca exponha o MWCode sem HTTPS.** Use:

- Reverse proxy com nginx + Let's Encrypt (grátis)
- Cloudflare (grátis, proxy + DDoS protection)
- Caddy (HTTPS automático)

Veja [doc/VPS.md](doc/VPS.md) para o passo a passo.

---

## 10. Atualizações

Pacotes desatualizados são o vetor #1 de ataques. Mantenha tudo atualizado:

```bash
# Ver dependências desatualizadas
pnpm outdated

# Atualizar tudo (cuidado com breaking changes)
pnpm update --latest

# Auditoria de vulnerabilidades
pnpm audit
```

Configure Dependabot no GitHub (já vem ativo no repo).

---

## 11. Logs — não vaze informação

Logs podem conter chaves de API, tokens, e-mails. Em produção:

```ts
// ❌ NUNCA logue o body inteiro
console.log('Request:', req.body);

// ✅ Logue só o que é seguro
console.log('Chat request from user:', req.userId);
```

O PM2 guarda logs em `~/.mwcode/logs/`. Garanta:
```bash
chmod 600 ~/.mwcode/logs/*.log
```

---

## 12. Firewall

No VPS, feche tudo que não é essencial:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

A porta `3100` (MWCode) **não deve estar exposta** — só acessível pelo nginx local.

---

## 13. Backup e recuperação

- Banco: backup diário via cron (veja [VPS.md](doc/VPS.md))
- `.env`: copie para local seguro (cofre de senhas, 1Password, etc.)
- Chaves de API: tenha um registro separado de onde obtê-las

---

## 14. Dependências de IA externa

Lembre-se: suas conversas com OpenAI/OpenRouter/Gemini passam pelos servidores deles. Para dados **sensíveis**:

- Use **Ollama local** — zero dados saem da máquina
- Ou rode modelos em VPS privado com GPU (vLLM, llama.cpp server)

Não mande dados de clientes, senhas ou PII para provedores em nuvem sem consentimento.

---

## Checklist de segurança em produção

- [ ] `.env` com `chmod 600`
- [ ] `NODE_ENV=production`
- [ ] `CORS_ORIGIN` restrito ao seu domínio
- [ ] Autenticação ativada (token/JWT/basic auth)
- [ ] Rate limiting configurado
- [ ] HTTPS via nginx + Let's Encrypt
- [ ] UFW habilitado (só 22, 80, 443)
- [ ] Porta 3100 fechada ao público
- [ ] Logs com permissão restrita
- [ ] Backup automático do banco
- [ ] Dependências atualizadas (`pnpm audit`)
- [ ] Dependabot ativo no GitHub
- [ ] Secrets nunca commitados (confira `.gitignore`)
