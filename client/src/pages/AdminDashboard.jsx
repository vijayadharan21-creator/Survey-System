import { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import ProfilePanel from '../components/ProfilePanel';
import ProfilePage from '../components/ProfilePage';
import DashboardFooter from '../components/DashboardFooter';
import api from '../api/axios';
import { exportElementToPdf } from '../utils/generatePdf';
import '../styles/dashboard.css';

function StatusBadge({ status }) {
  const map   = { PENDING:'pending', APPROVED:'approved', REJECTED:'rejected', DRAFT:'draft', PUBLISHED:'published', COMPLETED:'completed', SUBMITTED:'submitted', ACTIVE:'approved' };
  const icons = { PENDING:'⏳', APPROVED:'✅', REJECTED:'❌', DRAFT:'📝', PUBLISHED:'📡', COMPLETED:'🏁', SUBMITTED:'📤', ACTIVE:'🟢' };
  return <span className={`badge badge-${map[status]||'draft'}`}>{icons[status]||'•'} {status}</span>;
}

function safeFormatDate(val, fallback = '—') {
  if (!val) return fallback;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleDateString();
  } catch {
    return fallback;
  }
}

const ROLE_COLORS = { ADMIN:'#7c3aed', SURVEYER:'#0f2d6e', USER:'#047857' };

const SECTIONS = [
  { key:'proposals',  icon:'📋', label:'Proposals'       },
  { key:'surveys',    icon:'📡', label:'Active Surveys'  },
  { key:'accounts',   icon:'👥', label:'Manage Accounts' },
  { key:'reports',    icon:'📄', label:'Report History'  },
];

export default function AdminDashboard() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [section, setSection] = useState('proposals');

  // ── Proposals ──
  const [proposals, setProposals]     = useState([]);
  const [propLoading, setPropLoading] = useState(true);
  const [propError, setPropError]     = useState('');
  const [filter, setFilter]           = useState('ALL');
  const [rejectModal, setRejectModal] = useState({ open:false, id:null, title:'' });
  const [rejectReason, setRejectReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);
  const [rejectErr, setRejectErr]     = useState('');
  const [processing, setProcessing]   = useState({});
  const [messages, setMessages]       = useState({});

  // ── Active Surveys ──
  const [surveys, setSurveys]         = useState([]);
  const [surveyLoading, setSurveyLoading] = useState(false);
  const [surveyErr, setSurveyErr]     = useState('');
  const [surveyFilter, setSurveyFilter] = useState('ALL');
  const [inspectSurvey, setInspectSurvey] = useState(null);

  // ── Report History & Analysis (Same as UserDashboard) ──
  const [reports, setReports]                 = useState([]);
  const [repLoading, setRepLoading]           = useState(false);
  const [repErr, setRepErr]                   = useState('');
  const [selectedReport, setSelectedReport]   = useState(null);
  const [pdfLoading, setPdfLoading]           = useState(false);
  const [questionFilter, setQuestionFilter]   = useState('ALL');
  const [compareMode, setCompareMode]         = useState(false);
  const [compareIdA, setCompareIdA]           = useState('');
  const [compareIdB, setCompareIdB]           = useState('');

  // ── Manage Accounts ──
  const [users, setUsers]             = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersErr, setUsersErr]       = useState('');
  const [userSearch, setUserSearch]   = useState('');
  const [roleFilter, setRoleFilter]   = useState('ALL');

  /* ── API loaders ── */
  async function loadProposals() {
    setPropLoading(true); setPropError('');
    try   { const { data } = await api.get('/admin/proposals'); setProposals(data.proposals || []); }
    catch { setPropError('Failed to load proposals.'); }
    finally { setPropLoading(false); }
  }

  async function loadSurveys() {
    setSurveyLoading(true); setSurveyErr('');
    try   { const { data } = await api.get('/admin/surveys'); setSurveys(data.surveys || []); }
    catch { setSurveyErr('Failed to load surveys.'); }
    finally { setSurveyLoading(false); }
  }

  async function loadUsers() {
    setUsersLoading(true); setUsersErr('');
    try   { const { data } = await api.get('/admin/users'); setUsers(data.users || []); }
    catch { setUsersErr('Failed to load users.'); }
    finally { setUsersLoading(false); }
  }

  async function loadReports() {
    setRepLoading(true); setRepErr('');
    try   { const { data } = await api.get('/admin/reports'); setReports(data.reports || []); }
    catch { setRepErr('Failed to load reports.'); }
    finally { setRepLoading(false); }
  }

  // ── Load on mount / section change ──
  useEffect(() => {
    if (section === 'proposals') loadProposals();
    if (section === 'surveys')   loadSurveys();
    if (section === 'accounts')  loadUsers();
    if (section === 'reports')   loadReports();
  }, [section]);

  async function handleDownloadPdf(elementId, title) {
    setPdfLoading(true);
    try {
      const cleanName = (title || 'admin-report')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      await exportElementToPdf(elementId, `${cleanName || 'admin-report'}.pdf`);
    } catch (e) {
      console.error('PDF download error:', e);
    } finally {
      setPdfLoading(false);
    }
  }

  async function openSurveyAnalysis(s) {
    setSurveyLoading(true);
    try {
      let analytics = [];
      let totalResponses = s.responseCount || 0;
      try {
        const { data } = await api.get(`/surveys/${s._id}/analytics`);
        if (data) {
          analytics = data.analytics || [];
          totalResponses = data.totalResponses ?? totalResponses;
        }
      } catch (e) {
        console.warn('Live survey analytics fetch fallback:', e);
      }

      const reportView = {
        _id: s._id,
        reportId: `LIVE-${s.surveyId || 'SURV'}`,
        surveyId: s,
        surveyerUserId: s.surveyerUserId,
        surveyerId: s.surveyerId || s.surveyerUserId?.surveyerId,
        totalResponses,
        analytics,
        status: s.status,
        submittedAt: s.endTime,
        createdAt: s.createdAt,
      };
      setSelectedReport(reportView);
      setQuestionFilter('ALL');
      setSection('reports');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to open survey analysis.');
    } finally {
      setSurveyLoading(false);
    }
  }

  async function openReportAnalysis(r) {
    let enrichedReport = { ...r };
    // If analytics array is empty or missing, fetch live analytics from survey endpoint
    if ((!r.analytics || r.analytics.length === 0) && r.surveyId?._id) {
      try {
        const { data } = await api.get(`/surveys/${r.surveyId._id}/analytics`);
        if (data?.analytics?.length) {
          enrichedReport.analytics = data.analytics;
          enrichedReport.totalResponses = data.totalResponses ?? enrichedReport.totalResponses;
        }
      } catch (e) {
        console.warn('Report analytics fallback error:', e);
      }
    }
    setSelectedReport(enrichedReport);
    setQuestionFilter('ALL');
  }

  /* ── Proposal actions ── */
  async function handleApprove(id) {
    setProcessing(p => ({ ...p, [id]: true }));
    setMessages(p => ({ ...p, [id]: '' }));
    try {
      const { data } = await api.patch(`/admin/proposals/${id}/approve`);
      setMessages(p => ({ ...p, [id]: `✅ Approved! Surveyer ID: ${data.surveyerId}` }));
      await loadProposals();
    } catch (err) {
      setMessages(p => ({ ...p, [id]: `❌ ${err.response?.data?.message || 'Failed.'}` }));
    } finally { setProcessing(p => ({ ...p, [id]: false })); }
  }

  async function handleReject() {
    if (!rejectReason.trim() || rejectReason.trim().length < 5) {
      setRejectErr('Please provide a reason (at least 5 characters).'); return;
    }
    setRejectLoading(true); setRejectErr('');
    try {
      await api.patch(`/admin/proposals/${rejectModal.id}/reject`, { reason: rejectReason.trim() });
      setMessages(p => ({ ...p, [rejectModal.id]: '❌ Proposal rejected.' }));
      setRejectModal({ open:false, id:null, title:'' });
      await loadProposals();
    } catch (err) { setRejectErr(err.response?.data?.message || 'Failed to reject.'); }
    finally { setRejectLoading(false); }
  }

  /* ── Derived ── */
  const FILTERS   = ['ALL','PENDING','APPROVED','COMPLETED','REJECTED'];
  const filtered  = filter === 'ALL' ? proposals : proposals.filter(p => p.status === filter);
  const stats     = {
    total:     proposals.length,
    pending:   proposals.filter(p => p.status === 'PENDING').length,
    approved:  proposals.filter(p => p.status === 'APPROVED').length,
    completed: proposals.filter(p => p.status === 'COMPLETED').length,
    rejected:  proposals.filter(p => p.status === 'REJECTED').length,
  };

  const filteredUsers = users.filter(u => {
    const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchSearch = !userSearch.trim() ||
      u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.surveyerId?.toLowerCase().includes(userSearch.toLowerCase());
    return matchRole && matchSearch;
  });

  /* ══════════════ RENDER SECTIONS ══════════════ */

  function renderProposals() {
    return (
      <div>
        <div className="dash-stats-grid" style={{ marginBottom: 24 }}>
          {[
            { icon:'📊', val:stats.total,     label:'Total',     color:'var(--accent-mid)' },
            { icon:'⏳', val:stats.pending,   label:'Pending',   color:'#b45309' },
            { icon:'⚡', val:stats.approved,  label:'Approved',  color:'#047857' },
            { icon:'🏁', val:stats.completed, label:'Completed', color:'var(--accent-mid)' },
            { icon:'❌', val:stats.rejected,  label:'Rejected',  color:'#b91c1c' },
          ].map(s => (
            <div className="dash-stat" key={s.label}>
              <div className="dash-stat-icon">{s.icon}</div>
              <div style={{ fontSize:26, fontWeight:800, color:s.color }}>{s.val}</div>
              <div className="dash-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="dash-section-header">
          <div>
            <div className="dash-section-title">Proposal Management</div>
            <div className="dash-section-subtitle">Review and act on surveyer proposals</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={loadProposals}>🔄 Refresh</button>
        </div>

        <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`btn btn-sm ${filter===f ? 'btn-primary':'btn-secondary'}`}>
              {f==='ALL'?'📋 All':f==='PENDING'?'⏳ Pending':f==='APPROVED'?'⚡ Approved':f==='COMPLETED'?'🏁 Completed':'❌ Rejected'}
              <span style={{ marginLeft:6, background:'rgba(255,255,255,0.2)', borderRadius:100, padding:'0 6px', fontSize:11 }}>
                {f==='ALL'?stats.total:proposals.filter(p=>p.status===f).length}
              </span>
            </button>
          ))}
        </div>

        {propError && <div className="alert alert-error" style={{ marginBottom:16 }}>⚠️ {propError}</div>}
        {propLoading && <div className="dash-loading"><div className="dash-spinner"/><span>Loading…</span></div>}
        {!propLoading && filtered.length === 0 && (
          <div className="dash-empty">
            <div className="dash-empty-icon">{filter==='PENDING'?'📭':'📋'}</div>
            <div className="dash-empty-title">No {filter==='ALL'?'':filter.toLowerCase()+' '}proposals</div>
          </div>
        )}

        {!propLoading && filtered.length > 0 && (
          <div className="dash-list">
            {filtered.map(p => (
              <div key={p._id} className="dash-card" style={{ marginBottom:0 }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10, gap:16 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:'var(--text-primary)', marginBottom:4 }}>{p.title}</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:8, fontSize:12, color:'var(--text-muted)' }}>
                      <StatusBadge status={p.status}/>
                      {p.userId && <><span>👤 {p.userId.name}</span><span style={{ color:'var(--text-faint)' }}>{p.userId.email}</span></>}
                      <span>📅 {new Date(p.createdAt).toLocaleDateString()}</span>
                      <span>📍 {p.location?.city}</span>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:10 }}>{p.description}</div>
                {p.purpose && (
                  <div style={{ background:'var(--bg-input)', borderRadius:8, padding:'8px 12px', fontSize:13, marginBottom:10 }}>
                    <strong>Purpose:</strong> {p.purpose}
                  </div>
                )}
                <div style={{ display:'flex', gap:16, fontSize:12, color:'var(--text-muted)', marginBottom:10, flexWrap:'wrap' }}>
                  <span>📅 {new Date(p.startDate).toLocaleDateString()} – {new Date(p.endDate).toLocaleDateString()}</span>
                  <span>📍 {p.location?.latitude?.toFixed(4)}, {p.location?.longitude?.toFixed(4)}</span>
                </div>
                {p.status==='REJECTED' && p.rejectionReason && (
                  <div className="alert alert-error" style={{ marginBottom:10, fontSize:13 }}>
                    <strong>Reason:</strong> {p.rejectionReason}
                  </div>
                )}
                {messages[p._id] && (
                  <div className={`alert ${messages[p._id].startsWith('✅')?'alert-success':'alert-error'}`}
                    style={{ marginBottom:10, fontSize:13 }}>
                    {messages[p._id]}
                  </div>
                )}
                {p.status === 'PENDING' && (
                  <div style={{ display:'flex', gap:10, borderTop:'1px solid var(--border)', paddingTop:12, marginTop:4 }}>
                    <button className="btn btn-success" onClick={() => handleApprove(p._id)} disabled={processing[p._id]}>
                      {processing[p._id] ? '⏳ Processing…' : '✅ Approve'}
                    </button>
                    <button className="btn btn-danger"
                      onClick={() => { setRejectModal({ open:true, id:p._id, title:p.title }); setRejectReason(''); setRejectErr(''); }}
                      disabled={processing[p._id]}>
                      ❌ Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderSurveys() {
    const surveyStats = {
      total: surveys.length,
      conducting: surveys.filter(s => s.isConductingNow).length,
      published: surveys.filter(s => s.status === 'PUBLISHED').length,
      completed: surveys.filter(s => s.status === 'COMPLETED').length,
      totalResponses: surveys.reduce((sum, s) => sum + (s.responseCount || 0), 0),
    };

    const filteredSurveys = surveys.filter(s => {
      if (surveyFilter === 'LIVE') return s.isConductingNow;
      if (surveyFilter === 'PUBLISHED') return s.status === 'PUBLISHED';
      if (surveyFilter === 'COMPLETED') return s.status === 'COMPLETED';
      if (surveyFilter === 'DRAFT') return s.status === 'DRAFT';
      return true;
    });

    return (
      <div>
        <div className="dash-section-header">
          <div>
            <div className="dash-section-title">Active Surveys & Conduction</div>
            <div className="dash-section-subtitle">Real-time monitoring of all surveys, live conduction status, and response counts</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary btn-sm"
              disabled={pdfLoading}
              onClick={() => handleDownloadPdf('admin-total-analysis-section', 'total-surveys-analytics-report')}
              title="Download total survey analytics overview as PDF"
            >
              {pdfLoading ? '⏳ Generating PDF…' : '📥 Download Total Analysis PDF'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={loadSurveys}>🔄 Refresh</button>
          </div>
        </div>

        {/* Printable Total Analysis Container */}
        <div id="admin-total-analysis-section" style={{ padding: '4px 2px' }}>
          {/* Stats Grid */}
          <div className="dash-stats-grid" style={{ marginBottom: 24 }}>
            {[
              { icon: '📡', val: surveyStats.total, label: 'Total Surveys', color: 'var(--accent-mid)' },
              { icon: '🟢', val: surveyStats.conducting, label: 'Conducting Now (Live)', color: '#047857' },
              { icon: '👥', val: surveyStats.totalResponses, label: 'Responses Collected', color: '#7c3aed' },
              { icon: '🏁', val: surveyStats.completed, label: 'Completed', color: '#b45309' },
            ].map(st => (
              <div key={st.label} className="stat-card">
                <div className="stat-card-icon">{st.icon}</div>
                <div className="stat-card-val" style={{ color: st.color }}>{st.val}</div>
                <div className="stat-card-label">{st.label}</div>
              </div>
            ))}
          </div>

          {/* Filter bar */}
          <div className="dash-card" style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginRight: 6 }}>Filter Status:</span>
            {[
              { key: 'ALL', label: `All (${surveyStats.total})` },
              { key: 'LIVE', label: `🟢 Conducting Now (${surveyStats.conducting})` },
              { key: 'PUBLISHED', label: `📡 Published (${surveyStats.published})` },
              { key: 'COMPLETED', label: `🏁 Completed (${surveyStats.completed})` },
              { key: 'DRAFT', label: `📝 Draft` },
            ].map(f => (
              <button
                key={f.key}
                className={`btn btn-sm ${surveyFilter === f.key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSurveyFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {surveyErr && <div className="alert alert-error">{surveyErr}</div>}
          {surveyLoading && <div className="dash-loading"><div className="dash-spinner"/><span>Loading surveys…</span></div>}

          {!surveyLoading && filteredSurveys.length === 0 && !surveyErr && (
            <div className="dash-empty">
              <div className="dash-empty-icon">📡</div>
              <div className="dash-empty-title">No surveys found</div>
              <div className="dash-empty-desc">There are no surveys matching the selected filter.</div>
            </div>
          )}

          {!surveyLoading && filteredSurveys.length > 0 && (
            <div className="dash-list">
              {filteredSurveys.map(s => (
                <div key={s._id} className="dash-list-item" style={{ borderLeft: s.isConductingNow ? '4px solid #10b981' : undefined }}>
                  <div className="dash-list-item-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span className="dash-list-item-title" style={{ margin: 0 }}>{s.title}</span>
                      <StatusBadge status={s.status} />
                      {s.isConductingNow && (
                        <span className="badge" style={{ background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', fontWeight: 600 }}>
                          🟢 Conducting Now (Live)
                        </span>
                      )}
                      <span className="badge" style={{ background: '#ede9fe', color: '#5b21b6' }}>
                        ID: {s.surveyId}
                      </span>
                    </div>

                    <div className="dash-list-item-meta" style={{ flexWrap: 'wrap', gap: '8px 16px', marginTop: 6 }}>
                      <span>👤 <strong>Surveyor:</strong> {s.surveyerUserId?.name || 'Unknown'} {s.surveyerId ? `(${s.surveyerId})` : ''}</span>
                      <span>📍 <strong>Location:</strong> {s.location?.city} {s.location?.radius ? `(±${s.location.radius}km)` : ''}</span>
                      <span>👥 <strong>Responses:</strong> <span style={{ fontWeight: 700, color: 'var(--accent-mid)' }}>{s.responseCount || 0}</span> collected</span>
                      <span>❓ <strong>Questions:</strong> {s.questions?.length || 0}</span>
                      <span>🕑 <strong>Window:</strong> {new Date(s.startTime).toLocaleString()} – {new Date(s.endTime).toLocaleString()}</span>
                    </div>

                    {s.description && (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
                        {s.description.length > 150 ? `${s.description.slice(0, 150)}…` : s.description}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => openSurveyAnalysis(s)}
                      disabled={surveyLoading}
                      title="View Comprehensive Survey Analysis & Export PDF"
                    >
                      📊 View Survey Analysis
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderAccounts() {
    return (
      <div>
        <div className="dash-section-header">
          <div>
            <div className="dash-section-title">Manage Accounts</div>
            <div className="dash-section-subtitle">All registered users and their current roles</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={loadUsers}>🔄 Refresh</button>
        </div>

        {/* Search + filter bar */}
        <div className="dash-card" style={{ marginBottom:20, display:'flex', flexWrap:'wrap', gap:12, alignItems:'center' }}>
          <input className="form-input" style={{ flex:2, minWidth:200, marginBottom:0 }}
            placeholder="🔍 Search by name, email, or Surveyer ID…"
            value={userSearch} onChange={e => setUserSearch(e.target.value)} />
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {['ALL','USER','SURVEYER','ADMIN'].map(r => (
              <button key={r} className={`btn btn-sm ${roleFilter===r?'btn-primary':'btn-secondary'}`}
                onClick={() => setRoleFilter(r)}>
                {r==='ALL'?'👥 All':r==='USER'?'👤 Users':r==='SURVEYER'?'🔬 Surveyors':'🔐 Admins'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:12 }}>
          {filteredUsers.length} of {users.length} account{users.length!==1?'s':''}
        </div>

        {usersErr && <div className="alert alert-error">{usersErr}</div>}
        {usersLoading && <div className="dash-loading"><div className="dash-spinner"/><span>Loading accounts…</span></div>}

        {!usersLoading && filteredUsers.length === 0 && (
          <div className="dash-empty"><div className="dash-empty-icon">👥</div><div className="dash-empty-title">No accounts found</div></div>
        )}

        {!usersLoading && filteredUsers.length > 0 && (
          <div className="dash-list">
            {filteredUsers.map(u => (
              <div key={u._id} className="dash-list-item" style={{ alignItems:'flex-start' }}>
                <div style={{ display:'flex', alignItems:'center', gap:14, flex:1, minWidth:0, flexWrap:'wrap' }}>
                  {/* Avatar */}
                  <div style={{
                    width:44, height:44, borderRadius:'50%', flexShrink:0,
                    background:`linear-gradient(135deg, ${ROLE_COLORS[u.role]||'#6b7280'}, ${ROLE_COLORS[u.role]||'#9ca3af'}88)`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:'#fff', fontWeight:700, fontSize:16,
                  }}>
                    {u.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)', marginBottom:3 }}>{u.name}</div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:4 }}>{u.email}</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center', fontSize:12 }}>
                      <span className={`badge badge-${u.role==='ADMIN'?'admin':u.role==='SURVEYER'?'surveyer':'user'}`}
                        style={{ fontSize:10, padding:'2px 8px' }}>
                        {u.role}
                      </span>
                      {u.surveyerId && (
                        <span style={{ color:'var(--text-muted)', fontFamily:'monospace', fontSize:11 }}>
                          🔖 ID: {u.surveyerId}
                        </span>
                      )}
                      {u.surveyerStatus && u.surveyerStatus !== 'null' && (
                        <StatusBadge status={u.surveyerStatus}/>
                      )}
                      <span style={{ color:'var(--text-faint)', fontSize:11 }}>
                        🔑 {u.authProvider || 'LOCAL'}
                      </span>
                      <span style={{ color:'var(--text-faint)', fontSize:11 }}>
                        📅 Joined: {new Date(u.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderReports() {
    if (selectedReport) {
      const allReportsTotalResp = (reports || []).reduce((acc, r) => acc + (r?.totalResponses || 0), 0);
      const avgResponsesAcrossReports = reports.length > 0 ? Math.round(allReportsTotalResp / reports.length) : 0;
      const respDelta = (selectedReport.totalResponses || 0) - avgResponsesAcrossReports;
      const isAboveAvg = respDelta >= 0;

      // Rank among reports:
      const sortedReports = [...reports].sort((a, b) => (b?.totalResponses || 0) - (a?.totalResponses || 0));
      const currentRank = sortedReports.findIndex(r => r?._id === selectedReport._id) + 1 || 1;

      // Rating calculations
      const ratingQuestions = (selectedReport.analytics || []).filter(q => q?.type === 'RATING' && q?.average != null);
      const currentAvgRating = ratingQuestions.length > 0
        ? (ratingQuestions.reduce((acc, q) => acc + (parseFloat(q.average) || 0), 0) / ratingQuestions.length).toFixed(1)
        : null;

      // Question counts
      const allQ = (selectedReport.analytics || []).filter(Boolean);
      const ratingQCount = allQ.filter(q => q.type === 'RATING').length;
      const choiceQCount = allQ.filter(q => q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE').length;
      const ynQCount     = allQ.filter(q => q.type === 'YES_NO').length;

      // Filtered questions
      const filteredAnalytics = allQ.filter(q => {
        if (questionFilter === 'RATING') return q.type === 'RATING';
        if (questionFilter === 'CHOICE') return q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE';
        if (questionFilter === 'YES_NO') return q.type === 'YES_NO';
        return true;
      });

      const s = selectedReport.surveyId;
      const locationText = typeof s?.location === 'object' && s?.location !== null
        ? (s.location.city || 'All Regions')
        : (s?.location || 'All Regions');

      return (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedReport(null); setQuestionFilter('ALL'); }}>
              ← Back to Report History
            </button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-primary btn-sm"
                disabled={pdfLoading}
                onClick={() => handleDownloadPdf('admin-report-content', s?.title || selectedReport.reportId)}
                title="Download this comprehensive survey report as PDF"
              >
                {pdfLoading ? '⏳ Generating PDF…' : '📥 Download as PDF'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => window.print()} title="Print document">
                🖨️ Print
              </button>
            </div>
          </div>

          {/* Printable Report Content Container */}
          <div id="admin-report-content" style={{ padding: '4px 2px' }}>
            {/* Report Summary Card */}
            <div className="dash-card" style={{ marginBottom: 20, borderTop: '4px solid var(--accent-mid)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {s?.title || 'Conducted Survey Report'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                    Report ID: <code style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedReport.reportId}</code> · 
                    Survey ID: <code style={{ fontFamily: 'monospace' }}>{s?.surveyId || 'N/A'}</code>
                  </div>
                </div>
                <StatusBadge status={selectedReport.status || 'SUBMITTED'} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Responses</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-mid)', marginTop: 2 }}>{selectedReport.totalResponses || 0}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Submitted / Completed</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                    {safeFormatDate(selectedReport.submittedAt || selectedReport.createdAt)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Target Location</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                    📍 {locationText}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Conducted Window</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                    {safeFormatDate(s?.startTime)} – {safeFormatDate(s?.endTime)}
                  </div>
                </div>
              </div>

              {/* Surveyor Info (Admin specific) */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text-muted)' }}>
                <span>👤 <strong>Surveyor:</strong> {selectedReport.surveyerUserId?.name || 'Surveyor'} ({selectedReport.surveyerUserId?.email || 'N/A'})</span>
                {(selectedReport.surveyerId || selectedReport.surveyerUserId?.surveyerId) && (
                  <span>🔖 <strong>Surveyor ID:</strong> {selectedReport.surveyerId || selectedReport.surveyerUserId?.surveyerId}</span>
                )}
              </div>

              {s?.description && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 14, color: 'var(--text-muted)' }}>
                  <strong>Survey Description:</strong> {s.description}
                </div>
              )}
            </div>

            {/* Comparative Performance Benchmarks Card */}
            <div className="dash-card" style={{ marginBottom: 20, background: 'linear-gradient(135deg, rgba(15,45,110,0.03), rgba(29,78,216,0.05))', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📈 Performance & Historical Benchmark</span>
                <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3', fontSize: 11 }}>
                  Cross-Survey Analysis
                </span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Response Benchmark</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: isAboveAvg ? '#047857' : '#b45309' }}>
                      {isAboveAvg ? `+${respDelta}` : respDelta}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>vs avg ({avgResponsesAcrossReports})</span>
                  </div>
                  <div style={{ fontSize: 11, color: isAboveAvg ? '#047857' : '#b45309', marginTop: 4, fontWeight: 600 }}>
                    {isAboveAvg ? '🔥 Higher than average turnout' : 'Standard turnout volume'}
                  </div>
                </div>

                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Response Volume Rank</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-mid)', marginTop: 4 }}>
                    #{currentRank} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>of {reports.length} survey{reports.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Based on total collected responses
                  </div>
                </div>

                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Average Rating Score</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#d97706', marginTop: 4 }}>
                    {currentAvgRating ? `⭐ ${currentAvgRating} / 5.0` : 'N/A'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {ratingQuestions.length} rating question{ratingQuestions.length !== 1 ? 's' : ''} evaluated
                  </div>
                </div>

                <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Analytical Coverage</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#4f46e5', marginTop: 4 }}>
                    {allQ.length} Questions
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    {ratingQCount} ⭐ · {choiceQCount} 🔘 · {ynQCount} ✅
                  </div>
                </div>
              </div>
            </div>

            {/* Question Analytics Breakdown & Filter Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div className="dash-section-title" style={{ margin: 0 }}>
                📊 Question Analytics Breakdown ({filteredAnalytics.length})
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${questionFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setQuestionFilter('ALL')}
                >
                  All ({allQ.length})
                </button>
                {ratingQCount > 0 && (
                  <button
                    type="button"
                    className={`btn btn-sm ${questionFilter === 'RATING' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setQuestionFilter('RATING')}
                  >
                    ⭐ Ratings ({ratingQCount})
                  </button>
                )}
                {choiceQCount > 0 && (
                  <button
                    type="button"
                    className={`btn btn-sm ${questionFilter === 'CHOICE' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setQuestionFilter('CHOICE')}
                  >
                    🔘 Choices ({choiceQCount})
                  </button>
                )}
                {ynQCount > 0 && (
                  <button
                    type="button"
                    className={`btn btn-sm ${questionFilter === 'YES_NO' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setQuestionFilter('YES_NO')}
                  >
                    ✅ Yes/No ({ynQCount})
                  </button>
                )}
              </div>
            </div>

            {filteredAnalytics.length === 0 ? (
              <div className="alert alert-info">No questions match the selected filter.</div>
            ) : (
              filteredAnalytics.map((q, idx) => (
                <div className="chart-question" key={q.questionId || idx} style={{ marginBottom: 16, background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                    <div className="chart-question-title" style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                      Q{idx + 1}. {q.question}
                    </div>
                    <span className="badge badge-draft" style={{ fontSize: 10 }}>
                      {q.type?.replace('_', ' ')}
                    </span>
                  </div>

                  {q.type === 'RATING' && q.average != null && (
                    <div style={{ marginBottom: 14, padding: '8px 12px', background: '#fef3c7', borderRadius: 8, display: 'inline-block' }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: '#d97706' }}>⭐ {Number(q.average).toFixed(1)} / 5.0</span>
                      <span style={{ fontSize: 12, color: '#92400e', marginLeft: 8 }}>Average Respondent Rating</span>
                    </div>
                  )}

                  {q.results && q.results.length > 0 ? (
                    q.results.map((r, ri) => {
                      const optLabel = typeof r.option === 'object' && r.option !== null
                        ? (r.option.text || r.option.option || JSON.stringify(r.option))
                        : String(r.option ?? (r.rating != null ? `${r.rating} Stars` : ''));
                      const pctNum = Number(r.percentage || 0);

                      return (
                        <div className="chart-bar-row" key={ri} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div className="chart-bar-label" style={{ width: 140, fontSize: 13, fontWeight: 500 }}>
                            {q.type === 'RATING' ? `★ ${optLabel}` : optLabel}
                          </div>
                          <div className="chart-bar-track" style={{ flex: 1, height: 16, background: 'var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                            <div
                              className="chart-bar-fill"
                              style={{
                                width: `${pctNum}%`,
                                height: '100%',
                                background: q.type === 'RATING' ? '#f59e0b' : (optLabel === 'Yes' ? '#10b981' : (optLabel === 'No' ? '#ef4444' : 'var(--accent-mid)')),
                                borderRadius: 8,
                                transition: 'width 0.4s ease',
                              }}
                            />
                          </div>
                          <div className="chart-bar-pct" style={{ width: 110, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>
                            {r.count || 0} ({pctNum.toFixed(1)}%)
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No responses recorded for this question.</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    const historyStats = {
      total: reports.length,
      totalResponses: reports.reduce((acc, r) => acc + (r?.totalResponses || 0), 0),
      submitted: reports.filter(r => r?.status === 'SUBMITTED').length,
    };

    // Selected comparison reports
    const reportA = reports.find(r => r._id === compareIdA) || reports[0] || null;
    const reportB = reports.find(r => r._id === compareIdB) || reports[1] || reports[0] || null;

    return (
      <div>
        <div className="dash-section-header">
          <div>
            <div className="dash-section-title">Report History</div>
            <div className="dash-section-subtitle">All submitted survey reports, comparative cross-survey analytics and archives</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {reports.length >= 2 && (
              <button
                className={`btn btn-sm ${compareMode ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  const next = !compareMode;
                  setCompareMode(next);
                  if (next) {
                    if (!compareIdA && reports[0]) setCompareIdA(reports[0]._id);
                    if (!compareIdB && reports[1]) setCompareIdB(reports[1]._id);
                  }
                }}
              >
                {compareMode ? '✕ Close Comparison' : '🔄 Compare Surveys Side-by-Side'}
              </button>
            )}
            <button
              className="btn btn-primary btn-sm"
              disabled={pdfLoading}
              onClick={() => handleDownloadPdf('admin-report-archive-section', 'total-reports-history-summary')}
              title="Download full report history archive as PDF"
            >
              {pdfLoading ? '⏳ Generating PDF…' : '📥 Download Total Reports PDF'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={loadReports}>🔄 Refresh</button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="dash-stats-grid" style={{ marginBottom: 24 }}>
          <div className="dash-stat">
            <div className="dash-stat-icon">📜</div>
            <div className="dash-stat-val">{historyStats.total}</div>
            <div className="dash-stat-label">Conducted Surveys</div>
          </div>
          <div className="dash-stat">
            <div className="dash-stat-icon">👥</div>
            <div className="dash-stat-val" style={{ color: 'var(--accent-mid)' }}>{historyStats.totalResponses}</div>
            <div className="dash-stat-label">Total Responses Collected</div>
          </div>
          <div className="dash-stat">
            <div className="dash-stat-icon">✅</div>
            <div className="dash-stat-val" style={{ color: '#047857' }}>{historyStats.submitted}</div>
            <div className="dash-stat-label">Submitted Reports</div>
          </div>
        </div>

        {/* Side-by-Side Comparison Feature */}
        {compareMode && reportA && reportB && (
          <div className="dash-card" style={{ marginBottom: 24, border: '2px solid var(--accent-mid)', background: '#fafbff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                  🔄 Side-by-Side Survey Comparison
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Compare key metrics, turnout, and responses across two conducted surveys
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={pdfLoading}
                  onClick={() => handleDownloadPdf('comparison-matrix-content', `survey-comparison-${reportA.reportId}-vs-${reportB.reportId}`)}
                >
                  {pdfLoading ? '⏳ Generating PDF…' : '📥 Download Comparison PDF'}
                </button>
              </div>
            </div>

            {/* Selectors */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, color: 'var(--accent-mid)' }}>🔷 Survey A</label>
                <select
                  className="form-input"
                  value={reportA._id}
                  onChange={e => setCompareIdA(e.target.value)}
                >
                  {reports.map(r => (
                    <option key={r._id} value={r._id}>
                      {r.surveyId?.title || r.reportId} ({r.totalResponses} responses)
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontWeight: 700, color: '#7c3aed' }}>🟣 Survey B</label>
                <select
                  className="form-input"
                  value={reportB._id}
                  onChange={e => setCompareIdB(e.target.value)}
                >
                  {reports.map(r => (
                    <option key={r._id} value={r._id}>
                      {r.surveyId?.title || r.reportId} ({r.totalResponses} responses)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Comparison Matrix Container */}
            <div id="comparison-matrix-content" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', padding: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle, #f8fafc)', borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', width: '28%' }}>Metric / Dimension</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', width: '36%', color: 'var(--accent-mid)', fontWeight: 700 }}>
                      🔷 {reportA.surveyId?.title || reportA.reportId}
                    </th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', width: '36%', color: '#7c3aed', fontWeight: 700 }}>
                      🟣 {reportB.surveyId?.title || reportB.reportId}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Surveyor</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{reportA.surveyerUserId?.name || 'Surveyor'}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{reportB.surveyerUserId?.name || 'Surveyor'}</td>
                  </tr>

                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Total Responses</td>
                    <td style={{ padding: '12px 16px', fontSize: 16, fontWeight: 800, color: 'var(--accent-mid)' }}>
                      {reportA.totalResponses || 0}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 16, fontWeight: 800, color: '#7c3aed' }}>
                      {reportB.totalResponses || 0}
                    </td>
                  </tr>

                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Location</td>
                    <td style={{ padding: '12px 16px' }}>📍 {reportA.surveyId?.location?.city || 'Local Area'}</td>
                    <td style={{ padding: '12px 16px' }}>📍 {reportB.surveyId?.location?.city || 'Local Area'}</td>
                  </tr>

                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Questions Analyzed</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{reportA.analytics?.length || 0} Questions</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{reportB.analytics?.length || 0} Questions</td>
                  </tr>

                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Report Submitted</td>
                    <td style={{ padding: '12px 16px' }}>
                      {safeFormatDate(reportA.submittedAt || reportA.createdAt)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {safeFormatDate(reportB.submittedAt || reportB.createdAt)}
                    </td>
                  </tr>

                  <tr>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Action</td>
                    <td style={{ padding: '12px 16px' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openReportAnalysis(reportA)}>
                        View Survey A Report
                      </button>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openReportAnalysis(reportB)}>
                        View Survey B Report
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {repErr && <div className="alert alert-error">{repErr}</div>}
        {repLoading && <div className="dash-loading"><div className="dash-spinner"/><span>Loading reports…</span></div>}

        {!repLoading && reports.length === 0 && !repErr && (
          <div className="dash-empty">
            <div className="dash-empty-icon">📄</div>
            <div className="dash-empty-title">No reports yet</div>
            <div className="dash-empty-desc">Reports appear here once surveyors submit their post-survey summaries.</div>
          </div>
        )}

        {!repLoading && reports.length > 0 && (
          <div id="admin-report-archive-section" style={{ padding: '4px 2px' }}>
            <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:12 }}>
              {reports.length} report{reports.length!==1?'s':''}
            </div>
            {reports.map(r => {
              const s = r.surveyId;
              return (
                <div key={r._id} className="dash-card" style={{ marginBottom:12, borderLeft: '4px solid var(--accent-mid)' }}>
                  {/* Header row */}
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:15, color:'var(--text-primary)', marginBottom:4 }}>
                        {s?.title || 'Survey'}
                        <span style={{ marginLeft:10, fontSize:12, fontFamily:'monospace', color:'var(--text-muted)' }}>
                          {s?.surveyId || r.reportId}
                        </span>
                      </div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:10, fontSize:12, color:'var(--text-muted)' }}>
                        <StatusBadge status={r.status}/>
                        <span>👤 {r.surveyerUserId?.name} ({r.surveyerUserId?.email})</span>
                        {r.surveyerUserId?.surveyerId && <span>🔖 {r.surveyerUserId.surveyerId}</span>}
                        <span>📍 {s?.location?.city || 'Local Region'}</span>
                        <span>👥 <strong>Responses:</strong> <strong style={{ color: 'var(--accent-mid)' }}>{r.totalResponses || 0}</strong></span>
                        <span>❓ <strong>Questions:</strong> {r.analytics?.length || s?.questions?.length || 0}</span>
                        <span>📅 Submitted: {safeFormatDate(r.submittedAt || r.createdAt)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => openReportAnalysis(r)}
                        title="Open Full Survey Analysis, Breakdown & Download PDF"
                      >
                        📊 View Report Analysis
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const renderSection = () => {
    if (section === 'proposals') return renderProposals();
    if (section === 'surveys')   return renderSurveys();
    if (section === 'accounts')  return renderAccounts();
    if (section === 'reports')   return renderReports();
    if (section === 'profile')   return <ProfilePage onBack={() => setSection('proposals')} />;
    return null;
  };

  return (
    <div className="dash-root">
      <Navbar title="Admin" />

      <div className="dash-body">
        {/* Sidebar */}
        <div className="dash-sidebar">
          <div className="dash-sidebar-label">Navigation</div>
          {SECTIONS.map(s => (
            <button key={s.key}
              className={`dash-sidebar-btn${section===s.key?' active':''}`}
              onClick={() => setSection(s.key)}>
              <span className="dash-sidebar-icon">{s.icon}</span> {s.label}
            </button>
          ))}
          <ProfilePanel onManage={() => setSection('profile')} />
        </div>

        {/* Main */}
        <div className="dash-main">
          {renderSection()}
          <DashboardFooter />
        </div>
      </div>

      {/* Reject modal */}
      {rejectModal.open && (
        <div className="dash-modal-overlay"
          onClick={e => { if (e.target===e.currentTarget) setRejectModal({open:false,id:null,title:''}); }}>
          <div className="dash-modal">
            <div className="dash-modal-title">❌ Reject Proposal</div>
            <div className="dash-modal-desc">
              Rejecting: <strong>{rejectModal.title}</strong><br/>
              Please provide a clear reason. The applicant will be notified.
            </div>
            <div className="form-group">
              <label className="form-label">Rejection Reason *</label>
              <textarea className="form-textarea" style={{ minHeight:100 }}
                placeholder="e.g. The proposal lacks sufficient detail…"
                value={rejectReason} onChange={e => setRejectReason(e.target.value)} autoFocus />
            </div>
            {rejectErr && <div className="alert alert-error" style={{ marginTop:8 }}>⚠️ {rejectErr}</div>}
            <div className="dash-modal-actions">
              <button className="btn btn-secondary" onClick={() => setRejectModal({open:false,id:null,title:''})}>Cancel</button>
              <button className="btn btn-danger" onClick={handleReject} disabled={rejectLoading}>
                {rejectLoading ? '⏳ Rejecting…' : '❌ Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Survey Modal */}
      {inspectSurvey && (
        <div className="dash-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setInspectSurvey(null); }}>
          <div className="dash-modal" style={{ maxWidth: 680, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div className="dash-modal-title" style={{ marginBottom: 4 }}>📋 {inspectSurvey.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Survey ID: <code>{inspectSurvey.surveyId}</code> · Location: <strong>{inspectSurvey.location?.city}</strong>
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setInspectSurvey(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              <StatusBadge status={inspectSurvey.status} />
              {inspectSurvey.isConductingNow && (
                <span className="badge" style={{ background: '#d1fae5', color: '#065f46' }}>🟢 Conducting Now</span>
              )}
              <span className="badge" style={{ background: '#ede9fe', color: '#5b21b6' }}>
                👥 {inspectSurvey.responseCount || 0} Responses
              </span>
              <span className="badge" style={{ background: '#f3f4f6', color: '#374151' }}>
                👤 {inspectSurvey.surveyerUserId?.name || 'Surveyor'} ({inspectSurvey.surveyerId || 'N/A'})
              </span>
            </div>

            {inspectSurvey.description && (
              <div style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 8, fontSize: 14, marginBottom: 16 }}>
                <strong>Description:</strong> {inspectSurvey.description}
              </div>
            )}

            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
              Survey Questions ({inspectSurvey.questions?.length || 0}):
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(inspectSurvey.questions || []).map((q, idx) => (
                <div key={q.questionId || idx} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                      Q{idx + 1}. {q.text}
                    </span>
                    <span className="badge badge-draft" style={{ fontSize: 11 }}>
                      {q.type}
                    </span>
                  </div>
                  {q.options && q.options.length > 0 && (
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text-muted)' }}>
                      {q.options.map(opt => (
                        <li key={opt.optionId}>{opt.text}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            <div className="dash-modal-actions" style={{ marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => setInspectSurvey(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
