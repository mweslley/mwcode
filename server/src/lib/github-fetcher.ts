import fs from 'fs';

const MW_CREATOR_REPO = 'mweslley/mw-creator';

function resolveGitHubToken(): string | null {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const creds = fs.readFileSync('/root/.mwcredenciais', 'utf-8');
    const m = creds.match(/ghp_[A-Za-z0-9]+/);
    return m ? m[0] : null;
  } catch { return null; }
}

async function githubGet(apiPath: string): Promise<any> {
  const token = resolveGitHubToken();
  const headers: Record<string, string> = { Accept: 'application/vnd.github.v3+json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com${apiPath}`, { headers });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${apiPath}`);
  return res.json();
}

export async function fetchGitHubFile(
  filePath: string,
  repo = MW_CREATOR_REPO
): Promise<string> {
  const data = await githubGet(`/repos/${repo}/contents/${filePath}`);
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

export async function fetchGitHubDir(
  dirPath: string,
  repo = MW_CREATOR_REPO
): Promise<{ name: string; path: string; type: 'file' | 'dir' }[]> {
  const data = await githubGet(`/repos/${repo}/contents/${dirPath}`);
  return (Array.isArray(data) ? data : []).map((f: any) => ({
    name: f.name,
    path: f.path,
    type: f.type as 'file' | 'dir',
  }));
}
