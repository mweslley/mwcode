const APIFY_BASE = 'https://api.apify.com/v2';
const TIMEOUT_MS = 90_000;

export interface SearchResult {
  title: string;
  url: string;
  description: string;
}

export async function apifyGoogleSearch(
  apiToken: string,
  query: string,
  limit = 5
): Promise<SearchResult[]> {
  try {
    const url =
      `${APIFY_BASE}/acts/apify~google-search-scraper/run-sync-get-dataset-items` +
      `?token=${apiToken}&timeout=80&memory=256`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: query,
        resultsPerPage: limit,
        maxPagesPerQuery: 1,
        languageCode: 'pt',
        countryCode: 'BR',
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      console.error(`[apify] Erro ${res.status}: ${(await res.text()).slice(0, 120)}`);
      return [];
    }

    const data: any[] = await res.json();
    const results: SearchResult[] = [];

    for (const item of data) {
      for (const org of (item.organicResults || [])) {
        if (results.length >= limit) break;
        results.push({
          title: org.title || '',
          url: org.url || '',
          description: org.description || org.snippet || '',
        });
      }
      if (results.length >= limit) break;
    }

    console.log(`[apify] Pesquisa "${query}" → ${results.length} resultados`);
    return results;
  } catch (e: any) {
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
      console.warn('[apify] Timeout na busca — continuando sem dados Apify');
    } else {
      console.error('[apify] Erro inesperado:', e?.message);
    }
    return [];
  }
}

export function formatSearchResults(results: SearchResult[]): string {
  if (!results.length) return '';
  return (
    '## Dados de pesquisa real (Apify Google Search)\n\n' +
    results.map((r, i) =>
      `### ${i + 1}. ${r.title}\n**URL:** ${r.url}\n${r.description}`
    ).join('\n\n') +
    '\n\nUse esses dados reais como base da sua pesquisa. Cite as fontes quando relevante.'
  );
}
