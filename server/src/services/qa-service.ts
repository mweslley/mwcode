/**
 * QA Service — smoke tests + integração TestSprite
 *
 * Fluxo por tipo de tarefa:
 * - lojamwo: smoke test em staging.lojamwo.com.br + TestSprite se houver test files
 * - blade:   smoke test em blade.lojamwo.com.br/api/health
 * - mwcode:  smoke test + aprovação humana obrigatória (sem staging próprio)
 * - infra:   sem staging — encaminha direto para aprovação humana
 * - generic: smoke test na URL fornecida
 */

const TESTSPRITE_API_BASE = 'https://api.testsprite.com';
const TESTSPRITE_API_KEY = process.env.TESTSPRITE_API_KEY;

// ── TestSprite ────────────────────────────────────────────────────────────────

interface TSUser {
  id: string;
  credits: number;
  user: string;
  subPlan: string;
  endPlanDate: string;
}

async function getTestSpriteUser(): Promise<TSUser | null> {
  if (!TESTSPRITE_API_KEY) return null;
  try {
    const r = await fetch(`${TESTSPRITE_API_BASE}/api/me`, {
      headers: { 'Authorization': `Bearer ${TESTSPRITE_API_KEY}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    return await r.json() as TSUser;
  } catch { return null; }
}

interface TSTestCase {
  title: string;
  description: string;
  code: string;
  testStatus?: string;
  testType?: string;
}

interface TSTestList {
  compositeKey: string;
  tests: Array<{ title: string; testStatus: string; processStatus: string }>;
}

async function createTestList(testCases: TSTestCase[]): Promise<TSTestList | null> {
  if (!TESTSPRITE_API_KEY || testCases.length === 0) return null;
  try {
    const r = await fetch(`${TESTSPRITE_API_BASE}/github/testlist`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TESTSPRITE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        repoName: 'mweslley/lmwo',
        repoId: 'lmwo',
        branchName: 'main',
        testCases,
        apiKey: TESTSPRITE_API_KEY,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    return await r.json() as TSTestList;
  } catch { return null; }
}

async function runTestList(compositeKey: string): Promise<boolean> {
  if (!TESTSPRITE_API_KEY) return false;
  try {
    const r = await fetch(`${TESTSPRITE_API_BASE}/github/${encodeURIComponent(compositeKey)}/run`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TESTSPRITE_API_KEY}` },
      signal: AbortSignal.timeout(10000),
    });
    return r.ok;
  } catch { return false; }
}

async function pollTestList(compositeKey: string, timeoutMs = 10 * 60 * 1000): Promise<TSTestList | null> {
  if (!TESTSPRITE_API_KEY) return null;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${TESTSPRITE_API_BASE}/github/testlist/${encodeURIComponent(compositeKey)}`, {
        headers: { 'Authorization': `Bearer ${TESTSPRITE_API_KEY}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) break;
      const list = await r.json() as TSTestList;
      const allIdle = list.tests.every(t => t.processStatus === 'Idle');
      if (allIdle) return list;
    } catch { break; }
    await new Promise(r => setTimeout(r, 5000));
  }
  return null;
}

// ── Smoke test ────────────────────────────────────────────────────────────────

interface SmokeResult {
  passed: boolean;
  status: number;
  ms: number;
  error?: string;
}

async function smokeTest(url: string): Promise<SmokeResult> {
  try {
    const start = Date.now();
    const r = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(12000) });
    const ms = Date.now() - start;
    return { passed: r.ok, status: r.status, ms };
  } catch (e: any) {
    return { passed: false, status: 0, ms: 0, error: e.message };
  }
}

// ── Tipos públicos ────────────────────────────────────────────────────────────

export type QATaskType = 'lojamwo' | 'mwcode' | 'infra' | 'blade' | 'generic';

const STAGING_URLS: Partial<Record<QATaskType, string>> = {
  lojamwo: 'https://staging.lojamwo.com.br',
  blade: 'https://blade.lojamwo.com.br/api/health',
  mwcode: 'https://mwcode.lojamwo.com.br',
};

export interface QAReport {
  tipo: QATaskType;
  url: string | null;
  passed: boolean;
  needsHumanReview: boolean;
  summary: string;
  details: string;
  testEngine: 'testsprite' | 'smoke' | 'skipped';
  credits?: number;
  resultUrl?: string;
}

// ── Função principal ──────────────────────────────────────────────────────────

export async function runQA(
  tipo: QATaskType,
  description: string,
  explicitUrl?: string,
  testCases?: TSTestCase[],
): Promise<QAReport> {
  const url = explicitUrl || STAGING_URLS[tipo] || null;

  // Infra → sem staging, obrigatório aprovação humana
  if (tipo === 'infra' || !url) {
    return {
      tipo, url: null, passed: false, needsHumanReview: true,
      summary: '⚠️ Tarefa de infraestrutura — sem staging disponível.',
      details: [
        '**Tipo:** Infraestrutura',
        '**Staging:** Não disponível para tarefas de infra',
        '**Ação:** Encaminhado automaticamente para aprovação humana antes de qualquer alteração em produção.',
      ].join('\n'),
      testEngine: 'skipped',
    };
  }

  // Verifica créditos TestSprite
  const tsUser = await getTestSpriteUser();
  const credits = tsUser?.credits ?? 0;

  // Smoke test (sempre executa)
  const smoke = await smokeTest(url);
  const smokeIcon = smoke.passed ? '✅' : '❌';
  const smokeDetail = smoke.error
    ? `❌ Erro: ${smoke.error}`
    : `${smokeIcon} HTTP ${smoke.status} em ${smoke.ms}ms`;

  // TestSprite — executa se tiver créditos e testCases disponíveis
  let testspriteSection = '';
  let testspriteEngine: QAReport['testEngine'] = 'smoke';
  let resultUrl: string | undefined;

  if (credits > 0 && TESTSPRITE_API_KEY && testCases && testCases.length > 0) {
    console.log(`[QA] Executando TestSprite — ${credits} créditos, ${testCases.length} test cases`);
    const list = await createTestList(testCases);
    if (list) {
      await runTestList(list.compositeKey);
      const result = await pollTestList(list.compositeKey);
      if (result) {
        const total = result.tests.length;
        const passed = result.tests.filter(t => t.testStatus === 'PASSED').length;
        const failed = total - passed;
        testspriteSection = `\n\n**TestSprite:** ${passed}/${total} testes passaram${failed > 0 ? ` (${failed} falharam)` : ''} — ${credits} créditos usados`;
        resultUrl = `https://www.testsprite.com/github-action/${encodeURIComponent(list.compositeKey)}`;
        testspriteEngine = 'testsprite';
      } else {
        testspriteSection = `\n\n**TestSprite:** Timeout ao aguardar resultado`;
      }
    } else {
      testspriteSection = `\n\n**TestSprite:** Erro ao criar test list`;
    }
  } else if (credits > 0) {
    testspriteSection = `\n\n**TestSprite:** ${credits} créditos disponíveis — sem arquivos \`testsprite_tests/\` configurados ainda`;
  } else {
    testspriteSection = `\n\n**TestSprite:** ${TESTSPRITE_API_KEY ? 'Sem créditos disponíveis' : 'API key não configurada'}`;
  }

  const passed = smoke.passed;
  const needsHumanReview = !passed || tipo === 'mwcode';

  const details = [
    `**URL:** ${url}`,
    `**Smoke test:** ${smokeDetail}`,
    testspriteSection,
    tipo === 'mwcode' ? '\n**Nota:** MWCode não possui staging próprio — aprovação humana obrigatória mesmo quando smoke test passa.' : '',
  ].filter(Boolean).join('\n');

  return {
    tipo, url, passed, needsHumanReview,
    summary: passed
      ? `✅ QA passou — ${url} (HTTP ${smoke.status}, ${smoke.ms}ms)`
      : `❌ QA falhou — ${smoke.error ?? `HTTP ${smoke.status}`}`,
    details: details.trim(),
    testEngine: testspriteEngine,
    credits,
    resultUrl,
  };
}
