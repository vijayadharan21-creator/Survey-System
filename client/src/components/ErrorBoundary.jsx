import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#f8fafc',
          color: '#1e293b',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <div style={{
            maxWidth: 500,
            width: '100%',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: 32,
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px 0', color: '#0f172a' }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 20px 0', lineHeight: 1.5 }}>
              An unexpected error occurred while rendering this page.
            </p>
            {this.state.error?.message && (
              <div style={{
                background: '#fee2e2',
                color: '#991b1b',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                marginBottom: 20,
                textAlign: 'left',
                overflowX: 'auto',
                fontFamily: 'monospace'
              }}>
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              style={{
                background: '#0f2d6e',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              🔄 Reload Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
