/**
 * ProfilePanel — compact sidebar card.
 * Shows avatar + name + role only.
 * "Manage Profile" calls onManage() to open the full profile page in the main area.
 */
export default function ProfilePanel({ onManage }) {
  const user    = JSON.parse(localStorage.getItem('user') || '{}');
  const initial = user.name?.[0]?.toUpperCase() || '?';
  const roleColors = { ADMIN: '#7c3aed', SURVEYER: '#0f2d6e', USER: '#047857' };
  const roleClass  = { ADMIN:'badge-admin', SURVEYER:'badge-surveyer', USER:'badge-user' }[user.role] || 'badge-user';

  return (
    <div style={{
      borderTop: '1px solid var(--border, rgba(0,0,0,0.1))',
      marginTop: 'auto',
      padding: '14px 8px 8px',
    }}>
      {/* Avatar row */}
      <div
        onClick={onManage}
        title="Manage Profile"
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-bg, rgba(15,45,110,0.07))'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {/* Avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: `linear-gradient(135deg, ${roleColors[user.role] || '#6b7280'}, ${roleColors[user.role] || '#9ca3af'}99)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: 14,
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
        }}>
          {initial}
        </div>

        {/* Name + role */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #0a0c10)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {user.name}
          </div>
          <span className={`badge ${roleClass}`} style={{ fontSize: 9, padding: '1px 6px', marginTop: 2, display: 'inline-block' }}>
            {user.role}
          </span>
        </div>

        {/* Arrow hint */}
        <span style={{ fontSize: 12, color: 'var(--text-faint, #9ca3af)', flexShrink: 0 }}>›</span>
      </div>
    </div>
  );
}
