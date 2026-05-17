/** Parseia frontmatter "---\nchave: valor\n---\nbody" */
export function parseFrontmatter(raw: string): { meta: Record<string, any>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  return { meta: parseSimpleYaml(match[1]), body: match[2].trim() };
}

/** Parser simples para YAML com scalares, listas e blocos de sequência aninhada */
export function parseSimpleYaml(raw: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = raw.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const keyMatch = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (!keyMatch) { i++; continue; }
    const key = keyMatch[1];
    const rest = keyMatch[2].trim();

    if (rest.startsWith('[')) {
      // Inline list: [a, b, c]
      const inner = rest.slice(1, rest.lastIndexOf(']'));
      result[key] = inner ? inner.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')) : [];
      i++;
    } else if (rest === '' || rest === '|' || rest === '>') {
      // Block sequence or scalar — look at next lines
      const items: any[] = [];
      const blockLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].match(/^\s+/)) {
        const item = lines[i].match(/^\s+-\s+(.*)/);
        if (item) {
          // It's a list item — could be a scalar or start a map
          const itemVal = item[1].trim();
          if (itemVal === '') {
            // Multi-line map item
            const mapObj: Record<string, any> = {};
            i++;
            while (i < lines.length && lines[i].match(/^\s{2,}/)) {
              const mapLine = lines[i].match(/^\s+(\w[\w-]*):\s*(.*)/);
              if (mapLine) mapObj[mapLine[1]] = parseScalar(mapLine[2]);
              i++;
            }
            items.push(mapObj);
          } else if (itemVal.includes(':')) {
            // Inline map: - id: 1, name: "x"
            const mapObj: Record<string, any> = {};
            itemVal.split(/;\s*|,\s*(?=\w+:)/).forEach(pair => {
              const [k, ...vs] = pair.split(':');
              if (k) mapObj[k.trim()] = parseScalar(vs.join(':').trim());
            });
            items.push(mapObj);
            i++;
          } else {
            items.push(parseScalar(itemVal));
            i++;
          }
        } else {
          blockLines.push(lines[i].trim());
          i++;
        }
      }
      result[key] = items.length > 0 ? items : blockLines.join('\n').trim();
    } else {
      result[key] = parseScalar(rest);
      i++;
    }
  }
  return result;
}

function parseScalar(v: string): any {
  const s = v.trim().replace(/^["']|["']$/g, '');
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null' || v === '~') return null;
  const n = Number(s);
  if (!isNaN(n) && s !== '') return n;
  return s;
}

/** Parseia pipeline.yaml do mw-creator */
export function parsePipelineYaml(raw: string): {
  name: string;
  steps: Array<{ id: number; name: string; file?: string; type?: string }>;
  checkpoints: Array<{ id: number; description: string }>;
} {
  const lines = raw.split(/\r?\n/);
  const steps: Array<{ id: number; name: string; file?: string; type?: string }> = [];
  const checkpoints: Array<{ id: number; description: string }> = [];
  let name = '';
  let inSteps = false;
  let inCheckpoints = false;
  let currentStep: any = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('name:') && !inSteps && !inCheckpoints) {
      name = trimmed.replace(/^name:\s*["']?/, '').replace(/["']?$/, '');
      continue;
    }
    if (trimmed === 'steps:') { inSteps = true; inCheckpoints = false; continue; }
    if (trimmed === 'checkpoints:') { inCheckpoints = true; inSteps = false;
      if (currentStep) { steps.push(currentStep); currentStep = null; }
      continue;
    }

    if (inSteps) {
      if (trimmed.startsWith('- id:')) {
        if (currentStep) steps.push(currentStep);
        currentStep = { id: parseInt(trimmed.replace('- id:', '').trim()) };
      } else if (currentStep && trimmed.startsWith('name:')) {
        currentStep.name = trimmed.replace(/^name:\s*["']?/, '').replace(/["']?$/, '');
      } else if (currentStep && trimmed.startsWith('file:')) {
        currentStep.file = trimmed.replace(/^file:\s*["']?/, '').replace(/["']?$/, '');
      } else if (currentStep && trimmed.startsWith('type:')) {
        currentStep.type = trimmed.replace(/^type:\s*["']?/, '').replace(/["']?$/, '');
      }
    }

    if (inCheckpoints) {
      if (trimmed.startsWith('- id:')) {
        checkpoints.push({ id: parseInt(trimmed.replace('- id:', '').trim()), description: '' });
      } else if (trimmed.startsWith('description:') && checkpoints.length > 0) {
        checkpoints[checkpoints.length - 1].description =
          trimmed.replace(/^description:\s*["']?/, '').replace(/["']?$/, '');
      }
    }
  }
  if (currentStep) steps.push(currentStep);

  return { name, steps, checkpoints };
}

/** Parseia CSV com linha de header */
export function parseCsv(raw: string): Record<string, string>[] {
  const lines = raw.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i] || '']));
  });
}
