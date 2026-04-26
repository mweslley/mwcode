import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Skill {
  id: string;
  name: string;
  description: string;
  prompt: string;
  tools?: string[];
  model?: string;
  createdAt: string;
}

/**
 * Templates prontos pra criar skill com 1 clique.
 * Inspirados em casos de uso comuns.
 */
const TEMPLATES: Array<Omit<Skill, 'id' | 'createdAt'>> = [
  {
    name: 'Revisor de código',
    description: 'Revisa código apontando bugs, problemas de performance e melhorias.',
    prompt:
      'Você é um engenheiro de software sênior. Revise o código abaixo e aponte: ' +
      '1) bugs e erros lógicos, 2) problemas de performance, 3) violações de boas práticas, ' +
      '4) sugestões de refatoração. Seja específico, mostre as linhas e dê exemplos.',
    tools: ['code'],
  },
  {
    name: 'Copywriter Instagram',
    description: 'Cria legendas otimizadas para Instagram com hashtags e CTA.',
    prompt:
      'Você é uma copywriter especialista em Instagram para o mercado brasileiro. ' +
      'Crie uma legenda envolvente, com gancho na primeira linha, corpo explicativo, ' +
      'CTA claro e até 5 hashtags estratégicas (mix de alcance e nicho). ' +
      'Tom: próximo, autêntico, sem jargão excessivo.',
    tools: ['social'],
  },
  {
    name: 'Tradutor PT ↔ EN',
    description: 'Traduz textos preservando tom, contexto e regionalismos.',
    prompt:
      'Você é tradutor profissional PT-BR ↔ EN. Detecte o idioma do texto e traduza ' +
      'pro outro preservando: tom, formalidade, contexto e regionalismos. ' +
      'Se houver expressões idiomáticas, adapte. Devolva só a tradução.',
  },
  {
    name: 'Analista de dados',
    description: 'Analisa dados, gera insights e propõe ações.',
    prompt:
      'Você é analista de dados experiente. Dado um conjunto de dados ou métricas, ' +
      '1) identifique padrões e anomalias, 2) calcule estatísticas relevantes, ' +
      '3) explique o que isso significa pro negócio, 4) sugira 3 ações práticas. ' +
      'Use linguagem clara, evite jargão técnico.',
  },
  {
    name: 'Suporte ao cliente',
    description: 'Atende clientes com empatia e resolve problemas comuns.',
    prompt:
      'Você é um atendente de suporte ao cliente experiente e empático. ' +
      'Cumprimente, escute o problema, faça perguntas pra entender, ' +
      'proponha solução clara e objetiva. Use português brasileiro acolhedor, ' +
      'sem ser robótico. Se não souber, encaminhe pra alguém que saiba.',
  },
  {
    name: 'Estrategista de marketing',
    description: 'Cria estratégias de marketing baseadas em objetivos do negócio.',
    prompt:
      'Você é estrategista de marketing digital sênior. Dado um objetivo de negócio, ' +
      'proponha estratégia com: público-alvo, canais (orgânico/pago), conteúdo, ' +
      'KPIs mensuráveis e cronograma de 30 dias. Foco em ROI mensurável.',
  },
];

export function Skills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Skill | 'new' | null>(null);
  // Skill padrão: aplicada automaticamente em novos chats.
  // Guardada em localStorage (não vai pro backend, é por dispositivo).
  const [skillPadrao, setSkillPadrao] = useState<string | null>(
    localStorage.getItem('skillPadrao')
  );

  function definirPadrao(id: string | null) {
    if (id) localStorage.setItem('skillPadrao', id);
    else localStorage.removeItem('skillPadrao');
    setSkillPadrao(id);
  }

  async function load() {
    setLoading(true);
    try {
      const list = await api.get<Skill[]>('/skills');
      setSkills(list || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function criarDeTemplate(t: typeof TEMPLATES[0]) {
    try {
      await api.post('/skills', t);
      await load();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    }
  }

  async function deletar(id: string) {
    if (!confirm('Deletar essa skill?')) return;
    await api.delete(`/skills/${id}`);
    await load();
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Skills</h1>
            <p className="page-subtitle">Personalidades e funções que você aplica em conversas. Crie, edite e use via site ou CLI.</p>
          </div>
          <button onClick={() => setEditing('new')}>+ Nova skill</button>
        </div>
      </div>

      {/* CLI Info */}
      <div className="card" style={{ marginBottom: 20, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>⌨️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>Via linha de comando (skills.sh)</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace' }}>
              skills.sh list &nbsp;|&nbsp; skills.sh use "nome" &nbsp;|&nbsp; skills.sh add "nome" "prompt"
            </div>
          </div>
          <button
            className="ghost"
            style={{ fontSize: 11, padding: '4px 10px' }}
            onClick={() => {
              navigator.clipboard.writeText(
                'curl -fsSL https://raw.githubusercontent.com/mweslley/mwcode/main/scripts/skills.sh | bash'
              );
              alert('Comando copiado!');
            }}
          >
            📋 Copiar instalação
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Carregando...</p>
      ) : (
        <>
          {skills.length === 0 ? (
            <div
              style={{
                padding: 24,
                border: '1px dashed var(--border)',
                borderRadius: 12,
                textAlign: 'center',
                marginBottom: 32,
                color: 'var(--muted)',
              }}
            >
              <p>Você ainda não tem skills. Comece com um template abaixo 👇</p>
            </div>
          ) : (
            <div className="agents-grid" style={{ marginBottom: 32 }}>
              {skills.map((s) => {
                const ehPadrao = skillPadrao === s.id;
                return (
                  <div key={s.id} className={`card ${ehPadrao ? 'is-default' : ''}`}>
                    {ehPadrao && (
                      <span className="skill-badge-default">⭐ Padrão</span>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ margin: 0 }}>{s.name}</h3>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="ghost"
                          onClick={() => setEditing(s)}
                          style={{ padding: '4px 8px', fontSize: 12 }}
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          className="ghost"
                          onClick={() => deletar(s.id)}
                          style={{ padding: '4px 8px', fontSize: 12 }}
                          title="Excluir"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>
                      {s.description}
                    </p>
                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {s.tools && s.tools.length > 0 && `🔧 ${s.tools.join(', ')}`}
                      </span>
                      <button
                        className="ghost"
                        onClick={() => definirPadrao(ehPadrao ? null : s.id)}
                        style={{ padding: '4px 10px', fontSize: 12 }}
                      >
                        {ehPadrao ? 'Remover padrão' : '⭐ Definir padrão'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Templates prontos</h2>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
            Clique para adicionar à sua biblioteca:
          </p>
          <div className="agents-grid">
            {TEMPLATES.map((t) => {
              const jaTem = skills.some((s) => s.name === t.name);
              return (
                <div key={t.name} className="card" style={{ opacity: jaTem ? 0.5 : 1 }}>
                  <h3 style={{ margin: 0 }}>{t.name}</h3>
                  <p style={{ color: 'var(--muted)', fontSize: 13, margin: '8px 0 12px' }}>
                    {t.description}
                  </p>
                  <button
                    onClick={() => criarDeTemplate(t)}
                    disabled={jaTem}
                    style={{ width: '100%' }}
                  >
                    {jaTem ? '✓ Já adicionada' : '+ Adicionar'}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {editing && (
        <SkillEditor
          initial={editing === 'new' ? null : editing}
          onSave={async () => {
            setEditing(null);
            await load();
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function SkillEditor({
  initial,
  onSave,
  onClose,
}: {
  initial: Skill | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    description: initial?.description || '',
    prompt: initial?.prompt || '',
  });
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!form.name || !form.prompt) {
      alert('Nome e prompt são obrigatórios.');
      return;
    }
    setSaving(true);
    try {
      if (initial) {
        await api.put(`/skills/${initial.id}`, form);
      } else {
        await api.post('/skills', form);
      }
      onSave();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: 600, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>{initial ? 'Editar skill' : 'Nova skill'}</h2>

        <div className="form-group">
          <label>Nome</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Revisor de código"
          />
        </div>
        <div className="form-group">
          <label>Descrição curta</label>
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="O que essa skill faz"
          />
        </div>
        <div className="form-group">
          <label>Prompt da skill</label>
          <textarea
            value={form.prompt}
            onChange={(e) => setForm({ ...form, prompt: e.target.value })}
            placeholder="Você é um... [defina personalidade, contexto, instruções]"
            rows={8}
            style={{ width: '100%', resize: 'vertical', minHeight: 160 }}
          />
          <small style={{ color: 'var(--muted)', fontSize: 12 }}>
            Esse prompt vira o "system message" das conversas. Quanto mais específico, melhor.
          </small>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="ghost" onClick={onClose}>Cancelar</button>
          <button onClick={salvar} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
