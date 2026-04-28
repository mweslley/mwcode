# 🌐 Deploy em VPS

Guia para rodar o MWCode em um servidor VPS Linux (Ubuntu 22.04+ recomendado).

---

## Pré-requisitos do VPS

- **SO:** Ubuntu 22.04+, Debian 12+, ou similar
- **RAM:** 1 GB mínimo (2 GB recomendado)
- **Disco:** 5 GB livres
- **Portas:** 80, 443 (web), 22 (SSH), 3100 (API — pode fechar ao público se usar nginx)

---

## 1. Conectar no VPS via SSH

```bash
ssh usuario@seu.ip.do.servidor
```

---

## 2. Instalação em 1 comando

```bash
curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/install-unico.sh -o /tmp/install-mwcode.sh && bash /tmp/install-mwcode.sh
```

Isso instala Node, pnpm, clona o projeto em `/opt/mwcode`, compila e inicia o servidor na porta 3100.

---

## 3. Acessar e criar conta

Após instalar, acesse `http://SEU-IP:3100` e crie sua conta. As chaves de API são configuradas dentro do app (aba Configurações → Chaves de API), sem precisar editar arquivos no servidor.

Se quiser uma chave padrão para todo o servidor (fallback quando usuários não têm chave própria):

```bash
nano /opt/mwcode/.env
```

```env
OPENROUTER_API_KEY=sk-or-v1-sua-chave
NODE_ENV=production
PORT=3100
```

---

## 4. Rodar em background com PM2

PM2 mantém o processo rodando após fechar o terminal e reinicia automaticamente.

```bash
sudo npm install -g pm2
cd /opt/mwcode
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
# copie e execute o comando que o pm2 imprimiu (para iniciar após reboot)
```

### Comandos úteis do PM2

```bash
pm2 status              # ver status
pm2 logs mwcode         # logs em tempo real
pm2 restart mwcode      # reiniciar
pm2 stop mwcode         # parar
pm2 monit               # monitoramento visual
```

---

## 5. Reverse proxy com nginx (HTTPS + domínio próprio)

```bash
sudo apt update && sudo apt install -y nginx
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

Ative:

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

---

## 6. Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

> Se estiver usando nginx, **não precisa expor a porta 3100** ao público — o nginx faz o proxy.

---

## 7. Atualizar em produção

```bash
bash /opt/mwcode/update.sh
```

Ou manualmente:

```bash
cd /opt/mwcode
git pull
pnpm install
pnpm build
pm2 restart mwcode
```

---

## 8. Backup dos dados

Os dados ficam em `~/.mwcode/data/` (usuários, agentes, histórico de chats, memórias). Faça backup regularmente:

```bash
tar -czf ~/backup-mwcode-$(date +%F).tgz ~/.mwcode/data/
```

Agendar backup diário com cron:

```bash
crontab -e
```

Adicione:

```
0 3 * * * tar -czf ~/backups/mwcode-$(date +\%F).tgz ~/.mwcode/data/ 2>/dev/null
```

---

## 9. Monitoramento

```bash
pm2 monit                      # CPU e memória em tempo real
pm2 logs mwcode --lines 200    # últimos logs
htop                           # sistema geral
df -h                          # espaço em disco
free -h                        # memória
```

---

## Checklist de produção

- [ ] PM2 configurado com `pm2 startup` + `pm2 save`
- [ ] nginx com HTTPS (certbot)
- [ ] UFW habilitado (só 22, 80, 443)
- [ ] `/opt/mwcode/.env` com permissão `600` (`chmod 600 /opt/mwcode/.env`)
- [ ] `NODE_ENV=production` no `.env`
- [ ] Backup diário de `~/.mwcode/data/` agendado
- [ ] Logs monitorados (`pm2 logs`)
