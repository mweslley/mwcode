import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export function Settings() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<any>(null);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [updating, setUpdating] = useState(false);

  const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
  const company = (() => { try { return JSON.parse(localStorage.getItem('company') || '{}'); } catch { return {}; } })();

  useEffect(() => {
    api.get('/api/health').catch(() => null).then(setHealth);
    api.get('/system/update-check').catch(() => null).then(setUpdateInfo);
  }, []);

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

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Configurações</h1>
        <p className="page-subtitle">Gerencie sua conta e workspace.</p>
      </div>

      {/* Perfil */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Perfil</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'var(--grad-p)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700, color: '#fff',
          }}>
            {user?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{user?.name || '—'}</div>
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>{user?.email}</div>
          </div>
          <button className="ghost" style={{ marginLeft: 'auto', fontSize: 12 }}>Editar</button>
        </div>
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
              <span style={{ color: 'var(--muted)' }}>Provedor padrão</span>
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

      {/* Ações perigosas */}
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
