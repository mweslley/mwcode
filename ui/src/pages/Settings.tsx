import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface MaskedKeys {
  openrouter?: string;
  openai?: string;
  gemini?: string;
  deepseek?: string;
  github?: string;
  ollama_url?: string;
}

interface ServerKeys {
  openrouter: boolean;
  openai: boolean;
  gemini: boolean;
  deepseek: boolean;
  github: boolean;
}

const KEY_LABELS: Record<string, { label: string; placeholder: string; type?: string }> = {
  openrouter: { label: 'OpenRouter', placeholder: 'sk-or-v1-...' },
  openai:     { label: 'OpenAI', placeholder: 'sk-...' },
  gemini:     { label: 'Google Gemini', placeholder: 'AIza...' },
  deepseek:   { label: 'DeepSeek', placeholder: 'sk-...' },
  github:     { label: 'GitHub Models', placeholder: 'ghp_...' },
  ollama_url: { label: 'Ollama URL', placeholder: 'http://localhost:11434', type: 'url' },
};

export function Settings() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<any>(null);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [updating, setUpdating] = useState(false);

  // Profile editing
  const [showProfile, setShowProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', email: '', password: '', currentPassword: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  // API Keys state
  const [maskedKeys, setMaskedKeys] = useState<MaskedKeys>({});
  const [serverKeys, setServerKeys] = useState<ServerKeys>({ openrouter: false, openai: false, gemini: false, deepseek: false, github: false });
  const [keyForm, setKeyForm] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState(false);
  const [keysMsg, setKeysMsg] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState(false);

  const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
  const company = (() => { try { return JSON.parse(localStorage.getItem('company') || '{}'); } catch { return {}; } })();

  useEffect(() => {
    api.get('/health').catch(() => null).then(setHealth);
    api.get('/system/update-check').catch(() => null).then(setUpdateInfo);
    loadKeys();
  }, []);

  async function loadKeys() {
    try {
      const data = await api.get<{ keys: MaskedKeys; server: ServerKeys }>('/user/keys');
      setMaskedKeys(data?.keys || {});
      setServerKeys(data?.server || { openrouter: false, openai: false, gemini: false, deepseek: false, github: false });
    } catch {}
  }

  async function saveProfile() {
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const payload: any = {};
      if (profileForm.name && profileForm.name !== user?.name) payload.name = profileForm.name;
      if (profileForm.email && profileForm.email !== user?.email) payload.email = profileForm.email;
      if (profileForm.password) payload.password = profileForm.password;
      if (profileForm.currentPassword) payload.currentPassword = profileForm.currentPassword;

      if (Object.keys(payload).length === 0) { setProfileMsg('Nenhuma alteração.'); return; }

      const res = await api.put<{ ok: boolean; token: string; user: any }>('/auth/profile', payload);
      // Atualiza localStorage
      if (res.token) localStorage.setItem('token', res.token);
      if (res.user) localStorage.setItem('user', JSON.stringify(res.user));
      setProfileMsg('✅ Perfil atualizado!');
      setProfileForm(f => ({ ...f, password: '', currentPassword: '' }));
      setTimeout(() => { setProfileMsg(null); window.location.reload(); }, 1500);
    } catch (e: any) {
      setProfileMsg('❌ ' + e.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveKeys() {
    setSavingKeys(true);
    setKeysMsg(null);
    try {
      await api.put('/user/keys', keyForm);
      setKeyForm({});
      setKeysMsg('✅ Chaves salvas com sucesso!');
      await loadKeys();
    } catch (e: any) {
      setKeysMsg('❌ Erro ao salvar: ' + e.message);
    } finally {
      setSavingKeys(false);
      setTimeout(() => setKeysMsg(null), 4000);
    }
  }

  async function deleteKey(provider: string) {
    if (!confirm(`Remover chave de ${KEY_LABELS[provider]?.label || provider}?`)) return;
    try {
      await api.delete(`/user/keys/${provider}`);
      setKeysMsg('✅ Chave removida.');
      await loadKeys();
      setTimeout(() => setKeysMsg(null), 3000);
    } catch (e: any) {
      alert('Erro: ' + e.message);
    }
  }

  async function runUpdate() {
    if (!confirm('Atualizar o MWCode? O servidor vai reiniciar por alguns segundos.')) return;
    setUpdating(true);
    try {
      await api.post('/system/update', {});
      alert('Atualização iniciada! O servidor vai reiniciar em breve.');
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setUpdating(false);
    }
  }

  function sair() {
    localStorage.clear();
    navigate('/login');
  }

  const hasUserKeys = Object.keys(maskedKeys).filter(k => k !== 'updatedAt' && maskedKeys[k as keyof MaskedKeys]).length > 0;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Configurações</h1>
        <p className="page-subtitle">Gerencie sua conta e workspace.</p>
      </div>

      {/* Perfil */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Perfil</h3>
          <button
            className="ghost"
            style={{ fontSize: 12 }}
            onClick={() => {
              setShowProfile(!showProfile);
              if (!showProfile) setProfileForm({ name: user?.name || '', email: user?.email || '', password: '', currentPassword: '' });
            }}
          >
            {showProfile ? '▲ Fechar' : '✏️ Editar'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: showProfile ? 16 : 0 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'var(--grad-p)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {user?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{user?.name || '—'}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>{user?.email}</div>
          </div>
        </div>

        {showProfile && (
          <>
            <div className="divider" style={{ margin: '0 0 16px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 12 }}>Nome</label>
                  <input
                    value={profileForm.name}
                    onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                    placeholder={user?.name}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 12 }}>E-mail</label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
                    placeholder={user?.email}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 12 }}>Senha atual</label>
                  <input
                    type="password"
                    value={profileForm.currentPassword}
                    onChange={e => setProfileForm(f => ({ ...f, currentPassword: e.target.value }))}
                    placeholder="Necessária para mudar e-mail ou senha"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 12 }}>Nova senha</label>
                  <input
                    type="password"
                    value={profileForm.password}
                    onChange={e => setProfileForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
              </div>
            </div>

            {profileMsg && (
              <div style={{ marginTop: 10, fontSize: 13, color: profileMsg.startsWith('✅') ? 'var(--secondary)' : 'var(--danger)' }}>
                {profileMsg}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button
                style={{ fontSize: 12 }}
                disabled={savingProfile}
                onClick={saveProfile}
              >
                {savingProfile ? 'Salvando...' : '💾 Salvar alterações'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Chaves de API */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>🔑 Chaves de API</h3>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>
              Suas chaves sobrepõem as do servidor e ficam armazenadas só no seu perfil.
            </p>
          </div>
          <button className="ghost" style={{ fontSize: 12 }} onClick={() => setShowKeys(!showKeys)}>
            {showKeys ? '▲ Fechar' : '▼ Gerenciar'}
          </button>
        </div>

        {/* Status rápido */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: showKeys ? 16 : 0 }}>
          {Object.entries(KEY_LABELS).map(([key, { label }]) => {
            const hasUser = !!(maskedKeys as any)[key];
            const hasServer = key !== 'ollama_url' && (serverKeys as any)[key];
            const status = hasUser ? 'user' : hasServer ? 'server' : 'none';
            return (
              <span
                key={key}
                className={`badge ${status === 'user' ? 'badge-green' : status === 'server' ? 'badge-purple' : 'badge-gray'}`}
                title={status === 'user' ? 'Configurada por você' : status === 'server' ? 'Configurada no servidor' : 'Não configurada'}
              >
                {label} {status === 'user' ? '✓ sua' : status === 'server' ? '✓ servidor' : '—'}
              </span>
            );
          })}
        </div>

        {showKeys && (
          <>
            <div className="divider" style={{ margin: '0 0 16px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Object.entries(KEY_LABELS).map(([key, { label, placeholder }]) => {
                const current = (maskedKeys as any)[key] as string | undefined;
                return (
                  <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', display: 'block', marginBottom: 4 }}>
                        {label}
                      </label>
                      <input
                        type={key === 'ollama_url' ? 'text' : 'password'}
                        value={keyForm[key] ?? ''}
                        onChange={e => setKeyForm(f => ({ ...f, [key]: e.target.value }))}
                        placeholder={current ? current : placeholder}
                        style={{ width: '100%', fontSize: 13 }}
                      />
                    </div>
                    {current && (
                      <button
                        className="ghost"
                        style={{ padding: '6px 10px', fontSize: 12, color: 'var(--danger)', borderColor: 'var(--danger)', marginTop: 20 }}
                        onClick={() => deleteKey(key)}
                        title={`Remover chave de ${label}`}
                      >
                        🗑
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {keysMsg && (
              <div style={{ marginTop: 12, fontSize: 13, color: keysMsg.startsWith('✅') ? 'var(--secondary)' : 'var(--danger)' }}>
                {keysMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button
                className="ghost"
                style={{ fontSize: 12 }}
                onClick={() => setKeyForm({})}
              >
                Limpar campos
              </button>
              <button
                style={{ fontSize: 12 }}
                disabled={savingKeys || Object.keys(keyForm).every(k => !keyForm[k])}
                onClick={saveKeys}
              >
                {savingKeys ? 'Salvando...' : '💾 Salvar chaves'}
              </button>
            </div>

            <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(146,48,249,0.07)', borderRadius: 8, fontSize: 12, color: 'var(--muted)' }}>
              <strong style={{ color: 'var(--fg-2)' }}>Como funciona:</strong> se você definir uma chave aqui, ela é usada em vez da chave do servidor.
              Deixe em branco para usar a chave do servidor. Para remover sua chave (e voltar a usar a do servidor), clique em 🗑.
            </div>
          </>
        )}
      </div>

      {/* Workspace */}
      {company?.name && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Workspace</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--muted)' }}>Empresa</span>
              <span>{company.name}</span>
            </div>
            {company.area && (
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--muted)' }}>Área</span>
                <span>{company.area}</span>
              </div>
            )}
            {company.employees && (
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--muted)' }}>Equipe</span>
                <span>{company.employees} pessoas</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sistema */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Sistema</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--muted)' }}>Status da API</span>
            <span className={`badge ${health ? 'badge-green' : 'badge-red'}`}>
              {health ? '● Online' : '● Offline'}
            </span>
          </div>
          {health?.version && (
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--muted)' }}>Versão</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{health.version}</span>
            </div>
          )}
          {health?.provider && (
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--muted)' }}>Provedor padrão do servidor</span>
              <span>{health.provider}</span>
            </div>
          )}
        </div>

        {updateInfo?.hasUpdate && (
          <div style={{
            marginTop: 14,
            padding: '12px 14px',
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, color: '#fbbf24' }}>🔄 Atualização disponível</span>
            <button
              onClick={runUpdate}
              disabled={updating}
              style={{ fontSize: 12, padding: '5px 12px', background: 'rgba(245,158,11,0.2)', borderColor: 'rgba(245,158,11,0.4)', color: '#fbbf24' }}
            >
              {updating ? 'Atualizando...' : 'Atualizar agora'}
            </button>
          </div>
        )}
      </div>

      {/* Conta */}
      <div className="card">
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Conta</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="ghost"
            onClick={() => { localStorage.removeItem('company'); navigate('/onboarding'); }}
            style={{ fontSize: 12 }}
          >
            Reconfigurar workspace
          </button>
          <button className="danger" onClick={sair} style={{ fontSize: 12 }}>
            ↩ Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
}
