import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { dataDir } from './data-dir.js';
import type { Run } from '../routes/runs.js';

const execAsync = promisify(exec);
const FPS = 24;

// ── Ken Burns: 5 variações que se alternam por cena ──────────────────────────
function kbEffect(index: number, frames: number): string {
  const d = frames;
  const effects = [
    // 0 — Zoom in suave do centro (clássico documentário)
    `zoompan=z='min(zoom+0.0005,1.22)':d=${d}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=${FPS}`,
    // 1 — Zoom out lento (revela a cena, sensação de descoberta)
    `zoompan=z='if(lte(on,1),1.25,max(zoom-0.0005,1.0))':d=${d}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=${FPS}`,
    // 2 — Pan esquerda → direita com leve zoom (scanning investigativo)
    `zoompan=z='1.18':d=${d}:x='iw/zoom*min(on/${d},1)*(1-1/1.18)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=${FPS}`,
    // 3 — Zoom in desde canto inferior esquerdo (perspectiva de detetive)
    `zoompan=z='min(zoom+0.0005,1.2)':d=${d}:x='max(iw/2-(iw/zoom/2)-(iw/zoom*(0.3*(1-on/${d}))),0)':y='max(ih/2-(ih/zoom/2)+(ih/zoom*(0.2*(1-on/${d}))),0)':s=1920x1080:fps=${FPS}`,
    // 4 — Pan direita → esquerda com zoom leve (regresso, fechamento)
    `zoompan=z='1.18':d=${d}:x='iw/zoom*(1-1/1.18)*(1-min(on/${d},1))':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=${FPS}`,
  ];
  return effects[index % effects.length];
}

// ── Color grade: dark investigativo (teal shadows, contraste cinematográfico) ─
// Valores de curva sempre dentro de [0,1]; colorchannelmixer adiciona o teal
const COLOR_GRADE =
  "curves=r='0/0 0.5/0.43 1/0.87':g='0/0 0.5/0.46 1/0.83':b='0/0 0.5/0.53 1/0.98'," +
  "colorchannelmixer=rr=0.97:rb=0.03:gg=0.95:gb=0.02:bb=1.0," +
  "eq=contrast=1.12:brightness=-0.04:saturation=0.76," +
  "vignette=PI/5";

// ── Parser de prompts do Step 6 ───────────────────────────────────────────────
export function extractImagePrompts(stepOutput: string): string[] {
  const prompts: string[] = [];

  // Padrão principal: **Prompt (EN):** seguido de bloco em aspas (com ou sem linha separada)
  const promptBlocks = stepOutput.matchAll(
    /\*{0,2}Prompt\s*(?:\(EN\)|visual|de\simagem)?[:\s*]*\*{0,2}\s*["""]([^"""]{60,})["""]/gis
  );
  for (const m of promptBlocks) {
    const p = m[1].trim().replace(/\s+/g, ' ');
    if (p.length > 50) prompts.push(p);
  }

  // Fallback: linhas longas com "no text" (padrão típico de prompt de imagem)
  if (prompts.length === 0) {
    for (const line of stepOutput.split('\n')) {
      const clean = line.trim().replace(/^["*\-\s]+|["*\-\s]+$/g, '');
      if (clean.length > 100 && /no text|no letter|no word|cinematic|photorealistic/i.test(clean)) {
        prompts.push(clean);
      }
    }
  }

  // Remove duplicatas mantendo ordem
  return [...new Set(prompts)].slice(0, 10);
}

// ── Download de imagem (Pollinations.ai) ──────────────────────────────────────
function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    const req = proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        return downloadFile(res.headers.location!, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    });
    req.on('error', err => { file.close(); fs.unlink(dest, () => {}); reject(err); });
    req.setTimeout(90000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function downloadImage(prompt: string, seed: number, dest: string): Promise<boolean> {
  const encoded = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encoded}?width=1920&height=1080&nologo=true&model=flux&seed=${seed}`;
  try {
    await downloadFile(url, dest);
    const size = fs.statSync(dest).size;
    if (size < 10000) throw new Error('Imagem muito pequena');
    console.log(`[video] Imagem ${path.basename(dest)}: ${Math.round(size / 1024)} KB`);
    return true;
  } catch (e: any) {
    console.warn(`[video] Falha ao baixar imagem: ${e.message}. Usando fallback.`);
    // Fallback: cena preta sólida
    try {
      await execAsync(
        `ffmpeg -y -f lavfi -i color=c=0x0A1E2D:size=1920x1080:rate=1 -frames:v 1 "${dest}"`
      );
    } catch {}
    return false;
  }
}

// ── Duração do áudio via ffprobe ───────────────────────────────────────────────
async function getAudioDuration(audioPath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_format "${audioPath}"`
    );
    const info = JSON.parse(stdout);
    return parseFloat(info.format?.duration || '60');
  } catch {
    return 60;
  }
}

// ── Montagem principal ────────────────────────────────────────────────────────
export async function assembleVideo(userId: string, run: Run): Promise<string | null> {
  // 1. Encontrar step de direção visual e narração
  const visualStep = run.steps.find(s =>
    /visual|dire[cç]/i.test(s.stepName)
  );
  const narrationStep = run.steps.find(s => s.audioFile);

  if (!visualStep) {
    console.warn('[video] Step de direção visual não encontrado.');
    return null;
  }

  // 2. Extrair prompts
  const prompts = extractImagePrompts(visualStep.output);
  if (prompts.length === 0) {
    console.warn('[video] Nenhum prompt de imagem extraído do Step de Direção Visual.');
    return null;
  }
  console.log(`[video] ${prompts.length} prompts extraídos.`);

  // 3. Verificar áudio
  const audioDir = dataDir('audio', userId);
  const audioFile = narrationStep?.audioFile
    ? path.join(audioDir, narrationStep.audioFile)
    : null;

  if (!audioFile || !fs.existsSync(audioFile)) {
    console.warn('[video] Arquivo de áudio não encontrado.');
    return null;
  }

  // 4. Calcular duração das cenas
  const totalDuration = await getAudioDuration(audioFile);
  const n = prompts.length;
  const overlap = 1.2; // dissolve de 1.2s entre cenas
  // Cada cena precisa de: sceneDur + overlap (exceto a última)
  const sceneDur = Math.max(
    Math.round((totalDuration + overlap * (n - 1)) / n),
    12
  );
  console.log(`[video] Áudio: ${totalDuration.toFixed(1)}s | ${n} cenas × ${sceneDur}s`);

  // 5. Criar diretório de imagens (persistente — ficam acessíveis após montagem)
  const imgDir = path.join(dataDir('images', userId), run.id);
  fs.mkdirSync(imgDir, { recursive: true });

  // 6. Baixar imagens
  const imgFiles: string[] = [];
  const imgNames: string[] = [];
  for (let i = 0; i < n; i++) {
    const name = `scene_${String(i + 1).padStart(2, '0')}.jpg`;
    const dest = path.join(imgDir, name);
    const seed = 1972 + i * 37;
    await downloadImage(prompts[i], seed, dest);
    imgFiles.push(dest);
    imgNames.push(name);
    if (i < n - 1) await new Promise(r => setTimeout(r, 2000)); // respeitar rate limit
  }

  // 7. Montar FFmpeg com Ken Burns + color grade + xfade
  const videoDir = dataDir('videos', userId);
  fs.mkdirSync(videoDir, { recursive: true });
  const outputFile = path.join(videoDir, `${run.id}.mp4`);

  const cmd: string[] = ['ffmpeg', '-y'];

  // Inputs: cada imagem com duração = sceneDur + overlap (exceto última = sceneDur)
  for (let i = 0; i < n; i++) {
    const dur = i < n - 1 ? sceneDur + Math.ceil(overlap) : sceneDur;
    cmd.push('-loop', '1', '-t', String(dur), '-i', imgFiles[i]);
  }
  cmd.push('-i', audioFile);

  // Filter complex
  const filters: string[] = [];
  const frames = sceneDur * FPS;

  // Por cena: scale → zoompan (Ken Burns) → color grade → setsar/fps
  for (let i = 0; i < n; i++) {
    const kb = kbEffect(i, frames + Math.ceil(overlap) * FPS);
    filters.push(
      `[${i}:v]scale=1920:1080:force_original_aspect_ratio=increase,` +
      `crop=1920:1080,` +
      `${kb},` +
      `${COLOR_GRADE},` +
      `setsar=1,fps=${FPS},format=yuv420p[s${i}]`
    );
  }

  // xfade dissolve entre cenas
  let prev = '[s0]';
  for (let i = 1; i < n; i++) {
    const offset = i * sceneDur - Math.ceil(overlap / 2);
    const label = i === n - 1 ? '[vout]' : `[x${i}]`;
    filters.push(
      `${prev}[s${i}]xfade=transition=dissolve:duration=${overlap}:offset=${offset}${label}`
    );
    prev = `[x${i}]`;
  }

  cmd.push('-filter_complex', filters.join(';'));
  cmd.push('-map', '[vout]', '-map', `${n}:a`);
  cmd.push('-c:v', 'libx264', '-crf', '20', '-preset', 'slow');
  cmd.push('-c:a', 'aac', '-b:a', '192k');
  cmd.push('-shortest', outputFile);

  console.log('[video] Renderizando com FFmpeg (Ken Burns + color grade)...');
  try {
    await execAsync(cmd.join(' '), { timeout: 600000 });
    const sizeMb = (fs.statSync(outputFile).size / 1024 / 1024).toFixed(1);
    console.log(`[video] ✅ Vídeo gerado: ${outputFile} (${sizeMb} MB)`);
    // Salvar lista de imagens na run para exibição na UI
    const { loadRun, saveRun } = await import('../routes/runs.js');
    const fresh = loadRun(userId, run.id);
    if (fresh) saveRun(userId, { ...fresh, images: imgNames } as any);
    return outputFile;
  } catch (e: any) {
    console.error('[video] ❌ FFmpeg falhou:', e.message?.slice(0, 500));
    return null;
  }
}
