import { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import ProfilePanel from '../components/ProfilePanel';
import ProfilePage from '../components/ProfilePage';
import DashboardFooter from '../components/DashboardFooter';
import api from '../api/axios';
import { exportElementToPdf } from '../utils/generatePdf';
import '../styles/dashboard.css';

const SECTIONS = [
  { key: 'proposals', icon: '📋', label: 'My Proposals' },
  { key: 'history',   icon: '📜', label: 'Survey History' },
  { key: 'submit',    icon: '➕', label: 'Submit Proposal' },
  { key: 'search',    icon: '🔍', label: 'Search Surveys' },
  { key: 'surveys',   icon: '📍', label: 'Nearby Surveys' },
];

function genId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
}

function StatusBadge({ status }) {
  const map = {
    PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected',
    DRAFT: 'draft', PUBLISHED: 'published', COMPLETED: 'completed',
    SUBMITTED: 'submitted',
  };
  const icons = {
    PENDING: '⏳', APPROVED: '✅', REJECTED: '❌',
    DRAFT: '📝', PUBLISHED: '📡', COMPLETED: '🏁',
    SUBMITTED: '📤',
  };
  return (
    <span className={`badge badge-${map[status] || 'draft'}`}>
      {icons[status] || '•'} {status}
    </span>
  );
}

function getTodayDateString() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function getDefaultEndDateString() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

const emptyProposal = {
  title: '', description: '', purpose: '',
  city: '', latitude: '', longitude: '',
  startDate: getTodayDateString(),
  endDate: getDefaultEndDateString(),
};

export default function UserDashboard() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const queryTab = new URLSearchParams(window.location.search).get('tab');
  const [section, setSection] = useState(queryTab === 'history' ? 'history' : 'proposals');

  // ── Survey History / Reports ──
  const [reports, setReports]                 = useState([]);
  const [repLoading, setRepLoading]           = useState(false);
  const [repErr, setRepErr]                   = useState('');
  const [selectedReport, setSelectedReport]   = useState(null);
  const [pdfLoading, setPdfLoading]           = useState(false);
  const [questionFilter, setQuestionFilter]   = useState('ALL');
  const [compareMode, setCompareMode]         = useState(false);
  const [compareIdA, setCompareIdA]           = useState('');
  const [compareIdB, setCompareIdB]           = useState('');

  // ── Proposals ──
  const [proposals, setProposals] = useState([]);
  const [propLoading, setPropLoading] = useState(true);
  const [propError, setPropError] = useState('');
  const [startLoading, setStartLoading] = useState(false);

  // ── Submit form ──
  const [form, setForm] = useState(emptyProposal);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState('');
  const [submitErr, setSubmitErr] = useState('');
  const [propLocDetecting, setPropLocDetecting] = useState(false);
  const [propLocErr, setPropLocErr] = useState('');

  // ── Surveys (nearby) ──
  const [surveys, setSurveys] = useState([]);
  const [surveyLoading, setSurveyLoading] = useState(false);
  const [surveyErr, setSurveyErr] = useState('');
  const [locLoading, setLocLoading] = useState(false);
  const [myLoc, setMyLoc] = useState(null);

  // ── Search surveys ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchErr, setSearchErr] = useState('');
  const [searchDone, setSearchDone] = useState(false);
  // Nearby filter
  const [nearbyFilter, setNearbyFilter] = useState('all'); // 'all' | 'open' | 'starting'

  // ── Participation ──
  const [activeSurvey, setActiveSurvey] = useState(null);
  const [partLoading, setPartLoading] = useState(false);
  const [partErr, setPartErr] = useState('');
  const [answers, setAnswers] = useState({});
  const [partSubmitting, setPartSubmitting] = useState(false);
  const [partSuccess, setPartSuccess] = useState('');

  // Auto-location refresh interval ref
  const locIntervalRef = useRef(null);

  useEffect(() => {
    loadProposals();
    // Auto-detect location on mount
    autoDetectAndLoad();

    // Refresh nearby surveys every 3 minutes
    locIntervalRef.current = setInterval(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => loadNearbySurveys(pos.coords.latitude, pos.coords.longitude),
          () => {} // silent fail on refresh
        );
      }
    }, 3 * 60 * 1000);

    return () => clearInterval(locIntervalRef.current);
  }, []);

  async function autoDetectAndLoad() {
    if (!navigator.geolocation) return;
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setMyLoc({ latitude, longitude });
        setLocLoading(false);
        loadNearbySurveys(latitude, longitude);
      },
      () => setLocLoading(false),
      { timeout: 10000 }
    );
  }

  async function loadProposals() {
    setPropLoading(true);
    setPropError('');
    try {
      const { data } = await api.get('/proposals/my');
      const list = data.proposals || [];
      setProposals(list);
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }
    } catch {
      setPropError('Failed to load proposals.');
    } finally {
      setPropLoading(false);
    }
  }

  async function handleStartSurvey(p) {
    if (!p || !p._id) return;
    setStartLoading(true);
    try {
      const { data } = await api.post(`/proposals/${p._id}/start-survey`);
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }
      window.location.href = '/dashboard/surveyer';
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to start survey. Please try again.');
      setStartLoading(false);
    }
  }

  useEffect(() => {
    if (section === 'history' && reports.length === 0) {
      loadMyReports();
    }
  }, [section]);

  async function loadMyReports() {
    setRepLoading(true);
    setRepErr('');
    try {
      const { data } = await api.get('/reports/my');
      setReports(data.reports || []);
    } catch (err) {
      setRepErr(err.response?.data?.message || 'Failed to load your survey reports.');
    } finally {
      setRepLoading(false);
    }
  }

  async function handleDownloadPdf(elementId, title) {
    setPdfLoading(true);
    try {
      const cleanName = (title || 'survey-report')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      await exportElementToPdf(elementId, `${cleanName || 'survey-report'}.pdf`);
    } catch (e) {
      console.error('PDF download error:', e);
    } finally {
      setPdfLoading(false);
    }
  }

  /* ── Auto-fill proposal location via browser geolocation ── */
  async function detectProposalLocation() {
    if (!navigator.geolocation) {
      setPropLocErr('Geolocation not supported by your browser.');
      return;
    }
    setPropLocDetecting(true);
    setPropLocErr('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let city = '';
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const geo = await res.json();
          city = geo.address?.city
               || geo.address?.town
               || geo.address?.village
               || geo.address?.county
               || '';
        } catch {
          // city stays empty — user can type it manually
        }
        setForm(prev => ({
          ...prev,
          city: city || prev.city,
          latitude: latitude.toFixed(6),
          longitude: longitude.toFixed(6),
        }));
        setPropLocDetecting(false);
      },
      () => {
        setPropLocErr('Location access denied. Please allow location or enter coordinates manually.');
        setPropLocDetecting(false);
      },
      { timeout: 10000 }
    );
  }

  async function handleSubmitProposal(e) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitErr('');
    setSubmitMsg('');
    try {
      await api.post('/proposals', {
        title: form.title,
        description: form.description,
        purpose: form.purpose,
        location: {
          city: form.city,
          latitude: parseFloat(form.latitude),
          longitude: parseFloat(form.longitude),
        },
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
      });
      setSubmitMsg('Proposal submitted! The admin will review it soon.');
      setForm(emptyProposal);
      await loadProposals();
      setTimeout(() => setSection('proposals'), 1500);
    } catch (err) {
      setSubmitErr(err.response?.data?.message || 'Failed to submit proposal.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleGetLocation() {
    if (!navigator.geolocation) {
      setSurveyErr('Geolocation is not supported by your browser.');
      return;
    }
    setLocLoading(true);
    setSurveyErr('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setMyLoc({ latitude, longitude });
        setLocLoading(false);
        loadNearbySurveys(latitude, longitude);
      },
      () => {
        setSurveyErr('Location access denied. Please allow location and try again.');
        setLocLoading(false);
      }
    );
  }

  async function loadNearbySurveys(lat, lng) {
    setSurveyLoading(true);
    setSurveyErr('');
    try {
      const { data } = await api.get(`/surveys/available?lat=${lat}&lng=${lng}`);
      setSurveys(data.surveys || []);
      if ((data.surveys || []).length === 0) setSurveyErr('No active surveys found near your location.');
    } catch (err) {
      setSurveyErr(err.response?.data?.message || 'Failed to fetch nearby surveys.');
    } finally {
      setSurveyLoading(false);
    }
  }

  async function handleParticipate(surveyId) {
    if (!myLoc) return;
    setPartLoading(true);
    setPartErr('');
    setActiveSurvey(null);
    setAnswers({});
    setPartSuccess('');
    try {
      const { data } = await api.get(
        `/surveys/${surveyId}/participate?lat=${myLoc.latitude}&lng=${myLoc.longitude}`
      );
      setActiveSurvey(data.survey);
    } catch (err) {
      setPartErr(err.response?.data?.message || 'Cannot open this survey.');
    } finally {
      setPartLoading(false);
    }
  }

  async function handleSubmitResponse() {
    if (!activeSurvey || !myLoc) return;
    setPartErr('');

    // Pre-validate required questions
    for (const q of (activeSurvey.questions || [])) {
      if (q.required) {
        const ans = answers[q.questionId];
        const missing = ans === undefined || ans === null || ans === '' ||
          (Array.isArray(ans) && ans.length === 0);
        if (missing) {
          setPartErr(`Please answer required question: "${q.text}"`);
          return;
        }
      }
    }

    setPartSubmitting(true);
    const answersArr = Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }));
    try {
      await api.post(
        `/surveys/${activeSurvey.id}/responses?lat=${myLoc.latitude}&lng=${myLoc.longitude}`,
        { answers: answersArr }
      );
      setPartSuccess('Response submitted! Thank you for participating.');
      setActiveSurvey(null);
      setAnswers({});
    } catch (err) {
      setPartErr(err.response?.data?.message || 'Failed to submit response.');
    } finally {
      setPartSubmitting(false);
    }
  }

  function renderProposals() {
    if (propLoading) return <div className="dash-loading"><div className="dash-spinner" /><span>Loading proposals…</span></div>;
    if (propError) return <div className="alert alert-error">⚠️ {propError}</div>;
    if (proposals.length === 0) return (
      <div className="dash-empty">
        <div className="dash-empty-icon">📋</div>
        <div className="dash-empty-title">No proposals yet</div>
        <div className="dash-empty-desc">Submit a proposal to become a Surveyer and run your own survey.</div>
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setSection('submit')}>
          Submit Your First Proposal
        </button>
      </div>
    );

    return (
      <div>
        <div className="dash-section-header">
          <div>
            <div className="dash-section-title">My Proposals</div>
            <div className="dash-section-subtitle">{proposals.length} proposal{proposals.length !== 1 ? 's' : ''} submitted</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setSection('submit')}>
            + New Proposal
          </button>
        </div>

        {/* Notice for approved proposals */}
        {proposals.some(p => p.status === 'APPROVED') && (
          <div className="alert alert-success" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <strong>🎉 Proposal Approved!</strong>
              <div style={{ fontSize: 13, marginTop: 2 }}>You are authorized to start and conduct your survey. Click below to begin.</div>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleStartSurvey(proposals.find(p => p.status === 'APPROVED'))}
              disabled={startLoading}
            >
              {startLoading ? '⏳ Starting…' : '🚀 Start Survey Now'}
            </button>
          </div>
        )}

        <div className="dash-list">
          {proposals.map(p => (
            <div
              className="dash-list-item"
              key={p._id}
              style={{
                borderLeft:
                  p.status === 'COMPLETED' ? '4px solid var(--accent-mid)' :
                  p.status === 'APPROVED' ? '4px solid #10b981' :
                  p.status === 'REJECTED' ? '4px solid #ef4444' : '4px solid #f59e0b',
                alignItems: 'center',
              }}
            >
              <div className="dash-list-item-info">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span className="dash-list-item-title" style={{ margin: 0 }}>{p.title}</span>
                  <StatusBadge status={p.status} />
                  {p.status === 'COMPLETED' && (
                    <span className="badge" style={{ background: '#ede9fe', color: '#5b21b6' }}>
                      🔒 Project Completed & Finalized
                    </span>
                  )}
                  {p.status === 'APPROVED' && (
                    <span className="badge" style={{ background: '#d1fae5', color: '#065f46' }}>
                      ⚡ Conduction Ready
                    </span>
                  )}
                  {p.status === 'PENDING' && (
                    <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>
                      ⏳ Under Approval Review
                    </span>
                  )}
                </div>

                <div className="dash-list-item-meta" style={{ flexWrap: 'wrap', gap: '8px 16px', marginTop: 6 }}>
                  <span>📍 <strong>Target City:</strong> {p.location?.city}</span>
                  <span>📅 <strong>Scheduled:</strong> {new Date(p.startDate).toLocaleDateString()} – {new Date(p.endDate).toLocaleDateString()}</span>
                  <span style={{ color: 'var(--text-faint)' }}>Submitted {new Date(p.createdAt).toLocaleDateString()}</span>
                </div>

                {p.description && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
                    {p.description.length > 150 ? `${p.description.slice(0, 150)}…` : p.description}
                  </div>
                )}

                {p.status === 'COMPLETED' && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                    ℹ️ This survey project is completed. Once a project completes, its survey is locked and cannot be re-conducted. You can review its full report below.
                  </div>
                )}

                {p.status === 'REJECTED' && p.rejectionReason && (
                  <div className="alert alert-error" style={{ marginTop: 10, fontSize: 12 }}>
                    Rejection reason: {p.rejectionReason}
                  </div>
                )}
              </div>

              <div className="dash-list-item-actions">
                {p.status === 'COMPLETED' && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setSection('history');
                      if (p.report) setSelectedReport(p.report);
                    }}
                  >
                    📊 View Completed Report
                  </button>
                )}
                {p.status === 'APPROVED' && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleStartSurvey(p)}
                    disabled={startLoading}
                    title="Start designing and conducting this survey"
                  >
                    {startLoading ? '⏳ Starting…' : '🚀 Start Survey'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderSubmitForm() {
    return (
      <div>
        <div className="dash-section-header">
          <div>
            <div className="dash-section-title">Submit a Proposal</div>
            <div className="dash-section-subtitle">Request authorization to conduct a survey in your area</div>
          </div>
        </div>
        <div className="dash-card">
          <form className="dash-form" onSubmit={handleSubmitProposal}>
            <div className="form-group">
              <label className="form-label">Proposal Title *</label>
              <input className="form-input" placeholder="e.g. Public Transport Satisfaction Survey" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Description *</label>
              <textarea className="form-textarea" placeholder="Describe your survey plan in detail…" required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Purpose / Objectives *</label>
              <textarea className="form-textarea" style={{ minHeight: 72 }} placeholder="What do you aim to achieve with this survey?" required value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="form-label" style={{ marginBottom: 0 }}>Location *</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={detectProposalLocation}
                disabled={propLocDetecting}
                style={{ fontSize: 12 }}
              >
                {propLocDetecting ? '📡 Detecting…' : '📍 Use My Current Location'}
              </button>
            </div>
            {propLocErr && <div className="alert alert-error" style={{ marginBottom: 8, fontSize: 12 }}>⚠️ {propLocErr}</div>}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">City *</label>
                <input className="form-input" placeholder="e.g. Chennai" required value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Latitude *</label>
                <input className="form-input" type="number" step="any" placeholder="Auto-filled or enter manually" required value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} readOnly={propLocDetecting} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Longitude *</label>
                <input className="form-input" type="number" step="any" placeholder="Auto-filled or enter manually" required value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} readOnly={propLocDetecting} />
              </div>
              <div className="form-group" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Start Date *</label>
                <input className="form-input" type="date" required value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">End Date *</label>
                <input className="form-input" type="date" required value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>

            {submitErr && <div className="alert alert-error">⚠️ {submitErr}</div>}
            {submitMsg && <div className="alert alert-success">✅ {submitMsg}</div>}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setSection('proposals')}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
                {submitting ? '⏳ Submitting…' : '🚀 Submit Proposal'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderSurveys() {
    return (
      <div>
        <div className="dash-section-header">
          <div>
            <div className="dash-section-title">Nearby Surveys</div>
            <div className="dash-section-subtitle">Participate in surveys active in your area</div>
          </div>
          <button className="btn btn-primary" onClick={handleGetLocation} disabled={locLoading}>
            {locLoading ? '📡 Detecting…' : '📍 Find Surveys Near Me'}
          </button>
        </div>

        {partSuccess && <div className="alert alert-success" style={{ marginBottom: 16 }}>✅ {partSuccess}</div>}
        {surveyErr && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {surveyErr}</div>}

        {/* Active survey participation */}
        {partLoading && <div className="dash-loading"><div className="dash-spinner" /><span>Loading survey…</span></div>}

        {activeSurvey && !partLoading && (
          <div>
            <div className="dash-card" style={{ marginBottom: 20, background: 'var(--accent-bg)', borderColor: 'var(--accent-mid)' }}>
              <div className="dash-card-title">📝 {activeSurvey.title}</div>
              <div className="dash-card-subtitle">{activeSurvey.description}</div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                📍 {activeSurvey.location} · Ends {new Date(activeSurvey.endTime).toLocaleString()}
              </span>
            </div>

            {activeSurvey.questions.map((q, qi) => (
              <div className="question-block" key={q.questionId}>
                <div className="question-block-text">
                  <span style={{ color: 'var(--text-faint)', fontSize: 12, display: 'block', marginBottom: 4 }}>
                    Q{qi + 1} · {q.type.replace('_', ' ')} {q.required && <span style={{ color: '#dc2626' }}>*</span>}
                  </span>
                  {q.text}
                </div>

                {(q.type === 'SINGLE_CHOICE') && q.options.map(opt => (
                  <div key={opt.optionId} className={`option-choice ${answers[q.questionId] === opt.text ? 'selected' : ''}`}
                    onClick={() => setAnswers({ ...answers, [q.questionId]: opt.text })}>
                    <span>{answers[q.questionId] === opt.text ? '🔵' : '⚪'}</span> {opt.text}
                  </div>
                ))}

                {q.type === 'YES_NO' && ['Yes', 'No'].map(opt => (
                  <div key={opt} className={`option-choice ${answers[q.questionId] === opt ? 'selected' : ''}`}
                    onClick={() => setAnswers({ ...answers, [q.questionId]: opt })}>
                    <span>{answers[q.questionId] === opt ? '🔵' : '⚪'}</span> {opt}
                  </div>
                ))}

                {q.type === 'MULTIPLE_CHOICE' && q.options.map(opt => {
                  const sel = (answers[q.questionId] || []).includes(opt.text);
                  return (
                    <div key={opt.optionId} className={`option-choice ${sel ? 'selected' : ''}`}
                      onClick={() => {
                        const cur = answers[q.questionId] || [];
                        setAnswers({ ...answers, [q.questionId]: sel ? cur.filter(x => x !== opt.text) : [...cur, opt.text] });
                      }}>
                      <span>{sel ? '☑️' : '☐'}</span> {opt.text}
                    </div>
                  );
                })}

                {q.type === 'RATING' && (
                  <div className="star-row">
                    {[1, 2, 3, 4, 5].map(s => (
                      <button key={s} className={`star-btn ${(answers[q.questionId] || 0) >= s ? 'lit' : ''}`}
                        onClick={() => setAnswers({ ...answers, [q.questionId]: s })}>★</button>
                    ))}
                    {answers[q.questionId] && (
                      <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--text-muted)' }}>
                        {answers[q.questionId]}/5
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}

            {partErr && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {partErr}</div>}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => { setActiveSurvey(null); setPartErr(''); }}>
                ← Cancel
              </button>
              <button className="btn btn-primary btn-lg" onClick={handleSubmitResponse} disabled={partSubmitting}>
                {partSubmitting ? '⏳ Submitting…' : '✅ Submit Response'}
              </button>
            </div>
          </div>
        )}

        {/* Surveys list */}
        {!activeSurvey && surveyLoading && (
          <div className="dash-loading"><div className="dash-spinner" /><span>Finding surveys…</span></div>
        )}
        {!activeSurvey && !surveyLoading && surveys.length > 0 && (() => {
          const now = new Date();
          const filtered = surveys.filter(s => {
            if (nearbyFilter === 'open')     return new Date(s.endTime) > now && new Date(s.startTime) <= now;
            if (nearbyFilter === 'starting') return new Date(s.startTime) > now;
            return true; // 'all'
          });
          return (
            <div>
              {/* Filter chips */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                {[
                  { key: 'all',      label: '🗂 All' },
                  { key: 'open',     label: '🟢 Active Now' },
                  { key: 'starting', label: '⏰ Starting Soon' },
                ].map(f => (
                  <button key={f.key}
                    className={`btn btn-sm ${nearbyFilter === f.key ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setNearbyFilter(f.key)}>
                    {f.label}
                  </button>
                ))}
                <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center', marginLeft: 4 }}>
                  {filtered.length} survey{filtered.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="dash-list">
                {filtered.map(s => (
                  <div className="dash-list-item" key={s._id}>
                    <div className="dash-list-item-info">
                      <div className="dash-list-item-title">{s.title}</div>
                      <div className="dash-list-item-meta">
                        <span className="badge badge-published">📡 ACTIVE</span>
                        <span>📍 {s.location?.city} — {s.distanceKm} km away</span>
                        <span>🕑 Ends {new Date(s.endTime).toLocaleString()}</span>
                      </div>
                      {s.description && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>{s.description}</div>}
                    </div>
                    <div className="dash-list-item-actions">
                      <button className="btn btn-primary btn-sm" onClick={() => handleParticipate(s._id)}>
                        Take Survey →
                      </button>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div className="dash-empty" style={{ padding: '24px 0' }}>
                    <div className="dash-empty-icon">🔍</div>
                    <div className="dash-empty-title">No surveys match this filter</div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
        {!activeSurvey && !surveyLoading && surveys.length === 0 && myLoc && !surveyErr && (
          <div className="dash-empty">
            <div className="dash-empty-icon">🗺️</div>
            <div className="dash-empty-title">No surveys nearby</div>
            <div className="dash-empty-desc">There are no active surveys in your area right now. Check back later!</div>
          </div>
        )}
        {!myLoc && !surveyLoading && surveys.length === 0 && !surveyErr && (
          <div className="dash-empty">
            <div className="dash-empty-icon">📍</div>
            <div className="dash-empty-title">Share your location</div>
            <div className="dash-empty-desc">Click the button above to detect your location and find surveys near you.</div>
          </div>
        )}
      </div>
    );
  }

  /* ─── Search Surveys ─────────────────────────────────── */
  async function searchSurveys(e) {
    e && e.preventDefault();
    setSearchLoading(true);
    setSearchErr('');
    setSearchDone(false);
    setSearchResults([]);
    try {
      const res = await fetch('/api/public/surveys/all');
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Search failed.');
      let results = data.surveys || [];
      // City filter
      if (searchCity.trim()) {
        const c = searchCity.toLowerCase();
        results = results.filter(s =>
          (s.location?.city || '').toLowerCase().includes(c)
        );
      }
      // Keyword filter
      if (searchQuery.trim()) {
        const kw = searchQuery.toLowerCase();
        results = results.filter(s =>
          s.title.toLowerCase().includes(kw) ||
          (s.description || '').toLowerCase().includes(kw)
        );
      }
      setSearchResults(results);
    } catch (err) {
      setSearchErr(err.message);
    } finally {
      setSearchLoading(false);
      setSearchDone(true);
    }
  }

  function renderSearch() {
    return (
      <div>
        <div className="dash-section-header">
          <div>
            <div className="dash-section-title">Search Surveys</div>
            <div className="dash-section-subtitle">Find active surveys by keyword or city</div>
          </div>
        </div>

        <div className="dash-card" style={{ marginBottom: 20 }}>
          <form onSubmit={searchSurveys} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 2, minWidth: 180, marginBottom: 0 }}>
              <label className="form-label">Keyword</label>
              <input className="form-input" placeholder="e.g. road, health, transport…"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 140, marginBottom: 0 }}>
              <label className="form-label">City</label>
              <input className="form-input" placeholder="e.g. Chennai"
                value={searchCity} onChange={e => setSearchCity(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={searchLoading} style={{ marginBottom: 0 }}>
              {searchLoading ? '⏳ Searching…' : '🔍 Search'}
            </button>
            {searchDone && (
              <button type="button" className="btn btn-secondary" style={{ marginBottom: 0 }}
                onClick={() => { setSearchQuery(''); setSearchCity(''); setSearchResults([]); setSearchDone(false); }}>
                ✕ Clear
              </button>
            )}
          </form>
        </div>

        {searchErr && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {searchErr}</div>}

        {searchDone && (
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              {searchResults.length > 0
                ? `Found ${searchResults.length} survey${searchResults.length !== 1 ? 's' : ''}`
                : 'No surveys matched your search. Try different keywords.'}
            </div>
            <div className="dash-list">
              {searchResults.map(s => (
                <div className="dash-list-item" key={s.surveyId}>
                  <div className="dash-list-item-info">
                    <div className="dash-list-item-title">{s.title}</div>
                    <div className="dash-list-item-meta">
                      <span>📍 {s.location?.city || s.location}</span>
                      <span>🕑 Closes: {new Date(s.endTime).toLocaleDateString()}</span>
                      <span>❓ {s.questions?.length} questions</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineClamp: 2 }}>
                      {s.description?.slice(0, 120)}{s.description?.length > 120 ? '…' : ''}
                    </div>
                  </div>
                  <div className="dash-list-item-actions">
                    <a href={`/survey/${s.surveyId}`} target="_blank" rel="noopener noreferrer"
                      className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
                      📝 Take Survey
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!searchDone && (
          <div className="dash-empty">
            <div className="dash-empty-icon">🔍</div>
            <div className="dash-empty-title">Find a survey</div>
            <div className="dash-empty-desc">Enter a keyword or city name above to find active surveys you can participate in.</div>
          </div>
        )}
      </div>
    );
  }

  /* ══════════════ SURVEY HISTORY & PREVIOUS REPORTS ══════════════ */
  function renderHistory() {
    if (selectedReport) {
      const allReportsTotalResp = reports.reduce((acc, r) => acc + (r.totalResponses || 0), 0);
      const avgResponsesAcrossReports = reports.length > 0 ? Math.round(allReportsTotalResp / reports.length) : 0;
      const respDelta = (selectedReport.totalResponses || 0) - avgResponsesAcrossReports;
      const isAboveAvg = respDelta >= 0;

      // Rank among user's surveys:
      const sortedReports = [...reports].sort((a, b) => (b.totalResponses || 0) - (a.totalResponses || 0));
      const currentRank = sortedReports.findIndex(r => r._id === selectedReport._id) + 1;

      // Rating calculations
      const ratingQuestions = (selectedReport.analytics || []).filter(q => q.type === 'RATING' && q.average);
      const currentAvgRating = ratingQuestions.length > 0
        ? (ratingQuestions.reduce((acc, q) => acc + parseFloat(q.average), 0) / ratingQuestions.length).toFixed(1)
        : null;

      // Question counts
      const allQ = selectedReport.analytics || [];
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

      return (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedReport(null); setQuestionFilter('ALL'); }}>
              ← Back to Survey History
            </button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-primary btn-sm"
                disabled={pdfLoading}
                onClick={() => handleDownloadPdf('user-report-content', selectedReport.surveyId?.title || selectedReport.reportId)}
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
          <div id="user-report-content" style={{ padding: '4px 2px' }}>
            {/* Report Summary Card */}
            <div className="dash-card" style={{ marginBottom: 20, borderTop: '4px solid var(--accent-mid)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {selectedReport.surveyId?.title || 'Conducted Survey Report'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                    Report ID: <code style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedReport.reportId}</code> · 
                    Survey ID: <code style={{ fontFamily: 'monospace' }}>{selectedReport.surveyId?.surveyId || 'N/A'}</code>
                  </div>
                </div>
                <StatusBadge status={selectedReport.status} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Responses</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent-mid)', marginTop: 2 }}>{selectedReport.totalResponses}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Submitted / Completed</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                    {selectedReport.submittedAt ? new Date(selectedReport.submittedAt).toLocaleDateString() : new Date(selectedReport.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Target Location</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                    📍 {selectedReport.surveyId?.location?.city || 'Local Region'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Conducted Window</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                    {selectedReport.surveyId?.startTime ? new Date(selectedReport.surveyId.startTime).toLocaleDateString() : ''} – {selectedReport.surveyId?.endTime ? new Date(selectedReport.surveyId.endTime).toLocaleDateString() : ''}
                  </div>
                </div>
              </div>

              {selectedReport.surveyId?.description && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', fontSize: 14, color: 'var(--text-muted)' }}>
                  <strong>Survey Description:</strong> {selectedReport.surveyId.description}
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
                <div className="chart-question" key={idx} style={{ marginBottom: 16, background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                    <div className="chart-question-title" style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                      Q{idx + 1}. {q.question}
                    </div>
                    <span className="badge badge-draft" style={{ fontSize: 10 }}>
                      {q.type?.replace('_', ' ')}
                    </span>
                  </div>

                  {q.type === 'RATING' && q.average && (
                    <div style={{ marginBottom: 14, padding: '8px 12px', background: '#fef3c7', borderRadius: 8, display: 'inline-block' }}>
                      <span style={{ fontSize: 20, fontWeight: 800, color: '#d97706' }}>⭐ {q.average} / 5.0</span>
                      <span style={{ fontSize: 12, color: '#92400e', marginLeft: 8 }}>Average Respondent Rating</span>
                    </div>
                  )}

                  {q.results && q.results.length > 0 ? (
                    q.results.map((r, ri) => (
                      <div className="chart-bar-row" key={ri} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="chart-bar-label" style={{ width: 140, fontSize: 13, fontWeight: 500 }}>
                          {q.type === 'RATING' ? `★ ${r.option} Star` : r.option}
                        </div>
                        <div className="chart-bar-track" style={{ flex: 1, height: 16, background: 'var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                          <div
                            className="chart-bar-fill"
                            style={{
                              width: `${r.percentage}%`,
                              height: '100%',
                              background: q.type === 'RATING' ? '#f59e0b' : 'var(--accent-mid)',
                              borderRadius: 8,
                              transition: 'width 0.4s ease',
                            }}
                          />
                        </div>
                        <div className="chart-bar-pct" style={{ width: 110, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>
                          {r.count} ({r.percentage}%)
                        </div>
                      </div>
                    ))
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
      totalResponses: reports.reduce((acc, r) => acc + (r.totalResponses || 0), 0),
      submitted: reports.filter(r => r.status === 'SUBMITTED').length,
    };

    // Selected comparison reports
    const reportA = reports.find(r => r._id === compareIdA) || reports[0] || null;
    const reportB = reports.find(r => r._id === compareIdB) || reports[1] || reports[0] || null;

    return (
      <div>
        <div className="dash-section-header">
          <div>
            <div className="dash-section-title">Survey History & Reports</div>
            <div className="dash-section-subtitle">
              Review previous surveys, comparative analytics, and generate official downloadable PDF reports
            </div>
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
            <button className="btn btn-secondary btn-sm" onClick={loadMyReports}>
              🔄 Refresh
            </button>
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
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Total Responses</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: reportA.totalResponses >= reportB.totalResponses ? '#047857' : 'inherit' }}>
                        {reportA.totalResponses}
                      </span>
                      {reportA.totalResponses > reportB.totalResponses && (
                        <span className="badge" style={{ background: '#dcfce7', color: '#15803d', marginLeft: 8, fontSize: 11 }}>
                          +{reportA.totalResponses - reportB.totalResponses} more
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: reportB.totalResponses >= reportA.totalResponses ? '#047857' : 'inherit' }}>
                        {reportB.totalResponses}
                      </span>
                      {reportB.totalResponses > reportA.totalResponses && (
                        <span className="badge" style={{ background: '#dcfce7', color: '#15803d', marginLeft: 8, fontSize: 11 }}>
                          +{reportB.totalResponses - reportA.totalResponses} more
                        </span>
                      )}
                    </td>
                  </tr>

                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Status</td>
                    <td style={{ padding: '12px 16px' }}><StatusBadge status={reportA.status} /></td>
                    <td style={{ padding: '12px 16px' }}><StatusBadge status={reportB.status} /></td>
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
                      {reportA.submittedAt ? new Date(reportA.submittedAt).toLocaleDateString() : new Date(reportA.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {reportB.submittedAt ? new Date(reportB.submittedAt).toLocaleDateString() : new Date(reportB.createdAt).toLocaleDateString()}
                    </td>
                  </tr>

                  <tr>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text-muted)' }}>Action</td>
                    <td style={{ padding: '12px 16px' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setSelectedReport(reportA)}>
                        View Survey A Report
                      </button>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setSelectedReport(reportB)}>
                        View Survey B Report
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {repErr && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {repErr}</div>}
        {repLoading && <div className="dash-loading"><div className="dash-spinner" /><span>Loading survey history…</span></div>}

        {!repLoading && reports.length === 0 && !repErr && (
          <div className="dash-empty">
            <div className="dash-empty-icon">📜</div>
            <div className="dash-empty-title">No survey history yet</div>
            <div className="dash-empty-desc">
              When your proposal is approved and you conduct a survey, the finalized report and analytics will be preserved here.
            </div>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setSection('submit')}>
              ➕ Submit a New Proposal
            </button>
          </div>
        )}

        {!repLoading && reports.length > 0 && (
          <div className="dash-list">
            {reports.map(r => (
              <div key={r._id} className="dash-list-item" style={{ borderLeft: '4px solid var(--accent-mid)' }}>
                <div className="dash-list-item-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span className="dash-list-item-title" style={{ margin: 0 }}>
                      {r.surveyId?.title || 'Survey Report'}
                    </span>
                    <StatusBadge status={r.status} />
                    <span className="badge" style={{ background: '#ede9fe', color: '#5b21b6' }}>
                      Report ID: {r.reportId}
                    </span>
                    {r.surveyId?.surveyId && (
                      <span className="badge" style={{ background: '#f3f4f6', color: '#374151' }}>
                        Survey ID: {r.surveyId.surveyId}
                      </span>
                    )}
                  </div>

                  <div className="dash-list-item-meta" style={{ flexWrap: 'wrap', gap: '8px 16px', marginTop: 6 }}>
                    <span>📍 <strong>Location:</strong> {r.surveyId?.location?.city || 'Local Area'}</span>
                    <span>👥 <strong>Responses:</strong> <span style={{ fontWeight: 700, color: 'var(--accent-mid)' }}>{r.totalResponses}</span></span>
                    <span>❓ <strong>Questions Analyzed:</strong> {r.analytics?.length || 0}</span>
                    <span>
                      🕑 <strong>Date:</strong> {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : new Date(r.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {r.surveyId?.description && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
                      {r.surveyId.description.length > 140 ? `${r.surveyId.description.slice(0, 140)}…` : r.surveyId.description}
                    </div>
                  )}
                </div>

                <div className="dash-list-item-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setSelectedReport(r)}
                  >
                    📊 View Full Report
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const renderSection = () => {
    if (section === 'proposals') return renderProposals();
    if (section === 'history')   return renderHistory();
    if (section === 'submit')    return renderSubmitForm();
    if (section === 'search')    return renderSearch();
    if (section === 'surveys')   return renderSurveys();
    if (section === 'profile')   return <ProfilePage onBack={() => setSection('proposals')} />;
    return null;
  };

  return (
    <div className="dash-root">
      <Navbar title="User Dashboard" />
      <div className="dash-body">
        {/* Sidebar */}
        <div className="dash-sidebar">
          <div className="dash-sidebar-label">Navigation</div>
          {SECTIONS.map(s => (
            <button key={s.key} className={`dash-sidebar-btn ${section === s.key ? 'active' : ''}`}
              onClick={() => setSection(s.key)}>
              <span className="dash-sidebar-icon">{s.icon}</span> {s.label}
            </button>
          ))}
          <ProfilePanel onManage={() => setSection('profile')} />
        </div>

        {/* Main content */}
        <div className="dash-main">
          {/* Stats row */}
          {section === 'proposals' && (
            <div className="dash-stats-grid">
              <div className="dash-stat">
                <div className="dash-stat-icon">📋</div>
                <div className="dash-stat-val">{proposals.length}</div>
                <div className="dash-stat-label">Total Proposals</div>
              </div>
              <div className="dash-stat">
                <div className="dash-stat-icon">⏳</div>
                <div className="dash-stat-val">{proposals.filter(p => p.status === 'PENDING').length}</div>
                <div className="dash-stat-label">Pending Review</div>
              </div>
              <div className="dash-stat">
                <div className="dash-stat-icon">⚡</div>
                <div className="dash-stat-val" style={{ color: '#047857' }}>{proposals.filter(p => p.status === 'APPROVED').length}</div>
                <div className="dash-stat-label">Approved & Active</div>
              </div>
              <div className="dash-stat">
                <div className="dash-stat-icon">🏁</div>
                <div className="dash-stat-val" style={{ color: 'var(--accent-mid)' }}>{proposals.filter(p => p.status === 'COMPLETED').length}</div>
                <div className="dash-stat-label">Completed</div>
              </div>
              <div className="dash-stat">
                <div className="dash-stat-icon">❌</div>
                <div className="dash-stat-val">{proposals.filter(p => p.status === 'REJECTED').length}</div>
                <div className="dash-stat-label">Rejected</div>
              </div>
            </div>
          )}
          {renderSection()}
          <DashboardFooter />
        </div>
      </div>
    </div>
  );
}
