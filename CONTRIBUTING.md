# 🤝 Contribuindo com o MWCode

Obrigado por considerar contribuir! Este guia explica como fazer fork, trabalhar numa feature e abrir um PR.

---

## Fluxo básico: Fork → Clone → Branch → PR

### 1. Fork

Clique em **Fork** no topo do [repositório](https://github.com/mweslley/mwcode). Isso cria uma cópia em `https://github.com/SEU-USUARIO/mwcode`.

### 2. Clone o seu fork

```bash
git clone https://github.com/SEU-USUARIO/mwcode.git
cd mwcode
```

### 3. Adicione o upstream (repositório original)

Isso permite puxar atualizações do projeto principal:

```bash
git remote add upstream https://github.com/mweslley/mwcode.git
git remote -v
# origin    https://github.com/SEU-USUARIO/mwcode.git (fetch)
# origin    https://github.com/SEU-USUARIO/mwcode.git (push)
# upstream  https://github.com/mweslley/mwcode.git    (fetch)
# upstream  https://github.com/mweslley/mwcode.git    (push)
```

### 4. Instale e rode localmente

```bash
pnpm install
cp .env.example .env
# edite .env com sua chave de API
pnpm dev
```

### 5. Crie uma branch para sua alteração

```bash
git checkout -b feat/nome-da-feature
# ou
git checkout -b fix/nome-do-bug
```

**Nomes sugeridos:**
- `feat/...` — nova funcionalidade
- `fix/...` — correção de bug
- `docs/...` — documentação
- `refactor/...` — refatoração
- `test/...` — testes

### 6. Faça commits pequenos e descritivos

```bash
git add arquivo-alterado.ts
git commit -m "feat: adiciona suporte a provider Claude"
```

**Formato de mensagem (convenção Conventional Commits):**

```
<tipo>: <descrição curta>

[corpo opcional]

[rodapé opcional]
```

Tipos comuns: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

### 7. Sincronize com upstream antes de enviar

```bash
git fetch upstream
git rebase upstream/main
# resolva conflitos se aparecerem
```

### 8. Envie para o seu fork

```bash
git push origin feat/nome-da-feature
```

### 9. Abra o Pull Request

No GitHub, vá no seu fork. Clique em **Compare & pull request**.

**No PR descreva:**
- O que mudou
- Por quê (motivação)
- Como testar
- Screenshots (se UI)

---

## Mantendo seu fork atualizado

De tempos em tempos:

```bash
git checkout main
git fetch upstream
git merge upstream/main
git push origin main
```

---

## Estrutura do projeto

```
mwcode/
├── bin/              # CLI global (mwcode)
├── cli/              # Modo chat terminal
├── server/           # Backend Express + rotas
├── ui/               # Frontend React + Vite
├── packages/
│   ├── shared/       # Types + validators + constantes
│   ├── db/           # Drizzle schema + migrations
│   └── adapters/     # Providers de IA (OpenAI, OpenRouter, etc.)
├── docker/           # Dockerfile + docker-compose
├── doc/              # Documentação
├── vscode-extension/ # Extensão VS Code
└── install.sh        # Instalador bash
```

---

## Padrões de código

### TypeScript

- **Sempre** tipado (`any` é último recurso)
- Use `import type { ... }` quando importar só tipos
- Prefira funções puras quando possível
- Arquivos em `kebab-case.ts`
- Classes em `PascalCase`, funções em `camelCase`

### React

- Componentes em `PascalCase.tsx`
- Hooks customizados começam com `use`
- **UI 100% em português brasileiro** (pt-BR)
- Evite `any`, `as unknown as`, `dangerouslySetInnerHTML`

### Commits

- Um commit = uma mudança lógica
- Não misture refactor com feature no mesmo commit
- Não commite código comentado
- Não commite `console.log` de debug

---

## Antes de abrir o PR

Rode:

```bash
pnpm install          # garante deps atualizadas
pnpm typecheck        # sem erros de tipo
pnpm lint             # sem erros de lint
pnpm build            # build passa
```

(Se algum desses comandos ainda não existir, mencione no PR.)

---

## O que contribuir?

### Issues com label `good first issue`

Boas para primeira contribuição. Veja em:
https://github.com/mweslley/mwcode/issues?q=label%3A%22good+first+issue%22

### Ideias bem-vindas

- Novos providers de IA (Anthropic, Mistral, Groq, etc.)
- Tradução para outras línguas (hoje é só pt-BR)
- Testes unitários e de integração
- Melhorias na UI (acessibilidade, dark mode, mobile)
- Documentação — tutoriais, exemplos, vídeos
- Extensões para outros editores (JetBrains, Neovim, Zed)

### Antes de uma feature grande

Abra uma **issue de proposta** primeiro. Assim evitamos que você gaste horas em algo que não vai ser mergeado por questão de arquitetura.

---

## Código de conduta

- Seja respeitoso. Críticas vão ao código, não à pessoa.
- Respostas podem demorar — é um projeto mantido por um time pequeno.
- Se alguém te ajudar no PR, agradeça.
- Não use a issue tracker para suporte pessoal — use GitHub Discussions (quando ativado) ou e-mail.

---

## Licença

Ao contribuir, você concorda que seu código será distribuído sob a mesma licença do projeto ([MIT](LICENSE)).

---

## Dúvidas?

- Issues: https://github.com/mweslley/mwcode/issues
- E-mail: suporte@lojamwo.com.br

Valeu por contribuir! 🚀
