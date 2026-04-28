# 📦 Guia de Instalação — MWCode

Este guia cobre todos os métodos disponíveis para instalar o MWCode. Escolha o que melhor se encaixa no seu ambiente.

---

## Método 1 — Script automático (Linux / VPS) ⭐ Recomendado

> Ideal para quem vai rodar em VPS ou servidor Linux dedicado.

**Pré-requisitos:**
- Ubuntu 22.04+, Debian 12+ ou distribuição similar
- Acesso SSH com usuário sudo

Execute este único comando:

```bash
curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/install-unico.sh \
  -o /tmp/install-mwcode.sh && bash /tmp/install-mwcode.sh
```

**O que o script faz, em ordem:**

1. Verifica se Node.js 20+ está instalado — se não, instala via nvm automaticamente
2. Instala o gerenciador de pacotes `pnpm` globalmente
3. Clona o repositório em `/opt/mwcode`
4. Instala todas as dependências do monorepo (`pnpm install`)
5. Compila a interface web (`pnpm build`)
6. Abre a porta `3100` no firewall (tenta UFW e iptables)
7. Inicia o servidor Node.js em background
8. Exibe a URL de acesso ao final

**Após a instalação:**

```bash
# Verificar se o servidor está rodando
curl http://localhost:3100/api/health

# Descobrir o IP público do VPS para acessar pelo navegador
curl ifconfig.me
```

Acesse no navegador: `http://SEU-IP:3100`

---

## Método 2 — Script automático (Windows)

> Para rodar o MWCode na sua máquina Windows.

Abra o **PowerShell como Administrador** e execute:

```powershell
irm https://raw.githubusercontent.com/mweslley/mwcode/main/install-unico.ps1 | iex
```

---

## Método 3 — Docker

> Ideal para quem prefere containers isolados ou já usa Docker no ambiente.

**Pré-requisito:** <a href="https://docs.docker.com/get-docker/" target="_blank" rel="noopener noreferrer">Docker</a> e <a href="https://docs.docker.com/compose/install/" target="_blank" rel="noopener noreferrer">Docker Compose</a> instalados.

```bash
# Clonar o repositório
git clone https://github.com/mweslley/mwcode.git
cd mwcode

# (Opcional) Criar arquivo .env com chave padrão do servidor
cp .env.example .env
# Edite o .env se quiser definir uma chave de API global

# Subir os containers
cd docker
docker compose up -d
```

Acesse: <a href="http://localhost:3100" target="_blank" rel="noopener noreferrer">http://localhost:3100</a>

---

## Método 4 — Manual (qualquer sistema)

> Para desenvolvedores que querem controle total.

**Pré-requisitos:**
- <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer">Node.js 20+</a>
- <a href="https://pnpm.io" target="_blank" rel="noopener noreferrer">pnpm 8+</a> (`npm install -g pnpm`)
- Git

```bash
# 1. Clonar o repositório
git clone https://github.com/mweslley/mwcode.git
cd mwcode

# 2. Instalar todas as dependências do monorepo
pnpm install

# 3. (Opcional) Configurar chave padrão do servidor
cp .env.example .env
# Edite o .env — usuários podem sobrescrever com a própria chave dentro do app

# 4. Iniciar em modo desenvolvimento (hot reload ativo)
pnpm dev
```

URLs em dev:
- Interface: <a href="http://localhost:5173" target="_blank" rel="noopener noreferrer">http://localhost:5173</a>
- API: <a href="http://localhost:3100" target="_blank" rel="noopener noreferrer">http://localhost:3100</a>

Para rodar partes separadas:

```bash
pnpm dev:server   # Só o servidor Node.js (porta 3100)
pnpm dev:ui       # Só a interface Vite (porta 5173)
```

---

## 🔑 Configurando as Chaves de API

**Cada usuário** cadastrado no MWCode configura sua própria chave de API. Isso garante que cada conta use sua própria cota e os custos vão diretamente para a conta do usuário no provedor.

### Onde configurar

- **Primeiro acesso:** O onboarding guia o usuário pelo processo de inserção e validação da chave
- **Usuários existentes:** Acesse **Configurações → Chaves de API** no menu lateral

### Como o sistema valida

Ao inserir uma chave e sair do campo, o MWCode faz uma chamada de teste ao provedor escolhido e exibe:
- ✅ **Válida** — a chave funciona, pode prosseguir
- ❌ **Inválida** — a chave está errada, expirada ou sem permissão

### Provedores disponíveis

#### <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer">OpenRouter</a> ⭐ Recomendado

Agregador com acesso a 200+ modelos. Uma única chave dá acesso a modelos de diversas empresas (Meta, Google, Mistral, DeepSeek, etc.).

- Criar chave: <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">openrouter.ai/keys</a> (cadastro gratuito)
- Prefixo da chave: `sk-or-v1-...`

> ⚠️ **Atenção sobre modelos gratuitos:** A chave em si é gratuita, mas **só modelos com `:free` no ID são de uso gratuito**. Exemplos: `meta-llama/llama-3.1-8b-instruct:free`, `deepseek/deepseek-chat:free`. Modelos sem `:free` (como `openai/gpt-4o`) são cobrados por token e exigem créditos na conta OpenRouter.

#### <a href="https://platform.openai.com" target="_blank" rel="noopener noreferrer">OpenAI</a>

Acesso direto aos modelos GPT.

- Criar chave: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">platform.openai.com/api-keys</a>
- Prefixo: `sk-...`
- **Sem tier gratuito** — exige créditos pré-pagos

#### <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer">Google Gemini</a>

Modelos Gemini do Google.

- Criar chave: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">aistudio.google.com/apikey</a>
- Prefixo: `AIza...`
- Gemini 1.5 Flash tem tier gratuito com limite de requisições por minuto

#### <a href="https://platform.deepseek.com" target="_blank" rel="noopener noreferrer">DeepSeek</a>

Modelos da DeepSeek — ótimo custo-benefício.

- Criar chave: <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer">platform.deepseek.com/api_keys</a>
- Prefixo: `sk-...`
- Pago, porém muito mais barato que OpenAI

#### <a href="https://ollama.com" target="_blank" rel="noopener noreferrer">Ollama</a> — Local

Roda modelos no seu próprio servidor. Zero custo, zero dados na nuvem.

- Instalar: <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer">ollama.com/download</a>
- Não exige chave de API — configure o endereço do servidor Ollama (padrão: `http://localhost:11434`)

---

## ✅ Verificar se a instalação funcionou

```bash
# Checar status do servidor
curl http://localhost:3100/api/health

# Resposta esperada:
# {"status":"ok","version":"...","provider":"openrouter","db":"configured",...}
```

---

## 🔄 Atualizar para versão mais recente

```bash
bash /opt/mwcode/update.sh
```

O script faz automaticamente: `git pull` → `pnpm install` → `pnpm build` → reinicia o servidor.

---

## 🗑️ Desinstalar

```bash
# Remover o código
sudo rm -rf /opt/mwcode

# ATENÇÃO: o comando abaixo apaga todos os usuários, agentes, histórico e configurações
rm -rf ~/.mwcode/data
```

> Se quiser só parar o servidor sem desinstalar: `pm2 stop mwcode`
