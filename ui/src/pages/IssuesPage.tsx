import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

// Converte markdown básico para HTML seguro (conteúdo interno, não user input externo)
function renderMd(raw: string): string {
  return raw
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*\*(.+?)\*\*\*/gs, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/`([^`\n]+)`/g, '<code style="background:rgba(146,48,249,0.12);color:#c084fc;padding:1px 5px;border-radius:4px;font-family:monospace;font-size:0.95em">$1</code>')
    .replace(/^#### (.+)$/gm, '<strong style="display:block;margin:8px 0 2px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted)">$1</strong>')
    .replace(/^### (.+)$/gm, '<strong style="display:block;margin:10px 0 3px;font-size:13px;color:var(--fg)">$1</strong>')
    .replace(/^## (.+)$/gm, '<strong style="display:block;margin:12px 0 4px;font-size:14px;color:var(--fg)">$1</strong>')
    .replace(/^# (.+)$/gm, '<strong style="display:block;margin:14px 0 6px;font-size:16px;color:var(--fg)">$1</strong>')
    .replace(/^[-*] (.+)$/gm, '<span style="display:block;padding-left:16px;position:relative"><span style="position:absolute;left:4px;color:var(--primary)">•</span>$1</span>')
    .replace(/^\d+\. (.+)$/gm, '<span style="display:block;padding-left:16px;position:relative"><span style="position:absolute;left:0;color:var(--primary)">$1.</span>$1</span>')
    .replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:10px 0"/>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

function MdBlock({ text, style }: { text: string; style?: React.CSSProperties }) {
  return (
    <div
      style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.9, ...style }}
      dangerouslySetInnerHTML={{ __html: renderMd(text) }}
    />
  );
}

type TarefaStatus = 'backlog' | 'todo' | 'em_progresso' | 'em_revisao' | 'concluido' | 'cancelado';
type TarefaPriority = 'critico' | 'alto' | 'medio' | 'baixo';

interface LogEntry { ts: string; msg: string; ok?: boolean; }

interface Tarefa {
  id: string;
  title: string;
  description: string;
  status: TarefaStatus;
  priority: TarefaPriority;
  assigneeAgentId?: string;
  assigneeAgentName?: string;
  createdByAgentName?: string;
  requiresApproval: boolean;
  approvalStatus?: 'pendente' | 'aprovado' | 'rejeitado';
  approvalType?: 'contratar' | 'foco' | 'geral';
  hireData?: { name: string; role: string; instructions: string; model: string };
  focusData?: { mission?: string; goals?: string[] };
  paused?: boolean;
  logs?: LogEntry[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  // campos extras para runs
  runId?: string;
  squadId?: string;
}

interface Agent { id: string; name: string; role: string; status: string; }

interface RunDetail {
  id: string;
  squadName: string;
  userRequest: string;
  status: string;
  currentStepId?: number;
  steps: { stepId: number; stepName: string; agentName: string; output: string; audioFile?: string; completedAt: string }[];
  checkpoint?: { stepId: number; description: string };
  userInputs: Record<number, string>;
  theme?: string;
  platform?: string;
  aspectRatio?: string;
  tone?: string;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

const BRIEFING_FIELDS: {
  key: string; label: string; type: 'select' | 'textarea' | 'text';
  options?: string[]; placeholder?: string;
}[] = [
  {
    key: 'plataforma', label: '1. Plataforma de destino', type: 'select',
    options: ['YouTube', 'Instagram Reels', 'TikTok', 'YouTube Shorts', 'Facebook', 'Twitter/X', 'Outra'],
  },
  {
    key: 'formato', label: '2. Formato de tela', type: 'select',
    options: ['16:9 (YouTube / Horizontal)', '9:16 (Reels / TikTok / Shorts)', '1:1 (Feed quadrado)', '4:5 (Instagram feed)', '4:3 (Clássico)'],
  },
  { key: 'tema', label: '3. Tema / História', type: 'textarea', placeholder: 'Descreva a história que quer contar...' },
  {
    key: 'tom', label: '4. Tom / Clima', type: 'select',
    options: ['Investigativo e sombrio', 'Misterioso', 'Nostálgico', 'Tenso e dramático', 'Emocional', 'Informativo / Didático', 'Humorístico'],
  },
  {
    key: 'duracao', label: '5. Duração', type: 'select',
    options: ['30s', '60s', '8min (mín. YouTube)', '15min', '20min', '30min+'],
  },
  { key: 'referencia', label: '6. Referência de estilo (opcional)', type: 'text', placeholder: 'Ex: True Detective, Canal Dark...' },
];

const STATUS_LABELS: Record<TarefaStatus, string> = {
  backlog: 'Pendente', todo: 'A fazer', em_progresso: 'Em progresso',
  em_revisao: 'Em revisão', concluido: 'Concluído', cancelado: 'Cancelado',
};
const STATUS_COLORS: Record<TarefaStatus, string> = {
  backlog: '#6b7280', todo: '#9230f9', em_progresso: '#f59e0b',
  em_revisao: '#3b82f6', concluido: '#10b981', cancelado: '#ef4444',
};
const PRIORITY_LABELS: Record<TarefaPriority, string> = {
  critico: '🔴 Crítico', alto: '🟠 Alto', medio: '🟡 Médio', baixo: '⚪ Baixo',
};

const FILTER_TABS = [
  { key: '', label: 'Todas' },
  { key: 'em_progresso', label: 'Em progresso' },
  { key: 'em_revisao', label: 'Em revisão' },
  { key: 'concluido', label: 'Concluídas' },
  { key: 'aprovacao', label: '⏳ Aprovações' },
  { key: 'reprovadas', label: '↩ Ajustes' },
  { key: 'todo', label: 'A fazer' },
  { key: 'backlog', label: 'Pendente' },
];

const RUN_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  queued:     { label: 'Na fila',         color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  running:    { label: '⚙ Executando',    color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  checkpoint: { label: '⏸ Aguarda você', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  completed:  { label: '✅ Concluída',    color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  failed:     { label: '❌ Falhou',       color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

function extractReprovalReason(logs?: LogEntry[]): string | null {
  if (!logs) return null;
  const entry = [...logs].reverse().find(l => l.msg.startsWith('❌ CEO reprovou:'));
  if (!entry) return null;
  return entry.msg.replace('❌ CEO reprovou:', '').replace('Tarefa reaberta para correção.', '').trim();
}

function lastLogMsg(logs?: LogEntry[]): string | null {
  if (!logs?.length) return null;
  return [...logs].reverse().find(l => l.msg.length > 5)?.msg || null;
}

// Remove o cabeçalho "BRIEFING RECEBIDO:" que o agente ecoa no início da resposta
function stripBriefingEcho(output: string): string {
  const sep = output.indexOf('\n---\n');
  if (sep !== -1) {
    const before = output.slice(0, sep);
    if (before.toUpperCase().includes('BRIEFING')) {
      return output.slice(sep + 5).trim();
    }
  }
  return output;
}

function formatTs(iso: string) {
  try { return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }); }
  catch { return iso; }
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }); }
  catch { return iso; }
}

const BLANK_FORM = {
  title: '', description: '', status: 'todo' as TarefaStatus,
  priority: 'medio' as TarefaPriority, assigneeAgentId: '',
  requiresApproval: false,
};

export function TarefasPage() {
  const navigate = useNavigate();
  const [issues, setTarefas] = useState<Tarefa[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  // modais
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [saving, setSaving] = useState(false);

  // detalhe de issue (log)
  const [detailIssue, setDetailIssue] = useState<Tarefa | null>(null);

  // detalhe de run
  const [detailRun, setDetailRun] = useState<RunDetail | null>(null);
  const [loadingRun, setLoadingRun] = useState(false);
  const [checkpointDecision, setCheckpointDecision] = useState('');
  const [submittingCp, setSubmittingCp] = useState(false);
  const [briefFields, setBriefFields] = useState<Record<string, string>>({});

  const [rejectModal, setRejectModal] = useState<{ id: string; title: string } | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [approving, setApproving] = useState<string | null>(null);
  const [videoModal, setVideoModal] = useState<string | null>(null);
  const [loadingVideo, setLoadingVideo] = useState<string | null>(null);

  async function load() {
    const [list, agList] = await Promise.all([
      api.get<Tarefa[]>('/issues').catch(() => []),
      api.get<Agent[]>('/enterprise/agents').catch(() => []),
    ]);
    setTarefas(list || []);
    setAgents(((agList as Agent[]) || []).filter(a => a.status === 'active'));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function openRunDetail(issue: Tarefa) {
    const runId = issue.runId || issue.id.replace('run:', '');
    setLoadingRun(true);
    setDetailRun(null);
    setCheckpointDecision('');
    setBriefFields({});
    try {
      const run = await api.get<RunDetail>(`/runs/${runId}`);
      setDetailRun(run);
    } catch {
      setDetailRun(null);
    }
    setLoadingRun(false);
  }

  function openDetail(issue: Tarefa) {
    const isRun = issue.id.startsWith('run:') || !!issue.runId;
    if (isRun) {
      openRunDetail(issue);
    } else {
      setDetailIssue(issue);
    }
  }

  async function refreshRun() {
    if (!detailRun) return;
    const run = await api.get<RunDetail>(`/runs/${detailRun.id}`).catch(() => null);
    if (run) setDetailRun(run);
  }

  async function submitCheckpoint() {
    if (!detailRun || !checkpointDecision.trim()) return;
    setSubmittingCp(true);
    try {
      await api.post(`/runs/${detailRun.id}/checkpoint`, { decision: checkpointDecision.trim() });
      setCheckpointDecision('');
      setBriefFields({});
      await refreshRun();
      await load();
    } catch {}
    setSubmittingCp(false);
  }

  function openNew() { setEditingId(null); setForm({ ...BLANK_FORM }); setShowForm(true); }
  function openEdit(issue: Tarefa) {
    setEditingId(issue.id);
    setForm({ title: issue.title, description: issue.description, status: issue.status,
      priority: issue.priority, assigneeAgentId: issue.assigneeAgentId || '', requiresApproval: issue.requiresApproval });
    setShowForm(true);
  }

  async function save() {
    if (!form.title) return;
    setSaving(true);
    try {
      const agent = agents.find(a => a.id === form.assigneeAgentId);
      const payload = { ...form, assigneeAgentName: agent?.name };
      if (editingId) await api.put(`/issues/${editingId}`, payload);
      else await api.post('/issues', payload);
      await load();
      setShowForm(false);
    } finally { setSaving(false); }
  }

  async function updateStatus(id: string, status: TarefaStatus) {
    await api.put(`/issues/${id}`, { status }).catch(() => {});
    setTarefas(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  }

  async function remove(id: string) {
    if (!confirm('Deletar esta issue?')) return;
    await api.delete(`/issues/${id}`).catch(() => {});
    setTarefas(prev => prev.filter(i => i.id !== id));
  }

  async function togglePause(id: string) {
    const updated = await api.post<Tarefa>(`/issues/${id}/pause`, {}).catch(() => null);
    if (updated) setTarefas(prev => prev.map(i => i.id === id ? updated : i));
  }

  async function approve(id: string) {
    setApproving(id);
    try {
      const updated = await api.post<Tarefa>(`/issues/${id}/approve`, {});
      setTarefas(prev => prev.map(i => i.id === id ? updated : i));
      await load();
    } catch (e: any) { alert('Erro ao aprovar: ' + e.message); }
    finally { setApproving(null); }
  }

  async function reject(id: string) {
    setApproving(id);
    try {
      const updated = await api.post<Tarefa>(`/issues/${id}/reject`, { note: rejectNote });
      setTarefas(prev => prev.map(i => i.id === id ? updated : i));
      setRejectModal(null); setRejectNote('');
    } catch (e: any) { alert('Erro ao rejeitar: ' + e.message); }
    finally { setApproving(null); }
  }

  const pendingApprovals = issues.filter(i => i.requiresApproval && i.approvalStatus === 'pendente' && !i.id.startsWith('run:'));
  const checkpointRuns  = issues.filter(i => i.id.startsWith('run:') && i.requiresApproval && i.approvalStatus === 'pendente');
  const reproved        = issues.filter(i => i.status === 'todo' && extractReprovalReason(i.logs) !== null);

  const displayed = (() => {
    if (filter === 'aprovacao') return pendingApprovals;
    if (filter === 'reprovadas') return reproved;
    if (filter) return issues.filter(i => i.status === filter);
    return issues;
  })();

  // ── card de run ─────────────────────────────────────────────────────────────
  function RunCard({ issue }: { issue: Tarefa }) {
    const runId = issue.runId || issue.id.replace('run:', '');
    const isCheckpoint = issue.requiresApproval && issue.approvalStatus === 'pendente';
    const isCompleted  = issue.status === 'concluido';
    const isFailed     = issue.status === 'cancelado';
    const isRunning    = issue.status === 'em_progresso';

    const rawStatus = isCheckpoint ? 'checkpoint' : isCompleted ? 'completed' : isFailed ? 'failed' : isRunning ? 'running' : 'queued';
    const si = RUN_STATUS[rawStatus] || RUN_STATUS.queued;

    return (
      <div
        onClick={() => openDetail(issue)}
        style={{
          display: 'flex', alignItems: 'stretch', borderRadius: 10,
          border: `1px solid ${isCheckpoint ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`,
          background: 'var(--bg-2)', cursor: 'pointer', overflow: 'hidden',
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-3)'}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-2)'}
      >
        {/* barra lateral colorida */}
        <div style={{ width: 4, flexShrink: 0, background: si.color, borderRadius: '0 0 0 0' }} />

        <div style={{ flex: 1, padding: '12px 16px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 10, color: si.color, background: si.bg }}>
              {si.label}
            </span>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>
              {issue.title.replace(/^\[.*?\]\s*/, '').split('')[0]?.toUpperCase() || ''}
              {(() => {
                const m = issue.title.match(/^\[([^\]]+)\]/);
                return m ? <span style={{ color: 'var(--primary)' }}>▶ {m[1]}</span> : null;
              })()}
            </span>
          </div>

          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {issue.description || issue.title}
          </div>

          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)', flexWrap: 'wrap', alignItems: 'center' }}>
            <span>📅 {formatDate(issue.createdAt)}</span>
            {issue.updatedAt !== issue.createdAt && (
              <span>⏱ {formatTs(issue.updatedAt)}</span>
            )}
            {isCheckpoint && (
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>⚡ Clique para responder o checkpoint</span>
            )}
            {isCompleted && (
              <span style={{ color: '#10b981' }}>Pipeline concluído — clique para baixar</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', color: 'var(--muted)', fontSize: 18 }}>›</div>
      </div>
    );
  }

  // ── card de issue normal ────────────────────────────────────────────────────
  function IssueCard({ issue }: { issue: Tarefa }) {
    const reprovalReason  = extractReprovalReason(issue.logs);
    const isReproved      = reprovalReason !== null && issue.status === 'todo';
    const isPendingApproval = issue.requiresApproval && issue.approvalStatus === 'pendente';
    const lastLog         = lastLogMsg(issue.logs);
    const color           = isReproved ? '#ef4444' : STATUS_COLORS[issue.status];

    return (
      <div
        onClick={() => openDetail(issue)}
        style={{
          display: 'flex', alignItems: 'stretch', borderRadius: 10,
          border: `1px solid ${isPendingApproval ? 'rgba(146,48,249,0.35)' : isReproved ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
          background: isPendingApproval ? 'rgba(146,48,249,0.04)' : 'var(--bg-2)',
          cursor: 'pointer', overflow: 'hidden', transition: 'background 0.15s',
          opacity: issue.paused ? 0.65 : 1,
        }}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-3)'}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = isPendingApproval ? 'rgba(146,48,249,0.04)' : 'var(--bg-2)'}
      >
        <div style={{ width: 4, flexShrink: 0, background: color }} />

        <div style={{ flex: 1, padding: '11px 16px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {issue.paused && <span style={{ fontSize: 10, color: '#f59e0b' }}>⏸</span>}
            {isReproved && <span style={{ fontSize: 10, color: '#ef4444' }}>↩</span>}
            {isPendingApproval && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'rgba(146,48,249,0.15)', color: 'var(--primary)', fontWeight: 700 }}>⏳ Aprovação</span>}
            <span style={{ fontWeight: 600, fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {issue.title}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8, color, background: color + '18', flexShrink: 0 }}>
              {STATUS_LABELS[issue.status]}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--muted)', flexWrap: 'wrap', alignItems: 'center' }}>
            <span>{PRIORITY_LABELS[issue.priority]}</span>
            {issue.assigneeAgentName && (
              <span style={{ color: 'var(--primary)' }}>→ {issue.assigneeAgentName}</span>
            )}
            {issue.logs && issue.logs.length > 0 && (
              <span style={{ fontFamily: 'monospace' }}>[{issue.logs.length} logs]</span>
            )}
            <span style={{ marginLeft: 'auto' }}>📅 {formatDate(issue.updatedAt || issue.createdAt)}</span>
          </div>

          {isReproved && reprovalReason && (
            <div style={{ marginTop: 6, padding: '5px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.07)', fontSize: 11, color: '#ef4444' }}>
              ↩ {reprovalReason.slice(0, 180)}{reprovalReason.length > 180 ? '…' : ''}
            </div>
          )}
          {!isReproved && lastLog && issue.status === 'em_progresso' && (
            <div style={{ marginTop: 5, fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              💬 {lastLog.slice(0, 120)}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', color: 'var(--muted)', fontSize: 18 }}>›</div>
      </div>
    );
  }

  const isBriefing = detailRun?.checkpoint?.stepId === 0;

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">Tarefas & Pipelines</h1>
            <p className="page-subtitle">Acompanhe tudo que está acontecendo com seus agentes e equipes.</p>
          </div>
          <button onClick={openNew}>+ Nova Tarefa</button>
        </div>
      </div>

      {/* Banners de alerta */}
      {checkpointRuns.length > 0 && (
        <div style={{ padding: '10px 16px', marginBottom: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>⏸</span>
          <span style={{ fontSize: 13, flex: 1 }}>
            <strong>{checkpointRuns.length}</strong> {checkpointRuns.length === 1 ? 'pipeline aguarda' : 'pipelines aguardam'} sua decisão
          </span>
          <button style={{ fontSize: 12, padding: '4px 12px', background: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.4)', color: '#f59e0b' }}
            onClick={() => setFilter('em_revisao')}>
            Ver checkpoint →
          </button>
        </div>
      )}
      {pendingApprovals.length > 0 && (
        <div style={{ padding: '10px 16px', marginBottom: 12, background: 'rgba(146,48,249,0.07)', border: '1px solid rgba(146,48,249,0.25)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>⏳</span>
          <span style={{ fontSize: 13, flex: 1 }}>
            <strong>{pendingApprovals.length}</strong> {pendingApprovals.length === 1 ? 'solicitação aguarda' : 'solicitações aguardam'} sua aprovação
          </span>
          <button style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => setFilter('aprovacao')}>Ver →</button>
        </div>
      )}
      {reproved.length > 0 && filter !== 'reprovadas' && (
        <div style={{ padding: '10px 16px', marginBottom: 12, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16 }}>↩</span>
          <span style={{ fontSize: 13, flex: 1 }}>
            <strong>{reproved.length}</strong> {reproved.length === 1 ? 'tarefa foi reprovada' : 'tarefas foram reprovadas'} pelo CEO e aguardam correção
          </span>
          <button style={{ fontSize: 12, padding: '4px 12px', background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}
            onClick={() => setFilter('reprovadas')}>Ver ajustes →</button>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {FILTER_TABS.map(t => {
          const count = t.key === 'aprovacao' ? pendingApprovals.length
            : t.key === 'reprovadas' ? reproved.length
            : t.key === '' ? issues.length
            : issues.filter(i => i.status === t.key).length;
          return (
            <button key={t.key} onClick={() => setFilter(t.key)}
              className={filter === t.key ? '' : 'ghost'}
              style={{ fontSize: 12, padding: '5px 12px' }}>
              {t.label} <span style={{ marginLeft: 5, opacity: 0.6 }}>{count}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', padding: 32, textAlign: 'center' }}>Carregando...</div>
      ) : displayed.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            {filter === 'aprovacao' ? 'Nenhuma solicitação pendente.' : filter ? 'Nenhuma tarefa com este filtro.' : 'Nenhuma tarefa ainda.'}
          </p>
          {!filter && <button style={{ marginTop: 14 }} onClick={openNew}>Criar primeira tarefa</button>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {displayed.map(issue => {
            const isRun = issue.id.startsWith('run:') || !!issue.runId;
            return isRun
              ? <RunCard key={issue.id} issue={issue} />
              : <IssueCard key={issue.id} issue={issue} />;
          })}
        </div>
      )}

      {/* ── MODAL DETALHE DE RUN ──────────────────────────────────────────── */}
      {(loadingRun || detailRun) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setDetailRun(null); }}>
          <div className="card" style={{ width: '100%', maxWidth: 700, padding: 28, maxHeight: '92vh', overflowY: 'auto', borderRadius: 14 }}>
            {loadingRun ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>Carregando detalhes...</div>
            ) : detailRun && (
              <>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                      ▶ Pipeline — {detailRun.squadName}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
                      {detailRun.userRequest || 'Run'}
                    </div>
                    {/* Briefing metadata */}
                    {(detailRun.theme || detailRun.platform) && (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
                        {detailRun.theme && <span style={{ padding: '2px 8px', borderRadius: 8, background: 'rgba(146,48,249,0.12)', color: 'var(--primary)' }}>🎯 {detailRun.theme.slice(0, 60)}</span>}
                        {detailRun.platform && <span style={{ padding: '2px 8px', borderRadius: 8, background: 'var(--bg-3)', color: 'var(--fg-2)' }}>📺 {detailRun.platform}</span>}
                        {detailRun.aspectRatio && <span style={{ padding: '2px 8px', borderRadius: 8, background: 'var(--bg-3)', color: 'var(--fg-2)' }}>📐 {detailRun.aspectRatio}</span>}
                        {detailRun.tone && <span style={{ padding: '2px 8px', borderRadius: 8, background: 'var(--bg-3)', color: 'var(--fg-2)' }}>🎭 {detailRun.tone}</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, marginLeft: 12 }}>
                    <button className="ghost" style={{ fontSize: 11, padding: '5px 10px' }} onClick={refreshRun}>↻</button>
                    {detailRun.status === 'completed' && (
                      <>
                        <button className="ghost" style={{ fontSize: 11, padding: '5px 12px', fontWeight: 600, color: '#a78bfa', borderColor: 'rgba(167,139,250,0.4)' }}
                          disabled={loadingVideo === detailRun.id}
                          onClick={async () => {
                            setLoadingVideo(detailRun.id);
                            try {
                              const url = await api.fetchVideoUrl(detailRun.id);
                              setVideoModal(url);
                            } catch (e: any) {
                              alert(e.message);
                            } finally {
                              setLoadingVideo(null);
                            }
                          }}>
                          {loadingVideo === detailRun.id ? '⏳...' : '▶ Assistir vídeo'}
                        </button>
                        <button className="ghost" style={{ fontSize: 11, padding: '5px 12px', fontWeight: 600 }}
                          onClick={() => api.downloadRun(detailRun.id).catch(e => alert('Erro: ' + e.message))}>
                          ⬇ Baixar tudo (.md)
                        </button>
                      </>
                    )}
                    <button className="ghost" style={{ fontSize: 18, padding: '2px 8px' }} onClick={() => setDetailRun(null)}>×</button>
                  </div>
                </div>

                {/* Status */}
                {(() => {
                  const si = RUN_STATUS[detailRun.status] || RUN_STATUS.queued;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, padding: '8px 14px', borderRadius: 8, background: si.bg, border: `1px solid ${si.color}44` }}>
                      <span style={{ fontWeight: 700, fontSize: 12, color: si.color }}>{si.label}</span>
                      {detailRun.status === 'running' && (
                        <span style={{ fontSize: 12, color: si.color }}>— Step {detailRun.currentStepId} em execução...</span>
                      )}
                      {detailRun.status === 'completed' && detailRun.completedAt && (
                        <span style={{ fontSize: 12, color: si.color }}>em {formatTs(detailRun.completedAt)}</span>
                      )}
                      {detailRun.status === 'failed' && detailRun.error && (
                        <span style={{ fontSize: 12, color: si.color }}>{detailRun.error.slice(0, 100)}</span>
                      )}
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>
                        {detailRun.steps.length} step{detailRun.steps.length !== 1 ? 's' : ''} concluído{detailRun.steps.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  );
                })()}

                {/* Checkpoint — decisão */}
                {detailRun.status === 'checkpoint' && detailRun.checkpoint && (
                  <div style={{ borderRadius: 10, border: '2px solid rgba(245,158,11,0.4)', overflow: 'hidden', marginBottom: 20 }}>
                    <div style={{ padding: '12px 18px', background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>⏸</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#f59e0b' }}>Checkpoint — sua decisão é necessária</div>
                        <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 2 }}>{detailRun.checkpoint.description}</div>
                      </div>
                    </div>

                    {/* Briefing form */}
                    {isBriefing && (
                      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
                          📝 Briefing do vídeo
                        </div>
                        {BRIEFING_FIELDS.map(field => {
                          const updateDecision = (newVal: string) => {
                            const updated = { ...briefFields, [field.key]: newVal };
                            setBriefFields(updated);
                            const parts = BRIEFING_FIELDS
                              .map(f => updated[f.key]?.trim() ? `${f.key.toUpperCase()}: ${updated[f.key].trim()}` : null)
                              .filter(Boolean);
                            setCheckpointDecision(parts.join('\n'));
                          };
                          return (
                            <div key={field.key} style={{ marginBottom: 10 }}>
                              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', display: 'block', marginBottom: 4 }}>{field.label}</label>
                              {field.type === 'select' ? (
                                <select value={briefFields[field.key] || ''} onChange={e => updateDecision(e.target.value)}
                                  style={{ width: '100%', fontSize: 13, padding: '7px 10px' }}>
                                  <option value="">— Selecionar —</option>
                                  {field.options!.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                              ) : field.type === 'textarea' ? (
                                <textarea value={briefFields[field.key] || ''} onChange={e => updateDecision(e.target.value)}
                                  placeholder={field.placeholder} rows={3} style={{ width: '100%', fontSize: 13, padding: '7px 10px', resize: 'vertical' }} />
                              ) : (
                                <input value={briefFields[field.key] || ''} onChange={e => updateDecision(e.target.value)}
                                  placeholder={field.placeholder} style={{ width: '100%', fontSize: 13, padding: '7px 10px' }} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Opções do step anterior */}
                    {!isBriefing && detailRun.steps.length > 0 && (
                      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(245,158,11,0.2)', maxHeight: 320, overflowY: 'auto' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                          📋 Resultado do step anterior — {detailRun.steps[detailRun.steps.length - 1]?.stepName}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--fg-2)', whiteSpace: 'pre-wrap', lineHeight: 1.8, background: 'var(--bg-3)', borderRadius: 8, padding: '10px 14px' }}>
                          {stripBriefingEcho(detailRun.steps[detailRun.steps.length - 1]?.output || '')}
                        </div>
                      </div>
                    )}

                    <div style={{ padding: '14px 18px' }}>
                      {!isBriefing && (
                        <textarea value={checkpointDecision} onChange={e => setCheckpointDecision(e.target.value)}
                          placeholder="Escreva sua decisão ou escolha baseado no resultado acima..."
                          rows={3} style={{ width: '100%', fontSize: 13, marginBottom: 10, resize: 'vertical' }} />
                      )}
                      <button onClick={submitCheckpoint}
                        disabled={!checkpointDecision.trim() || submittingCp}
                        style={{ width: '100%', padding: '10px 0', fontWeight: 700, background: '#f59e0b', color: '#000', border: 'none' }}>
                        {submittingCp ? 'Enviando...' : '▶ Confirmar e continuar pipeline'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Timeline de steps concluídos */}
                {detailRun.steps.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
                      ✅ Steps concluídos ({detailRun.steps.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {detailRun.steps.map((step) => (
                        <details key={step.stepId} style={{ borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                          <summary style={{
                            padding: '12px 16px', background: 'var(--bg-3)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 10, listStyle: 'none', userSelect: 'none',
                          }}>
                            <div style={{
                              width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                              background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 800, color: '#10b981',
                            }}>
                              {step.stepId}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>{step.stepName}</div>
                              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                                🤖 {step.agentName} · ⏱ {new Date(step.completedAt).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                                {step.audioFile && <span style={{ marginLeft: 8, color: '#f59e0b' }}>🎙 áudio gerado</span>}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.preventDefault()}>
                              <button className="ghost" style={{ fontSize: 10, padding: '2px 7px' }}
                                onClick={() => api.downloadStepTxt(detailRun.id, step.stepId, step.stepName).catch(() => {})}>
                                📄 .txt
                              </button>
                              {step.audioFile && (
                                <button className="ghost" style={{ fontSize: 10, padding: '2px 7px', color: '#f59e0b' }}
                                  onClick={() => api.downloadAudio(detailRun.id, step.stepId).catch(() => {})}>
                                  🎙 .mp3
                                </button>
                              )}
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>▼</span>
                          </summary>
                          <div style={{
                            padding: '16px 18px', background: 'var(--bg-2)',
                            borderTop: '1px solid var(--border)',
                            maxHeight: 500, overflowY: 'auto',
                          }}>
                            <div style={{ fontSize: 12, color: 'var(--fg-2)', whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                              {stripBriefingEcho(step.output || '(sem output)')}
                            </div>
                          </div>
                        </details>
                      ))}
                    </div>
                  </div>
                )}

                {detailRun.steps.length === 0 && detailRun.status !== 'checkpoint' && (
                  <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)', fontSize: 13 }}>
                    {detailRun.status === 'queued' ? '⏳ Pipeline na fila...' : '🚀 Pipeline iniciando...'}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL DETALHE DE ISSUE NORMAL ────────────────────────────────── */}
      {detailIssue && (
        <div className="modal-overlay" onClick={() => setDetailIssue(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 660, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{detailIssue.title}</span>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, fontWeight: 700, color: STATUS_COLORS[detailIssue.status], background: STATUS_COLORS[detailIssue.status] + '18' }}>
                    {STATUS_LABELS[detailIssue.status]}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span>{PRIORITY_LABELS[detailIssue.priority]}</span>
                  {detailIssue.assigneeAgentName && <span style={{ color: 'var(--primary)' }}>→ {detailIssue.assigneeAgentName}</span>}
                  {detailIssue.createdByAgentName && <span>por {detailIssue.createdByAgentName}</span>}
                  <span>{formatTs(detailIssue.createdAt)}</span>
                </div>
              </div>
              <button className="ghost" style={{ padding: '4px 10px', fontSize: 14, flexShrink: 0 }} onClick={() => setDetailIssue(null)}>✕</button>
            </div>

            {/* Campos de aprovação */}
            {detailIssue.approvalType === 'contratar' && detailIssue.hireData && (
              <div style={{ padding: '10px 14px', marginBottom: 12, borderRadius: 8, background: 'var(--bg-3)', fontSize: 12, lineHeight: 1.8 }}>
                <strong>🤝 Solicitação de contratação</strong><br />
                <strong>Cargo:</strong> {detailIssue.hireData.role}<br />
                <strong>Modelo:</strong> {detailIssue.hireData.model}<br />
                {detailIssue.hireData.instructions && <><strong>Instruções:</strong> {detailIssue.hireData.instructions}</>}
              </div>
            )}
            {detailIssue.approvalType === 'foco' && detailIssue.focusData && (
              <div style={{ padding: '10px 14px', marginBottom: 12, borderRadius: 8, background: 'var(--bg-3)', fontSize: 12, lineHeight: 1.8 }}>
                <strong>💡 Mudança de foco</strong><br />
                {detailIssue.focusData.mission && <><strong>Nova missão:</strong> {detailIssue.focusData.mission}<br /></>}
                {detailIssue.focusData.goals?.length ? <><strong>Novos objetivos:</strong> {detailIssue.focusData.goals.join('; ')}</> : null}
              </div>
            )}

            {/* 📋 Briefing — instrução que o CEO enviou ao agente */}
            {detailIssue.description && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                  📋 Briefing da tarefa
                  <span style={{ marginLeft: 8, fontWeight: 400, fontSize: 9, textTransform: 'none', letterSpacing: 0, color: 'var(--muted)' }}>
                    — o que o CEO pediu ao agente
                  </span>
                </div>
                <div style={{ padding: '12px 14px', background: 'var(--bg-3)', borderRadius: 8, maxHeight: 260, overflowY: 'auto' }}>
                  <MdBlock text={detailIssue.description} />
                </div>
              </div>
            )}

            {/* 🤖 Resultado — o que o agente produziu */}
            {(() => {
              const agentLogs = (detailIssue.logs || []).filter(e => e.msg.length > 250);
              if (!agentLogs.length) return null;
              const main = agentLogs[agentLogs.length - 1];
              // Remove prefixo "NomeAgente: " se existir
              const body = main.msg.replace(/^[^:\n]{3,80}:\s*/, '');
              return (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                    🤖 Resultado do agente
                    <span style={{ marginLeft: 8, fontWeight: 400, fontSize: 9, textTransform: 'none', letterSpacing: 0, color: 'var(--muted)' }}>
                      — o que o agente entregou
                    </span>
                  </div>
                  <div style={{ padding: '12px 14px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, maxHeight: 340, overflowY: 'auto' }}>
                    <MdBlock text={body} />
                  </div>
                </div>
              );
            })()}

            {/* Links para squad/run relacionados */}
            {(detailIssue.squadId || detailIssue.runId) && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {detailIssue.squadId && (
                  <button className="ghost" style={{ fontSize: 11, padding: '3px 10px' }}
                    onClick={() => { setDetailIssue(null); navigate(`/squads/${detailIssue.squadId}`); }}>
                    🏛 Ver equipe →
                  </button>
                )}
                {detailIssue.runId && (
                  <button className="ghost" style={{ fontSize: 11, padding: '3px 10px', color: 'var(--primary)' }}
                    onClick={() => openRunDetail(detailIssue)}>
                    ▶ Abrir pipeline da run →
                  </button>
                )}
              </div>
            )}

            {/* Status selector inline */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>Status:</span>
              <select value={detailIssue.status}
                onChange={e => { updateStatus(detailIssue.id, e.target.value as TarefaStatus); setDetailIssue(d => d ? { ...d, status: e.target.value as TarefaStatus } : null); }}
                style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6 }}>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button className="ghost" style={{ fontSize: 11, padding: '4px 10px', color: detailIssue.paused ? '#f59e0b' : 'var(--muted)' }}
                onClick={() => togglePause(detailIssue.id)}>
                {detailIssue.paused ? '▶ Retomar' : '⏸ Pausar'}
              </button>
              <button className="ghost" style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => { setDetailIssue(null); openEdit(detailIssue); }}>✏️ Editar</button>
              <button className="ghost" style={{ fontSize: 11, padding: '4px 10px', color: 'var(--danger)' }}
                onClick={() => { remove(detailIssue.id); setDetailIssue(null); }}>🗑 Excluir</button>
            </div>

            {/* 📊 Log de status — eventos técnicos curtos */}
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                📊 Log de execução
              </div>
              <div style={{ overflowY: 'auto', maxHeight: 160, background: '#09091a', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                {!detailIssue.logs?.length ? (
                  <span style={{ color: '#555' }}>// sem eventos registrados</span>
                ) : detailIssue.logs.map((entry, i) => {
                  // Eventos curtos = status; eventos longos = resposta do agente (já mostrada acima)
                  const short = entry.msg.length <= 250 ? entry.msg : entry.msg.slice(0, 120).replace(/\*\*/g, '') + '… [ver Resultado acima]';
                  return (
                    <div key={i} style={{ marginBottom: 4, lineHeight: 1.6 }}>
                      <span style={{ color: '#555', marginRight: 8 }}>{formatTs(entry.ts)}</span>
                      <span style={{ color: entry.ok === false ? '#ef4444' : '#10b981', marginRight: 6 }}>
                        {entry.ok === false ? '✗' : '✓'}
                      </span>
                      <span style={{ color: entry.msg.length > 250 ? '#666' : '#e2e8f0', fontStyle: entry.msg.length > 250 ? 'italic' : 'normal' }}>
                        {short}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ações de aprovação */}
            {detailIssue.requiresApproval && detailIssue.approvalStatus === 'pendente' && (
              <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                <button style={{ flex: 1, fontSize: 13, background: 'rgba(0,188,138,0.15)', borderColor: 'var(--secondary)', color: 'var(--secondary)' }}
                  onClick={() => { approve(detailIssue.id); setDetailIssue(null); }} disabled={approving === detailIssue.id}>
                  ✅ Aprovar
                </button>
                <button className="ghost" style={{ flex: 1, fontSize: 13, color: 'var(--danger)', borderColor: 'rgba(244,63,94,0.4)' }}
                  onClick={() => { setRejectModal({ id: detailIssue.id, title: detailIssue.title }); setDetailIssue(null); }}>
                  ❌ Rejeitar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal criar/editar */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 520 }}>
            <h2 style={{ marginBottom: 16 }}>{editingId ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
            <div className="form-group">
              <label>Título *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="O que precisa ser feito?" autoFocus />
            </div>
            <div className="form-group">
              <label>Descrição</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Contexto adicional..." rows={3} style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as TarefaStatus }))}>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Prioridade</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as TarefaPriority }))}>
                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Atribuir a (agente)</label>
              <select value={form.assigneeAgentId} onChange={e => setForm(f => ({ ...f, assigneeAgentId: e.target.value }))}>
                <option value="">— Sem atribuição —</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 20 }}>
              <input type="checkbox" checked={form.requiresApproval} onChange={e => setForm(f => ({ ...f, requiresApproval: e.target.checked }))} />
              Requer aprovação antes de iniciar
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="ghost" onClick={() => setShowForm(false)}>Cancelar</button>
              <button onClick={save} disabled={!form.title || saving}>{saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar Tarefa'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal rejeitar */}
      {videoModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => { URL.revokeObjectURL(videoModal); setVideoModal(null); }}>
          <div style={{ width: '100%', maxWidth: 960, display: 'flex', flexDirection: 'column', gap: 12 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>▶ Vídeo gerado</span>
              <button className="ghost" style={{ color: '#fff', fontSize: 22, padding: '2px 10px' }}
                onClick={() => { URL.revokeObjectURL(videoModal); setVideoModal(null); }}>×</button>
            </div>
            <video src={videoModal} controls autoPlay style={{ width: '100%', borderRadius: 12, background: '#000', maxHeight: '80vh' }} />
          </div>
        </div>
      )}

      {rejectModal && (
        <div className="modal-overlay" onClick={() => setRejectModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 420 }}>
            <h2 style={{ fontSize: 15, marginBottom: 12 }}>Rejeitar: {rejectModal.title}</h2>
            <div className="form-group">
              <label>Motivo (opcional)</label>
              <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                placeholder="Por que está rejeitando?" rows={3} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="ghost" onClick={() => setRejectModal(null)}>Cancelar</button>
              <button style={{ background: 'rgba(244,63,94,0.15)', borderColor: 'rgba(244,63,94,0.4)', color: 'var(--danger)' }}
                onClick={() => reject(rejectModal.id)} disabled={approving !== null}>
                ❌ Confirmar rejeição
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
