# 🌐 Deploy em VPS — Guia Completo

Guia detalhado para rodar o MWCode em um servidor VPS Linux em produção, com PM2, nginx e HTTPS.

---

## Requisitos do servidor

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| Sistema operacional | Ubuntu 22.04 / Debian 12 | Ubuntu 22.04 LTS |
| RAM | 1 GB | 2 GB |
| Disco | 5 GB | 10 GB |
| CPU | 1 vCPU | 2 vCPU |
| Portas necessárias | 22 (SSH), 3100 | 22, 80, 443 (com nginx) |

> 💡 **Se for usar modelos locais via Ollama no mesmo servidor**, os requisitos sobem bastante: mínimo 8 GB RAM para modelos de 7B parâmetros, 16 GB para modelos de 13B+.

---

## Passo 1 — Conectar no servidor via SSH

```bash
ssh usuario@SEU-IP-DO-SERVIDOR
```

Se tiver chave SSH configurada:

```bash
ssh -i ~/.ssh/sua-chave.pem ubuntu@SEU-IP-DO-SERVIDOR
```

---

## Passo 2 — Instalação automática

Execute o instalador único — ele cuida de tudo:

```bash
curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/install-unico.sh \
  -o /tmp/install-mwcode.sh && bash /tmp/install-mwcode.sh
```

Após a conclusão, o servidor já estará rodando na porta 3100. Teste:

```bash
curl http://localhost:3100/api/health
```

---

## Passo 3 — Primeiro acesso e configuração

Acesse `http://SEU-IP:3100` no navegador e crie sua conta. O onboarding guia você pela configuração inicial:

1. Nome da empresa e área de atuação
2. Missão e objetivos
3. **Chave de API do provedor de IA** — cada usuário usa a própria chave
4. Modelo do agente CEO

**Sobre as chaves de API:**

As chaves são configuradas dentro do app por cada usuário. O arquivo `.env` do servidor aceita uma chave opcional que serve como fallback quando o usuário não tem chave própria:

```bash
nano /opt/mwcode/.env
```

```env
# Chave padrão do servidor (opcional — fallback para usuários sem chave própria)
OPENROUTER_API_KEY=sk-or-v1-sua-chave-aqui

# Configurações do servidor
NODE_ENV=production
PORT=3100

# Segurança — gere com: openssl rand -hex 32
JWT_SECRET=cole-aqui-um-valor-aleatorio-longo
```

Salve e reinicie:

```bash
pm2 restart mwcode
```

---

## Passo 4 — Rodar em background com PM2

PM2 é um gerenciador de processos que mantém o MWCode rodando mesmo após fechar o terminal e reinicia automaticamente se o processo cair.

**Instalar PM2:**

```bash
sudo npm install -g pm2
```

**Iniciar o MWCode com PM2:**

```bash
cd /opt/mwcode
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
# O pm2 vai imprimir um comando para executar — copie e execute esse comando
# Isso garante que o MWCode inicie automaticamente após um reboot do servidor
```

**Comandos úteis do PM2:**

```bash
pm2 status                    # Ver status de todos os processos
pm2 logs mwcode               # Ver logs em tempo real
pm2 logs mwcode --lines 200   # Ver últimas 200 linhas de log
pm2 restart mwcode            # Reiniciar o processo
pm2 stop mwcode               # Parar sem remover do PM2
pm2 delete mwcode             # Remover do PM2
pm2 monit                     # Monitoramento visual de CPU e memória
```

---

## Passo 5 — Configurar nginx (reverse proxy)

O nginx recebe o tráfego HTTP/HTTPS na porta 80/443 e redireciona para o MWCode na porta 3100. Isso permite usar um domínio próprio e HTTPS.

**Instalar nginx:**

```bash
sudo apt update && sudo apt install -y nginx
```

**Criar configuração:**

```bash
sudo nano /etc/nginx/sites-available/mwcode
```

Cole o conteúdo abaixo (substitua `seudominio.com` pelo seu domínio real):

```nginx
server {
    listen 80;
    server_name seudominio.com www.seudominio.com;

    # Tamanho máximo de upload (para possíveis anexos futuros)
    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3100;
        proxy_http_version 1.1;

        # Necessário para WebSocket (se implementado no futuro)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';

        # Headers de proxy corretos
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeout generoso para respostas longas da IA
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

**Ativar e testar:**

```bash
# Criar link simbólico para ativar o site
sudo ln -s /etc/nginx/sites-available/mwcode /etc/nginx/sites-enabled/

# Testar sintaxe da configuração
sudo nginx -t

# Recarregar nginx
sudo systemctl reload nginx
```

---

## Passo 6 — HTTPS com Let's Encrypt (gratuito)

Com o domínio apontando para o servidor, instale o certificado SSL gratuito:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d seudominio.com -d www.seudominio.com
```

Siga o passo a passo interativo. O certbot:
- Gera e instala o certificado automaticamente
- Modifica a configuração do nginx para redirecionar HTTP → HTTPS
- Configura renovação automática (válido por 90 dias, renova sozinho antes de vencer)

**Testar renovação automática:**

```bash
sudo certbot renew --dry-run
```

---

## Passo 7 — Firewall (UFW)

Com nginx na frente, feche a porta 3100 ao público:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # Abre 80 e 443
sudo ufw enable
```

Verificar regras ativas:

```bash
sudo ufw status verbose
```

> ⚠️ **Não** adicione uma regra para a porta 3100 — ela deve ser acessível apenas localmente pelo nginx. Expor o Node.js diretamente é um risco de segurança.

---

## Passo 8 — Atualizar para versão mais recente

```bash
bash /opt/mwcode/update.sh
```

O script faz automaticamente:
1. `git pull` para baixar as últimas mudanças
2. `pnpm install` para instalar novas dependências
3. `pnpm build` para recompilar a UI
4. `pm2 restart mwcode` para reiniciar com a nova versão

Para atualização manual:

```bash
cd /opt/mwcode
git pull
pnpm install
pnpm build
pm2 restart mwcode
```

---

## Passo 9 — Backup dos dados

Os dados ficam em `~/.mwcode/data/` — separados do código. Faça backup regularmente.

**Backup manual:**

```bash
mkdir -p ~/backups
tar -czf ~/backups/mwcode-$(date +%F).tgz ~/.mwcode/data/
```

**Backup automático via cron (diário às 3h):**

```bash
crontab -e
```

Adicione a linha:

```
0 3 * * * tar -czf /home/SEU-USUARIO/backups/mwcode-$(date +\%F).tgz ~/.mwcode/data/ 2>/dev/null
```

**Restaurar backup:**

```bash
# Para o servidor antes de restaurar
pm2 stop mwcode

# Restaurar
tar -xzf ~/backups/mwcode-YYYY-MM-DD.tgz -C ~/

# Reiniciar
pm2 start mwcode
```

---

## Monitoramento

```bash
# Status geral dos processos
pm2 status

# Uso de CPU e memória em tempo real
pm2 monit

# Logs do servidor (últimas 100 linhas)
pm2 logs mwcode --lines 100

# Recursos do sistema
htop          # CPU e memória interativo
df -h         # Espaço em disco
free -h       # Uso de memória RAM
```

---

## Solução de problemas

**Servidor não inicia:**
```bash
pm2 logs mwcode --lines 50   # Ver mensagens de erro
node -v                       # Verificar versão do Node (deve ser 20+)
```

**Porta 3100 ocupada:**
```bash
sudo lsof -i :3100            # Ver qual processo usa a porta
```

**nginx retorna 502 Bad Gateway:**
```bash
pm2 status                    # O MWCode está rodando?
curl http://localhost:3100/api/health   # Testar diretamente
sudo nginx -t                 # Verificar configuração do nginx
```

**Certificado SSL expirado:**
```bash
sudo certbot renew            # Renovar manualmente
sudo systemctl reload nginx   # Recarregar nginx
```

---

## Checklist de produção

Antes de considerar a instalação completa, verifique:

- [ ] Servidor acessível via `http://SEU-IP:3100`
- [ ] PM2 configurado: `pm2 status` mostra `online`
- [ ] `pm2 startup` executado — reinicia após reboot
- [ ] nginx instalado e proxy funcionando
- [ ] HTTPS ativo (certbot instalado, certificado válido)
- [ ] UFW habilitado — porta 3100 fechada ao público
- [ ] `/opt/mwcode/.env` com `chmod 600` e `JWT_SECRET` definido
- [ ] `NODE_ENV=production` no `.env`
- [ ] Backup automático agendado no cron
- [ ] Acesso testado pelo domínio com HTTPS
