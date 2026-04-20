# 🌐 Deploy em VPS

Guia para rodar o MWCode em um servidor VPS Linux (Ubuntu 22.04+ recomendado).

---

## Pré-requisitos do VPS

- **SO:** Ubuntu 22.04+, Debian 12+, ou similar
- **RAM:** 1 GB mínimo (2 GB recomendado)
- **Disco:** 5 GB livres
- **Portas:** 80, 443 (web), 22 (SSH)

---

## 1. Conectar no VPS via SSH

```bash
ssh usuario@seu.ip.do.servidor
```

---

## 2. Instalação em 1 comando

```bash
curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/install.sh | bash
```

Isso instala Node, pnpm, clona o projeto em `~/.mwcode` e cria o comando `mwcode`.

---

## 3. Configurar a chave de API

```bash
nano ~/.mwcode/.env
```

Descomente e preencha:

```env
OPENROUTER_API_KEY=sk-or-v1-sua-chave-aqui
NODE_ENV=production
PORT=3100
```

Salve (Ctrl+O, Enter, Ctrl+X).

---

## 4. Build de produção

```bash
cd ~/.mwcode
pnpm build
```

---

## 5. Rodar em background com PM2

PM2 mantém o processo rodando mesmo após fechar o terminal e reinicia se cair.

### Instalar PM2

```bash
sudo npm install -g pm2
```

### Iniciar o MWCode

```bash
cd ~/.mwcode
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
# copie e execute o comando que o pm2 imprimiu (para iniciar após reboot)
```

### Comandos úteis do PM2

```bash
pm2 status              # ver status
pm2 logs mwcode          # ver logs em tempo real
pm2 restart mwcode      # reiniciar
pm2 stop mwcode         # parar
pm2 delete mwcode       # remover do PM2
pm2 monit               # monitoramento visual
```

---

## 6. Reverse proxy com nginx (HTTPS + domínio próprio)

### Instalar nginx

```bash
sudo apt update
sudo apt install -y nginx
```

### Criar configuração

```bash
sudo nano /etc/nginx/sites-available/mwcode
```

Cole:

```nginx
server {
    listen 80;
    server_name seudominio.com;

    location / {
        proxy_pass http://localhost:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Ative e teste:

```bash
sudo ln -s /etc/nginx/sites-available/mwcode /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### HTTPS grátis com Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d seudominio.com
```

Siga o passo a passo. O certbot configura HTTPS automaticamente e renova sozinho.

---

## 7. Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

**NÃO exponha a porta 3100 diretamente** — deixe o nginx na frente.

---

## 8. Atualizar em produção

```bash
cd ~/.mwcode
git pull
pnpm install
pnpm build
pm2 restart mwcode
```

---

## 9. Backup do banco (se usar PostgreSQL)

```bash
# backup
pg_dump $DATABASE_URL > ~/backup-mwcode-$(date +%F).sql

# restore
psql $DATABASE_URL < ~/backup-mwcode-YYYY-MM-DD.sql
```

Agende com cron:

```bash
crontab -e
```

Adicione (backup diário às 3h):

```
0 3 * * * pg_dump $DATABASE_URL > /home/usuario/backups/mwcode-$(date +\%F).sql
```

---

## 10. Monitoramento

```bash
# Uso de CPU/memória
pm2 monit

# Logs
pm2 logs mwcode --lines 200

# Status do sistema
htop
df -h
free -h
```

---

## Checklist de produção

- [ ] `NODE_ENV=production` no `.env`
- [ ] `.env` com permissão `600` (`chmod 600 .env`)
- [ ] PM2 configurado com `pm2 startup` + `pm2 save`
- [ ] nginx com HTTPS (certbot)
- [ ] UFW habilitado
- [ ] Backups agendados
- [ ] Autenticação ativada (veja SECURITY.md)
- [ ] Rate limiting configurado (veja SECURITY.md)
- [ ] Logs monitorados
