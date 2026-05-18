import fs from 'fs';
import path from 'path';
import { dataDir } from './data-dir.js';

// Valentino — voz masculina multilingual com ótima pronúncia PT-BR
const DEFAULT_VOICE_ID = 'onwK4e9ZLuTAKqWW03F9';
const ELEVEN_BASE = 'https://api.elevenlabs.io/v1';

function cleanForTTS(text: string): string {
  return text
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1')
    .replace(/`[^`]+`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function generateNarrationAudio(
  userId: string,
  runId: string,
  stepId: number,
  text: string,
  apiKey: string,
  voiceId?: string
): Promise<string | null> {
  const vid = voiceId || DEFAULT_VOICE_ID;
  const cleaned = cleanForTTS(text).slice(0, 4500);
  if (!cleaned) return null;

  try {
    const res = await fetch(`${ELEVEN_BASE}/text-to-speech/${vid}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: cleaned,
        model_id: 'eleven_turbo_v2_5',
        language_code: 'pt-BR',
        voice_settings: { stability: 0.55, similarity_boost: 0.80, style: 0.2 },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[elevenlabs] Erro ${res.status}: ${err.slice(0, 120)}`);
      return null;
    }

    const audioDir = dataDir('audio', userId);
    const audioFile = path.join(audioDir, `${runId}_step${stepId}.mp3`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(audioFile, buffer);
    console.log(`[elevenlabs] Áudio gerado: ${audioFile} (${buffer.length} bytes)`);
    return audioFile;
  } catch (e) {
    console.error('[elevenlabs] Erro inesperado:', (e as Error).message);
    return null;
  }
}
