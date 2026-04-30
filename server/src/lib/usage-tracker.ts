import fs from 'fs';
import { dataPath, dataDir } from './data-dir.js';

// ── Pricing table: cost per 1K tokens (USD, approximate blended input+output) ─
const PRICE_PER_1K: Record<string, number> = {
  'gpt-4o': 0.005,
  'gpt-4o-mini': 0.00015,
  'gpt-4-turbo': 0.015,
  'gpt-4': 0.03,
  'gpt-3.5-turbo': 0.0005,
  'claude-3-5-sonnet': 0.004,
  'claude-3-5-haiku': 0.0005,
  'claude-3-opus': 0.015,
  'claude-3-sonnet': 0.004,
  'claude-3-haiku': 0.00025,
  'claude-sonnet-4': 0.004,
  'claude-haiku-4': 0.0005,
  'gemini-2.0-flash': 0.000075,
  'gemini-1.5-flash': 0.000075,
  'gemini-1.5-pro': 0.00125,
  'deepseek-chat': 0.00014,
  'deepseek-coder': 0.00014,
  'deepseek-r1': 0.00055,
  'llama': 0,
  'gemma': 0,
  'qwen': 0,
  'mistral': 0.0002,
  'mixtral': 0.0004,
};
const DEFAULT_PRICE = 0.001;

export function estimateCost(model: string, tokens: number): number {
  const m = (model || '').toLowerCase();
  for (const [key, price] of Object.entries(PRICE_PER_1K)) {
    if (m.includes(key)) return (tokens / 1000) * price;
  }
  return (tokens / 1000) * DEFAULT_PRICE;
}

// ── Data types ────────────────────────────────────────────────────────────────

export interface UsageEntry {
  ts: string;
  agentId: string;
  agentName: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  source?: string;
}

export interface AgentUsage {
  name: string;
  tokens: number;
  costUsd: number;
  calls: number;
}

export interface UsageData {
  updatedAt: string;
  totals: { tokens: number; costUsd: number; calls: number };
  today: { tokens: number; costUsd: number; calls: number };
  thisMonth: { tokens: number; costUsd: number; calls: number };
  todayDate: string;
  thisMonthKey: string;
  byAgent: Record<string, AgentUsage>;
  log: UsageEntry[];
}

export interface SpendingLimits {
  global?: { dailyUsd?: number; monthlyUsd?: number };
  byAgent?: Record<string, { dailyUsd?: number; dailyTokens?: number }>;
}

// ── File helpers ──────────────────────────────────────────────────────────────

const LOG_MAX = 500;

function usageFile(userId: string): string {
  dataDir('usage');
  return dataPath('usage', `${userId}.json`);
}

function limitsFile(userId: string): string {
  dataDir('limits');
  return dataPath('limits', `${userId}.json`);
}

export function loadUsage(userId: string): UsageData {
  const file = usageFile(userId);
  if (!fs.existsSync(file)) return emptyUsage();
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return emptyUsage(); }
}

function emptyUsage(): UsageData {
  const now = new Date();
  return {
    updatedAt: now.toISOString(),
    totals: { tokens: 0, costUsd: 0, calls: 0 },
    today: { tokens: 0, costUsd: 0, calls: 0 },
    thisMonth: { tokens: 0, costUsd: 0, calls: 0 },
    todayDate: now.toISOString().slice(0, 10),
    thisMonthKey: now.toISOString().slice(0, 7),
    byAgent: {},
    log: [],
  };
}

function saveUsage(userId: string, data: UsageData): void {
  fs.writeFileSync(usageFile(userId), JSON.stringify(data, null, 2));
}

export function loadLimits(userId: string): SpendingLimits {
  const file = limitsFile(userId);
  if (!fs.existsSync(file)) return {};
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return {}; }
}

export function saveLimits(userId: string, limits: SpendingLimits): void {
  fs.writeFileSync(limitsFile(userId), JSON.stringify(limits, null, 2));
}

// ── Main API ──────────────────────────────────────────────────────────────────

export function recordUsage(
  userId: string,
  entry: Omit<UsageEntry, 'ts' | 'costUsd'> & { costUsd?: number }
): void {
  const data = loadUsage(userId);
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const monthKey = now.toISOString().slice(0, 7);

  // Reset daily counters if new day
  if (data.todayDate !== todayKey) {
    data.today = { tokens: 0, costUsd: 0, calls: 0 };
    data.todayDate = todayKey;
  }
  // Reset monthly counters if new month
  if (data.thisMonthKey !== monthKey) {
    data.thisMonth = { tokens: 0, costUsd: 0, calls: 0 };
    data.thisMonthKey = monthKey;
  }

  const cost = entry.costUsd ?? estimateCost(entry.model, entry.totalTokens);
  const full: UsageEntry = { ...entry, ts: now.toISOString(), costUsd: cost };

  // Update totals
  data.totals.tokens += entry.totalTokens;
  data.totals.costUsd += cost;
  data.totals.calls += 1;

  data.today.tokens += entry.totalTokens;
  data.today.costUsd += cost;
  data.today.calls += 1;

  data.thisMonth.tokens += entry.totalTokens;
  data.thisMonth.costUsd += cost;
  data.thisMonth.calls += 1;

  // Update per-agent
  if (!data.byAgent[entry.agentId]) {
    data.byAgent[entry.agentId] = { name: entry.agentName, tokens: 0, costUsd: 0, calls: 0 };
  }
  data.byAgent[entry.agentId].name = entry.agentName;
  data.byAgent[entry.agentId].tokens += entry.totalTokens;
  data.byAgent[entry.agentId].costUsd += cost;
  data.byAgent[entry.agentId].calls += 1;

  // Append log (keep last LOG_MAX entries)
  data.log.push(full);
  if (data.log.length > LOG_MAX) data.log = data.log.slice(-LOG_MAX);

  data.updatedAt = now.toISOString();
  saveUsage(userId, data);
}

/** Returns { blocked: true, reason } if over limit, else { blocked: false } */
export function checkLimits(
  userId: string,
  agentId: string,
  estimatedTokens = 1000
): { blocked: boolean; reason?: string } {
  const limits = loadLimits(userId);
  if (!limits.global && !limits.byAgent?.[agentId]) return { blocked: false };

  const usage = loadUsage(userId);
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const today = usage.todayDate === todayKey ? usage.today : { tokens: 0, costUsd: 0 };

  // Global daily limit
  if (limits.global?.dailyUsd && today.costUsd + estimateCost('default', estimatedTokens) > limits.global.dailyUsd) {
    return { blocked: true, reason: `Limite diário de $${limits.global.dailyUsd.toFixed(2)} atingido` };
  }
  // Global monthly limit
  if (limits.global?.monthlyUsd && usage.thisMonth.costUsd > limits.global.monthlyUsd) {
    return { blocked: true, reason: `Limite mensal de $${limits.global.monthlyUsd.toFixed(2)} atingido` };
  }
  // Per-agent daily limit
  const agentLimits = limits.byAgent?.[agentId];
  if (agentLimits) {
    const agentUsage = usage.byAgent[agentId];
    if (agentLimits.dailyTokens && agentUsage && agentUsage.tokens > agentLimits.dailyTokens) {
      return { blocked: true, reason: `Agente atingiu limite de ${agentLimits.dailyTokens.toLocaleString()} tokens/dia` };
    }
  }
  return { blocked: false };
}
