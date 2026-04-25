/**
 * Catálogo curado de modelos pra OpenRouter.
 *
 * Todos os modelos com sufixo `:free` são gratuitos no OpenRouter.
 * `openrouter/auto` deixa o OpenRouter escolher o melhor modelo grátis
 * disponível na hora — é o padrão do MWCode.
 *
 * Pra ver todos os modelos grátis disponíveis:
 *   https://openrouter.ai/models?q=free
 */

export interface ModeloIA {
  id: string;
  nome: string;
  descricao: string;
  contexto: string;        // tamanho de contexto, ex: "32K"
  melhorPara: string[];    // tags de uso ideal
  gratis: boolean;
  destaque?: boolean;       // mostrar em destaque na UI
}

export const MODELOS_OPENROUTER: ModeloIA[] = [
  // === GRÁTIS — DESTAQUE ===
  {
    id: 'openrouter/auto',
    nome: 'OpenRouter Auto',
    descricao: 'Roteador automático — escolhe o melhor modelo grátis disponível agora.',
    contexto: 'variável',
    melhorPara: ['início rápido', 'sem configurar', 'todo uso'],
    gratis: true,
    destaque: true,
  },
  {
    id: 'z-ai/glm-4.5-air:free',
    nome: 'GLM 4.5 Air',
    descricao: 'Modelo da Z-AI rápido e equilibrado, bom em raciocínio e código.',
    contexto: '128K',
    melhorPara: ['raciocínio', 'código', 'conversação'],
    gratis: true,
    destaque: true,
  },
  {
    id: 'meta-llama/llama-3.2-3b-instruct:free',
    nome: 'Llama 3.2 3B',
    descricao: 'Llama compacto da Meta. Resposta rápida, ótimo pra chat e tarefas leves.',
    contexto: '128K',
    melhorPara: ['rapidez', 'chat', 'tarefas simples'],
    gratis: true,
    destaque: true,
  },
  {
    id: 'google/gemma-3-27b-it:free',
    nome: 'Gemma 3 27B',
    descricao: 'Modelo aberto do Google, bom em multilíngue e seguir instruções.',
    contexto: '128K',
    melhorPara: ['português', 'multilíngue', 'instruções'],
    gratis: true,
    destaque: true,
  },

  // === GRÁTIS — OUTROS ===
  {
    id: 'deepseek/deepseek-r1:free',
    nome: 'DeepSeek R1',
    descricao: 'Modelo de raciocínio profundo da DeepSeek (estilo o1).',
    contexto: '64K',
    melhorPara: ['raciocínio', 'matemática', 'análise'],
    gratis: true,
  },
  {
    id: 'meta-llama/llama-3.1-405b-instruct:free',
    nome: 'Llama 3.1 405B',
    descricao: 'Llama gigante. Qualidade alta, resposta mais demorada.',
    contexto: '128K',
    melhorPara: ['qualidade máxima', 'tarefas complexas'],
    gratis: true,
  },
  {
    id: 'qwen/qwen-2.5-72b-instruct:free',
    nome: 'Qwen 2.5 72B',
    descricao: 'Modelo da Alibaba forte em código e raciocínio multilíngue.',
    contexto: '32K',
    melhorPara: ['código', 'multilíngue'],
    gratis: true,
  },
  {
    id: 'mistralai/mistral-small-3.1-24b-instruct:free',
    nome: 'Mistral Small 3.1',
    descricao: 'Mistral compacto e eficiente, bom equilíbrio velocidade/qualidade.',
    contexto: '128K',
    melhorPara: ['equilíbrio', 'chat geral'],
    gratis: true,
  },

  // === PAGOS (premium) ===
  {
    id: 'openai/gpt-4o',
    nome: 'GPT-4o',
    descricao: 'GPT-4 otimizado da OpenAI. Custa por uso.',
    contexto: '128K',
    melhorPara: ['qualidade premium', 'tarefas críticas'],
    gratis: false,
  },
  {
    id: 'openai/gpt-4o-mini',
    nome: 'GPT-4o Mini',
    descricao: 'Versão econômica do GPT-4o. Boa relação custo/benefício.',
    contexto: '128K',
    melhorPara: ['volume alto', 'custo baixo'],
    gratis: false,
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    nome: 'Claude 3.5 Sonnet',
    descricao: 'Claude da Anthropic. Excelente em escrita longa e código.',
    contexto: '200K',
    melhorPara: ['código complexo', 'escrita longa'],
    gratis: false,
  },
];

/** Modelo padrão do MWCode (sempre grátis). */
export const MODELO_PADRAO = 'openrouter/auto';

/** Filtro: só os grátis. */
export const MODELOS_GRATIS = MODELOS_OPENROUTER.filter((m) => m.gratis);

/** Filtro: só os destaques (pra UI compacta). */
export const MODELOS_DESTAQUE = MODELOS_OPENROUTER.filter((m) => m.destaque);

/** Busca info de um modelo pelo id. */
export function buscarModelo(id: string): ModeloIA | undefined {
  return MODELOS_OPENROUTER.find((m) => m.id === id);
}
