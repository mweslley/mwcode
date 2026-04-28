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

## 1. Proteção do arquivo .env

O `.env` pode conter chaves de API do servidor. **Nunca commite esse arquivo**.

```bash
# Restrinja permissões no VPS
chmod 600 /opt/mwcode/.env

# Verificar
ls -la /opt/mwcode/.env
# -rw------- 1 usuario usuario ...
```

O `.gitignore` já ignora `.env`. Confirme antes de cada push:

```bash
git status --ignored | grep .env
```

---

## 2. Chaves de API por usuário

Cada usuário configura sua própria chave de API dentro do app. As chaves ficam em `~/.mwcode/data/keys/{userId}.json`, isoladas por usuário.

- As chaves **nunca** trafegam de volta para o frontend após salvas
- Restrinja permissões do diretório:

```bash
chmod 700 ~/.mwcode/data/keys/
```

---

## 3. Autenticação JWT

Todas as rotas protegidas exigem token JWT válido. O token é gerado no login e expira em 7 dias.

- Tokens são gerados com `jsonwebtoken` e um `JWT_SECRET` no `.env`
- Se `JWT_SECRET` não estiver definido, o servidor usa um valor padrão — **defina sempre em produção**:

```env
JWT_SECRET=gere-aqui-com-openssl-rand-hex-32
```

Gerar um secret seguro:

```bash
openssl rand -hex 32
```

---

## 4. CORS em produção

Por padrão, o servidor aceita qualquer origem (`*`). Em produção, restrinja no nginx usando cabeçalhos ou configure diretamente no código se necessário.

A forma mais simples é deixar o nginx recusar origens externas e só aceitar tráfego do seu domínio via proxy.

---

## 5. Rate limiting

Para prevenir abuso (principalmente endpoints de chat que consomem tokens):

Instale:
```bash
cd /opt/mwcode && pnpm add express-rate-limit
```

Em `server/src/index.ts`:

```ts
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', apiLimiter);

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10  // 10 msgs/min por IP
});

app.use('/api/chat', chatLimiter);
```

---

## 6. XSS (Cross-Site Scripting)

React escapa HTML por padrão. Evite `dangerouslySetInnerHTML` com input do usuário:

```tsx
// ❌ NUNCA
<div dangerouslySetInnerHTML={{ __html: userMessage }} />

// ✅ Certo
<div>{userMessage}</div>
```

Para renderizar markdown das respostas dos agentes, o projeto usa `react-markdown` com sanitização padrão.

---

## 7. HTTPS obrigatório em produção

Nunca exponha o MWCode sem HTTPS. Use:

- nginx + Let's Encrypt (veja [VPS.md](doc/VPS.md))
- Cloudflare (grátis, proxy + DDoS)
- Caddy (HTTPS automático)

---

## 8. Atualizações

Mantenha as dependências atualizadas:

```bash
cd /opt/mwcode
pnpm outdated       # ver desatualizadas
pnpm audit          # vulnerabilidades conhecidas
```

---

## 9. Logs — não vaze informações

Logs podem conter tokens e dados sensíveis:

```ts
// ❌ NUNCA logue o body inteiro
console.log('Request:', req.body);

// ✅ Logue só o necessário
console.log('Chat request from user:', req.userId);
```

---

## 10. Firewall

No VPS, feche tudo que não é essencial:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

A porta `3100` **não deve estar exposta** diretamente — só o nginx na frente.

---

## 11. Backup e recuperação

- Dados: `tar -czf backup.tgz ~/.mwcode/data/` (veja [VPS.md](doc/VPS.md) para agendar)
- `.env`: copie para local seguro (cofre de senhas, 1Password, etc.)

---

## 12. Privacidade com modelos de IA

Conversas com OpenRouter/OpenAI/Gemini passam pelos servidores deles. Para dados sensíveis:

- Use **Ollama local** — zero dados saem da máquina
- Ou rode modelos em VPS privado com GPU

Não mande dados de clientes, senhas ou PII para provedores em nuvem sem consentimento.

---

## Checklist de segurança em produção

- [ ] `/opt/mwcode/.env` com `chmod 600`
- [ ] `JWT_SECRET` definido com valor único e aleatório
- [ ] `NODE_ENV=production`
- [ ] HTTPS via nginx + Let's Encrypt
- [ ] UFW habilitado (só 22, 80, 443)
- [ ] Porta 3100 fechada ao público
- [ ] Rate limiting configurado
- [ ] Backup automático de `~/.mwcode/data/` agendado
- [ ] Dependências auditadas (`pnpm audit`)
- [ ] Secrets nunca commitados (verifique `.gitignore`)
