import { useState, useEffect } from 'react';
import api from '../api/axios';

/**
 * ProfilePage — full main-area profile management page.
 * Shown when user clicks "Manage Profile" in the sidebar.
 */
export default function ProfilePage({ onBack }) {
  const [userData, setUserData]     = useState(() => JSON.parse(localStorage.getItem('user') || '{}'));
  const [loading, setLoading]       = useState(true);
  const [nameForm, setNameForm]     = useState({ name: '' });
  const [pwForm, setPwForm]         = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [nameSaving, setNameSaving] = useState(false);
  const [pwSaving, setPwSaving]     = useState(false);
  const [nameMsg, setNameMsg]       = useState('');
  const [nameErr, setNameErr]       = useState('');
  const [pwMsg, setPwMsg]           = useState('');
  const [pwErr, setPwErr]           = useState('');

  const initial    = userData.name?.[0]?.toUpperCase() || '?';
  const roleColors = { ADMIN: '#7c3aed', SURVEYER: '#0f2d6e', USER: '#047857' };
  const roleClass  = { ADMIN:'badge-admin', SURVEYER:'badge-surveyer', USER:'badge-user' }[userData.role] || 'badge-user';

  // Load fresh profile from server
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/auth/profile');
        setUserData(data.user);
        setNameForm({ name: data.user.name || '' });
        localStorage.setItem('user', JSON.stringify({ ...JSON.parse(localStorage.getItem('user')||'{}'), ...data.user }));
      } catch { /* use localStorage fallback */ }
      finally { setLoading(false); }
    })();
  }, []);

  async function handleNameSave(e) {
    e.preventDefault();
    if (!nameForm.name.trim() || nameForm.name.trim() === userData.name) {
      setNameMsg('No changes to save.'); return;
    }
    setNameSaving(true); setNameMsg(''); setNameErr('');
    try {
      const { data } = await api.put('/auth/profile', { name: nameForm.name.trim() });
      const updated = { ...userData, ...data.user };
      localStorage.setItem('user', JSON.stringify(updated));
      setUserData(updated);
      setNameMsg('✅ Name updated successfully!');
    } catch (err) {
      setNameErr(err.response?.data?.message || 'Failed to update name.');
    } finally { setNameSaving(false); }
  }

  async function handlePasswordSave(e) {
    e.preventDefault();
    setPasswordMsg(''); setPwErr('');
    if (!pwForm.currentPassword || !pwForm.newPassword) {
      setPwErr('All password fields are required.'); return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwErr('New passwords do not match.'); return;
    }
    if (pwForm.newPassword.length < 8) {
      setPwErr('New password must be at least 8 characters.'); return;
    }
    setPwSaving(true);
    try {
      await api.put('/auth/profile', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwMsg('✅ Password changed successfully!');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPwErr(err.response?.data?.message || 'Failed to change password.');
    } finally { setPwSaving(false); }
  }

  function setPasswordMsg(v) { setPwMsg(v); } // alias

  if (loading) {
    return (
      <div className="dash-loading">
        <div className="dash-spinner" />
        <span>Loading profile…</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Back button */}
      <button
        onClick={onBack}
        className="btn btn-secondary btn-sm"
        style={{ marginBottom: 24 }}
      >
        ← Back
      </button>

      {/* Hero card */}
      <div style={{
        background: 'linear-gradient(135deg, #0f2d6e 0%, #1d4ed8 100%)',
        borderRadius: 20, padding: '32px 36px', marginBottom: 28,
        display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
        boxShadow: '0 8px 32px rgba(15,45,110,0.18)',
      }}>
        {/* Big avatar */}
        <div style={{
          width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(255,255,255,0.15)',
          border: '3px solid rgba(255,255,255,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: 32,
          backdropFilter: 'blur(8px)',
        }}>
          {initial}
        </div>

        {/* Info */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6 }}>
            {userData.name}
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', marginBottom: 10 }}>
            {userData.email}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className={`badge ${roleClass}`} style={{ fontSize: 11, padding: '3px 10px' }}>
              {userData.role}
            </span>
            {userData.surveyerId && (
              <span style={{
                fontSize: 12, color: 'rgba(255,255,255,0.8)',
                background: 'rgba(255,255,255,0.15)', borderRadius: 100,
                padding: '3px 10px', fontFamily: 'monospace',
              }}>
                🔖 {userData.surveyerId}
              </span>
            )}
            {userData.surveyerStatus && (
              <span style={{
                fontSize: 12, color: 'rgba(255,255,255,0.8)',
                background: 'rgba(255,255,255,0.15)', borderRadius: 100,
                padding: '3px 10px',
              }}>
                {userData.surveyerStatus}
              </span>
            )}
          </div>
        </div>

        {/* Joined */}
        {userData.createdAt && (
          <div style={{ textAlign: 'right', color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
            Member since<br />
            <strong style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>
              {new Date(userData.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </strong>
          </div>
        )}
      </div>

      {/* Account Details (read-only info grid) */}
      <div className="dash-card" style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          📋 Account Details
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
          {[
            { label: 'Full Name',    value: userData.name },
            { label: 'Email',        value: userData.email },
            { label: 'Role',         value: userData.role },
            { label: 'Auth Method',  value: userData.authProvider || 'LOCAL' },
            userData.surveyerId && { label: 'Surveyer ID', value: userData.surveyerId },
            userData.surveyerStatus && { label: 'Surveyer Status', value: userData.surveyerStatus },
          ].filter(Boolean).map(item => (
            <div key={item.label} style={{
              background: 'var(--bg-input, #f9fafb)',
              borderRadius: 10, padding: '12px 14px',
              border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Name */}
      <div className="dash-card" style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          ✏️ Edit Name
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>
          Update your display name across the platform.
        </div>

        <form onSubmit={handleNameSave}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              className="form-input"
              value={nameForm.name}
              onChange={e => setNameForm({ name: e.target.value })}
              placeholder="Your full name"
              style={{ maxWidth: 360 }}
            />
          </div>
          {nameMsg && <div className="alert alert-success" style={{ marginBottom: 12 }}>{nameMsg}</div>}
          {nameErr && <div className="alert alert-error"  style={{ marginBottom: 12 }}>⚠️ {nameErr}</div>}
          <button type="submit" className="btn btn-primary" disabled={nameSaving}>
            {nameSaving ? '⏳ Saving…' : '💾 Save Name'}
          </button>
        </form>
      </div>

      {/* Change Password */}
      <div className="dash-card" style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          🔒 Change Password
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>
          Use a strong password with at least 8 characters.
        </div>

        <form onSubmit={handlePasswordSave}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16, maxWidth: 540 }}>
            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input type="password" className="form-input"
                value={pwForm.currentPassword}
                onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                placeholder="Current password" />
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input type="password" className="form-input"
                value={pwForm.newPassword}
                onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })}
                placeholder="Min. 8 characters" />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input type="password" className="form-input"
                value={pwForm.confirmPassword}
                onChange={e => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                placeholder="Repeat new password" />
            </div>
          </div>

          {pwMsg && <div className="alert alert-success" style={{ marginBottom: 12, marginTop: 4 }}>{pwMsg}</div>}
          {pwErr && <div className="alert alert-error"  style={{ marginBottom: 12, marginTop: 4 }}>⚠️ {pwErr}</div>}

          <button type="submit" className="btn btn-primary" disabled={pwSaving}>
            {pwSaving ? '⏳ Changing…' : '🔒 Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
