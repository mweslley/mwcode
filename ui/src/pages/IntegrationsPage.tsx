import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface Integration {
  id: string;
  name: string;
  category: string;
  icon: string;
  desc: string;
  connected: boolean;
  configFields: { key: string; label: string; type: string; placeholder: string }[];
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'discord',
    name: 'Discord',
    category: 'Comunicação',
    icon: '🎮',
    desc: 'Conecte agentes ao Discord para receber e enviar mensagens em canais.',
    connected: false,
    configFields: [
      { key: 'bot_token', label: 'Bot Token', type: 'password', placeholder: 'MTxxxxxx...' },
      { key: 'webhook_url', label: 'Webhook URL (opcional)', type: 'url', placeholder: 'https://discord.com/api/webhooks/...' },
    ],
  },
  {
    id: 'webhook',
    name: 'Webhooks',
    category: 'Automação',
    icon: '🌐',
    desc: 'Receba chamadas HTTP externas para disparar workflows e agentes.',
    connected: false,
    configFields: [
      { key: 'secret', label: 'Secret (validação)', type: 'text', placeholder: 'seu-secret-aqui' },
    ],
  },
  {
    id: 'pterodactyl',
    name: 'Pterodactyl',
    category: 'Hosting',
    icon: '🦕',
    desc: 'Gerencie servidores de jogos (FiveM, SAMP) via API do Pterodactyl.',
    connected: false,
    configFields: [
      { key: 'panel_url', label: 'URL do Painel', type: 'url', placeholder: 'https://painel.lojamwo.com.br' },
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'ptla_xxxxxxxx' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    category: 'IA',
    icon: '🧠',
    desc: 'Acesse centenas de modelos de IA gratuitos e pagos via OpenRouter.',
    connected: true,
    configFields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'sk-or-v1-...' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    category: 'IA',
    icon: '🤖',
    desc: 'Conecte ao GPT-4o, GPT-4o-mini e outros modelos da OpenAI.',
    connected: false,
    configFields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'sk-...' },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    category: 'IA',
    icon: '✨',
    desc: 'Use os modelos Gemini Pro e Flash do Google.',
    connected: false,
    configFields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'AIza...' },
    ],
  },
  {
    id: 'github',
    name: 'GitHub',
    category: 'Desenvolvimento',
    icon: '🐙',
    desc: 'Integre agentes com repositórios, issues e pull requests.',
    connected: false,
    configFields: [
      { key: 'token', label: 'Personal Access Token', type: 'password', placeholder: 'ghp_...' },
      { key: 'repo', label: 'Repositório padrão', type: 'text', placeholder: 'usuario/repo' },
    ],
  },
  {
    id: 'instagram',
    name: 'Instagram',
    category: 'Social',
    icon: '📸',
    desc: 'Publique posts, carrosséis e stories automaticamente.',
    connected: false,
    configFields: [
      { key: 'access_token', label: 'Access Token', type: 'password', placeholder: 'EAA...' },
      { key: 'ig_user_id', label: 'ID da conta', type: 'text', placeholder: '17841xxxxxxxxx' },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    category: 'IA',
    icon: '🦙',
    desc: 'Rode modelos de IA localmente com Ollama (Llama, Mistral, etc).',
    connected: false,
    configFields: [
      { key: 'base_url', label: 'URL do servidor', type: 'url', placeholder: 'http://localhost:11434' },
    ],
  },
  {
    id: 'apify',
    name: 'Apify',
    category: 'Automação',
    icon: '🕷️',
    desc: 'Scraping e extração de dados da web em larga escala. Usado pela skill "Scraping com Apify" da equipe Grandense.',
    connected: false,
    configFields: [
      { key: 'api_token', label: 'API Token', type: 'password', placeholder: 'apify_api_...' },
    ],
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    category: 'IA',
    icon: '🎙️',
    desc: 'Síntese de voz realista com IA. Usado pela skill "Narração ElevenLabs" da equipe Grandense.',
    connected: false,
    configFields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'sk_...' },
      { key: 'voice_id', label: 'Voice ID (opcional)', type: 'text', placeholder: 'EXAVITQu4vr4xnSDxMaL' },
    ],
  },
  {
    id: 'stability',
    name: 'Stability AI',
    category: 'IA',
    icon: '🎨',
    desc: 'Geração de imagens com IA (Stable Diffusion). Usado pela skill "Geração de Imagem (IA)" da equipe Grandense.',
    connected: false,
    configFields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'sk-...' },
    ],
  },
];

const CATEGORIES = [...new Set(INTEGRATIONS.map(i => i.category))];

export function IntegrationsPage() {
  const [filter, setFilter] = useState<string>('all');
  const [configuring, setConfiguring] = useState<Integration | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [connected, setConnected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadConnected(); }, []);

  async function loadConnected() {
    setLoading(true);
    try {
      const data = await api.get<Record<string, Record<string, string>>>('/user/integrations');
      setConnected(new Set(Object.keys(data || {})));
    } catch {}
    setLoading(false);
  }

  const filtered = INTEGRATIONS.filter(i => filter === 'all' || i.category === filter);

  function openConfig(integration: Integration) {
    setConfiguring(integration);
    setValues({});
    setMsg(null);
  }

  async function save() {
    if (!configuring) return;
    setSaving(true);
    setMsg(null);
    try {
      await api.put(`/user/integrations/${configuring.id}`, values);
      setConnected(prev => new Set([...prev, configuring.id]));
      setMsg('✅ Salvo com sucesso!');
      setTimeout(() => { setMsg(null); setConfiguring(null); }, 1200);
    } catch (e: any) {
      setMsg('❌ Erro ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function disconnect(id: string) {
    if (!confirm('Desconectar esta integração? As chaves serão removidas.')) return;
    try {
      await api.delete(`/user/integrations/${id}`);
      setConnected(prev => { const s = new Set(prev); s.delete(id); return s; });
    } catch {}
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Integrações</h1>
        <p className="page-subtitle">Conecte o MWCode com ferramentas externas e potencialize seus agentes.</p>
      </div>

      {/* Stats rápidas */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <div className="stat-card" style={{ flex: 1, padding: '14px 18px' }}>
          <div className="stat-label">Disponíveis</div>
          <div className="stat-value" style={{ fontSize: 22 }}>{INTEGRATIONS.length}</div>
        </div>
        <div className="stat-card green-accent" style={{ flex: 1, padding: '14px 18px' }}>
          <div className="stat-label">Conectadas</div>
          <div className="stat-value" style={{ fontSize: 22 }}>{connected.size}</div>
        </div>
      </div>

      {/* Filtro por categoria */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          onClick={() => setFilter('all')}
          style={{ fontSize: 12, padding: '5px 12px', background: filter === 'all' ? 'var(--primary)' : 'var(--bg-2)', borderColor: filter === 'all' ? 'var(--primary)' : 'var(--border)', color: filter === 'all' ? '#fff' : 'var(--fg-2)' }}
        >
          Todos
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            style={{ fontSize: 12, padding: '5px 12px', background: filter === cat ? 'var(--primary)' : 'var(--bg-2)', borderColor: filter === cat ? 'var(--primary)' : 'var(--border)', color: filter === cat ? '#fff' : 'var(--fg-2)' }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="integrations-grid">
        {filtered.map(integration => {
          const isConnected = connected.has(integration.id);
          return (
            <div key={integration.id} className="integration-card">
              <div className="integration-header">
                <div className="integration-icon">{integration.icon}</div>
                <div>
                  <div className="integration-name">{integration.name}</div>
                  <div className="integration-category">{integration.category}</div>
                </div>
                {isConnected && <span className="badge badge-green" style={{ marginLeft: 'auto' }}>✓ Conectado</span>}
              </div>

              <div className="integration-desc">{integration.desc}</div>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {isConnected ? (
                  <>
                    <button
                      className="ghost"
                      style={{ flex: 1, fontSize: 12, justifyContent: 'center' }}
                      onClick={() => openConfig(integration)}
                    >
                      ⚙️ Configurar
                    </button>
                    <button
                      className="danger"
                      style={{ fontSize: 12, padding: '6px 12px' }}
                      onClick={() => disconnect(integration.id)}
                    >
                      Desconectar
                    </button>
                  </>
                ) : (
                  <button
                    style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
                    onClick={() => openConfig(integration)}
                  >
                    🔌 Conectar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de configuração */}
      {configuring && (
        <div className="modal-overlay" onClick={() => setConfiguring(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div className="integration-icon" style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--bg-3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                {configuring.icon}
              </div>
              <div>
                <h2 style={{ marginBottom: 2 }}>Configurar {configuring.name}</h2>
                <p style={{ fontSize: 12, color: 'var(--muted)' }}>{configuring.desc}</p>
              </div>
            </div>

            {configuring.configFields.map(field => (
              <div key={field.key} className="form-group">
                <label>{field.label}</label>
                <input
                  type={field.type === 'password' ? 'password' : 'text'}
                  value={values[field.key] || ''}
                  onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                />
              </div>
            ))}

            {msg && (
              <div style={{ marginBottom: 12, fontSize: 13, color: msg.startsWith('✅') ? '#10b981' : '#ef4444' }}>
                {msg}
              </div>
            )}

            <div className="modal-actions">
              <button className="ghost" onClick={() => setConfiguring(null)}>Cancelar</button>
              <button onClick={save} disabled={saving}>
                {saving ? 'Salvando...' : '✅ Salvar & Conectar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
