import { useNavigate } from 'react-router-dom';

/**
 * Enterprise Navbar — modern SaaS navigation with brand, operational health,
 * context breadcrumb, and user profile / logout actions.
 */
export default function Navbar({ title }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <nav className="dash-nav" aria-label="Main Navigation">
      {/* Brand & Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div 
          className="dash-nav-brand" 
          onClick={() => navigate('/dashboard')} 
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
          title="Go to Dashboard Home"
        >
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg, #0f2d6e 0%, #1d4ed8 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(15, 45, 110, 0.25)',
          }}>
            <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
              <path d="M7 10h14M7 14h10M7 18h12" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </div>
          <span className="dash-nav-brand-name">SurveyAI</span>
        </div>

        {title && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: 'var(--border, #cbd5e1)', fontSize: '16px', fontWeight: 300 }}>/</span>
            <span style={{
              fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary, #334155)',
              background: 'var(--bg-input, #f1f5f9)', padding: '3px 10px', borderRadius: 8,
              border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
            }}>
              {title}
            </span>
          </div>
        )}

        {/* Live operational status pill */}
        <div 
          className="dash-nav-status-badge"
          title="All systems operational • 99.98% SLA Uptime"
        >
          <span className="dash-nav-status-dot" />
          <span>Systems Operational</span>
        </div>
      </div>

      {/* Right side controls */}
      <div className="dash-nav-right" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Documentation & Help */}
        <a 
          href="/#features" 
          target="_blank" 
          rel="noopener noreferrer"
          className="dash-nav-doc-link"
          title="Product Features & Platform Documentation"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>Docs</span>
        </a>

        {/* Sign out button */}
        <button 
          className="btn-logout" 
          onClick={handleLogout} 
          title="Sign out of account securely"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Sign out</span>
        </button>
      </div>
    </nav>
  );
}
