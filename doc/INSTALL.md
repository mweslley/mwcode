# 📦 Guia de Instalação

O MWCode pode ser instalado por vários métodos. Escolha o que preferir.

---

## 1. Instalação rápida via curl (Linux/macOS)

Um comando, instala tudo:

```bash
curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/install.sh | bash
```

Isso vai:
1. Verificar Node 20+ e git
2. Instalar pnpm se não tiver
3. Clonar o MWCode em `~/.mwcode`
4. Instalar todas as dependências
5. Criar o arquivo `.env`
6. Disponibilizar o comando `mwcode` globalmente

Depois é só rodar:

```bash
mwcode
```

### Variáveis de ambiente do instalador

- `MWCODE_HOME` — diretório de instalação (padrão: `~/.mwcode`)
- `MWCODE_BIN_DIR` — onde criar o symlink do comando (padrão: `/usr/local/bin`)
- `MWCODE_BRANCH` — branch para clonar (padrão: `main`)

Exemplo:

```bash
MWCODE_HOME=/opt/mwcode curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/install.sh | bash
```

---

## 2. Via npm

```bash
npm install -g @mweslley/mwcode
mwcode
```

> ⚠️ Requer o pacote publicado no npm. Se ainda não estiver, use o método curl.

---

## 3. Via bun

```bash
bun add -g @mweslley/mwcode
mwcode
```

---

## 4. Via pnpm

```bash
pnpm add -g @mweslley/mwcode
mwcode
```

---

## 5. Via Homebrew (macOS/Linux)

```bash
brew tap mweslley/mwcode
brew install mwcode
```

---

## 6. Via paru / yay (Arch Linux)

```bash
paru -S mwcode
# ou
yay -S mwcode
```

---

## 7. Via Docker

```bash
git clone https://github.com/mweslley/mwcode.git
cd mwcode/docker
cp ../.env.example ../.env
# edite ../.env com suas chaves
docker compose up -d
```

Acesse http://localhost:3100

---

## 8. Instalação manual (qualquer sistema)

```bash
# 1. Clonar
git clone https://github.com/mweslley/mwcode.git
cd mwcode

# 2. Instalar pnpm (se não tiver)
npm install -g pnpm

# 3. Instalar dependências
pnpm install

# 4. Configurar .env
cp .env.example .env
# edite .env com sua chave de API

# 5. Rodar
pnpm dev
```

---

## ▶️ Comandos disponíveis após instalar

```bash
mwcode              # inicia servidor + interface web
mwcode start        # idem
mwcode chat         # chat interativo no terminal
mwcode setup        # reconfigura instalação
mwcode update       # atualiza para última versão
mwcode version      # mostra versão
mwcode help         # ajuda
```

---

## 🔑 Configuração de chaves de API

Edite `~/.mwcode/.env` (ou o `.env` do seu diretório) e adicione **ao menos uma** chave:

```env
# OpenRouter — recomendado (modelos grátis disponíveis)
OPENROUTER_API_KEY=sk-or-v1-...

# OpenAI
OPENAI_API_KEY=sk-...

# Google Gemini
GEMINI_API_KEY=...

# DeepSeek
DEEPSEEK_API_KEY=...

# Ollama (rodando local, sem chave)
OLLAMA_BASE_URL=http://localhost:11434
```

### De onde pegar as chaves:

- **OpenRouter:** https://openrouter.ai/keys (cadastro grátis, modelos free disponíveis)
- **OpenAI:** https://platform.openai.com/api-keys (pago)
- **Gemini:** https://aistudio.google.com/apikey (grátis com limite)
- **DeepSeek:** https://platform.deepseek.com/api_keys
- **Ollama:** https://ollama.com/download (modelos locais, sem limite)

---

## 🔄 Atualizar

```bash
mwcode update
```

Ou manualmente:

```bash
cd ~/.mwcode
git pull
pnpm install
```

---

## 🗑️ Desinstalar

```bash
# Remover comando
sudo rm /usr/local/bin/mwcode

# Remover instalação
rm -rf ~/.mwcode
```
