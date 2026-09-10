import { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import ProfilePanel from '../components/ProfilePanel';
import ProfilePage from '../components/ProfilePage';
import DashboardFooter from '../components/DashboardFooter';
import api from '../api/axios';
import { exportElementToPdf } from '../utils/generatePdf';
import '../styles/dashboard.css';

const SECTIONS = [
  { key: 'overview', icon: '📊', label: 'Overview' },
  { key: 'builder', icon: '🔧', label: 'Survey Builder' },
  { key: 'analytics', icon: '📈', label: 'Analytics' },
  { key: 'report', icon: '📄', label: 'Report' },
];

const TYPES = [
  { value: 'SINGLE_CHOICE', label: 'Single Choice' },
  { value: 'MULTIPLE_CHOICE', label: 'Multiple Choice' },
  { value: 'YES_NO', label: 'Yes / No' },
  { value: 'RATING', label: 'Rating (1–5)' },
];

function genQId() { return `Q${Date.now()}_${Math.random().toString(36).substr(2,4)}`; }
function genOId() { return `O${Date.now()}_${Math.random().toString(36).substr(2,4)}`; }

function StatusBadge({ status }) {
  const map = { PENDING:'pending',APPROVED:'approved',REJECTED:'rejected',DRAFT:'draft',PUBLISHED:'published',COMPLETED:'completed',SUBMITTED:'submitted' };
  const icons = { PENDING:'⏳',APPROVED:'✅',REJECTED:'❌',DRAFT:'📝',PUBLISHED:'📡',COMPLETED:'🏁',SUBMITTED:'📤' };
  return <span className={`badge badge-${map[status]||'draft'}`}>{icons[status]} {status}</span>;
}

function newQuestion() {
  return {
    questionId: genQId(),
    text: '',
    type: 'SINGLE_CHOICE',
    options: [
      { optionId: genOId(), text: '' },
      { optionId: genOId(), text: '' },
    ],
    required: true,
  };
}

function getNowDateTimeString() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function getDefaultEndDateTimeString() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const emptySurveyForm = {
  title: '', description: '', city: '', latitude: '', longitude: '',
  radius: '5', startTime: getNowDateTimeString(), endTime: getDefaultEndDateTimeString(),
};

export default function SurveyerDashboard() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [section, setSection] = useState('overview');

  // ── Survey ──
  const [survey, setSurvey] = useState(null);
  const [approvedProposal, setApprovedProposal] = useState(null);
  const [surveyLoading, setSurveyLoading] = useState(true);

  // ── Builder ──
  const [surveyForm, setSurveyForm] = useState(emptySurveyForm);
  const [questions, setQuestions] = useState([newQuestion()]);
  const [builderMode, setBuilderMode] = useState('create'); // 'create' | 'edit'
  const [builderMsg, setBuilderMsg] = useState('');
  const [builderErr, setBuilderErr] = useState('');
  const [builderLoading, setBuilderLoading] = useState(false);
  const [bldLocDetecting, setBldLocDetecting] = useState(false);
  const [bldLocErr, setBldLocErr] = useState('');

  // ── Analytics ──
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsErr, setAnalyticsErr] = useState('');
  const [analyticsTab, setAnalyticsTab] = useState('overview'); // 'overview' | 'breakdown' | 'sentiment'
  const [qTypeFilter, setQTypeFilter] = useState('ALL'); // 'ALL' | 'RATING' | 'YES_NO' | 'CHOICE'

  // ── Report ──
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportMsg, setReportMsg] = useState('');
  const [reportErr, setReportErr] = useState('');
  const [reportSubTab, setReportSubTab] = useState('current'); // 'current' | 'history'
  const [previousReports, setPreviousReports] = useState([]);
  const [prevReportsLoading, setPrevReportsLoading] = useState(false);
  const [prevReportsErr, setPrevReportsErr] = useState('');
  const [selectedReportDetail, setSelectedReportDetail] = useState(null);
  const [reportDetailLoading, setReportDetailLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishMsg, setPublishMsg] = useState('');
  const [publishErr, setPublishErr] = useState('');
  const [publishStartTime, setPublishStartTime] = useState('');
  const [publishEndTime, setPublishEndTime] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  /* ── Auto-fill survey location via browser geolocation ── */
  async function detectBuilderLocation() {
    if (!navigator.geolocation) {
      setBldLocErr('Geolocation not supported by your browser.');
      return;
    }
    setBldLocDetecting(true);
    setBldLocErr('');
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
        setSurveyForm(prev => ({
          ...prev,
          city: city || prev.city,
          latitude: latitude.toFixed(6),
          longitude: longitude.toFixed(6),
        }));
        setBldLocDetecting(false);
      },
      () => {
        setBldLocErr('Location access denied. Please allow location or enter coordinates manually.');
        setBldLocDetecting(false);
      },
      { timeout: 10000 }
    );
  }

  const loadSurvey = useCallback(async () => {
    setSurveyLoading(true);
    try {
      const { data } = await api.get('/surveys/my');
      if (data.reportAlreadyGenerated) {
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...stored, role: 'USER', surveyerStatus: 'COMPLETED' }));
        window.location.href = '/dashboard/user?tab=history';
        return;
      }

      setSurvey(data.survey || null);
      if (data.proposal) {
        setApprovedProposal(data.proposal);
      }

      // Pre-fill builder
      if (data.survey) {
        const s = data.survey;
        const sStart = s.startTime
          ? new Date(new Date(s.startTime).getTime() - new Date(s.startTime).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
          : getNowDateTimeString();
        const sEnd = s.endTime
          ? new Date(new Date(s.endTime).getTime() - new Date(s.endTime).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
          : getDefaultEndDateTimeString();

        setSurveyForm({
          title: s.title || '',
          description: s.description || '',
          city: s.location?.city || '',
          latitude: s.location?.latitude?.toString() || '',
          longitude: s.location?.longitude?.toString() || '',
          radius: s.location?.radius?.toString() || '5',
          startTime: sStart,
          endTime: sEnd,
        });
        setPublishStartTime(sStart);
        setPublishEndTime(sEnd);
        if (s.questions?.length) setQuestions(s.questions);
        setBuilderMode('edit');
      } else if (data.proposal) {
        const p = data.proposal;
        // On creating/starting survey, default start date/time directly to NOW
        const startTimeVal = getNowDateTimeString();
        const propEnd = p.endDate ? new Date(p.endDate) : null;
        const endTimeVal = (propEnd && propEnd > new Date())
          ? new Date(propEnd.getTime() - propEnd.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
          : getDefaultEndDateTimeString();

        setSurveyForm({
          title: p.title || '',
          description: p.description || '',
          city: p.location?.city || '',
          latitude: p.location?.latitude?.toString() || '',
          longitude: p.location?.longitude?.toString() || '',
          radius: '5',
          startTime: startTimeVal,
          endTime: endTimeVal,
        });
        setPublishStartTime(startTimeVal);
        setPublishEndTime(endTimeVal);
        setBuilderMode('create');
      }
    } catch {
      setSurvey(null);
      setBuilderMode('create');
    } finally {
      setSurveyLoading(false);
    }
  }, []);

  useEffect(() => { loadSurvey(); }, [loadSurvey]);

  async function loadAnalytics() {
    if (!survey) return;
    setAnalyticsLoading(true);
    setAnalyticsErr('');
    try {
      const { data } = await api.get(`/surveys/${survey._id}/analytics`);
      setAnalytics(data);
    } catch (err) {
      setAnalyticsErr(err.response?.data?.message || 'Failed to load analytics.');
    } finally {
      setAnalyticsLoading(false);
    }
  }

  const loadPreviousReports = useCallback(async () => {
    setPrevReportsLoading(true);
    setPrevReportsErr('');
    try {
      const { data } = await api.get('/reports/my');
      setPreviousReports(data.reports || []);
    } catch (err) {
      setPrevReportsErr(err.response?.data?.message || 'Failed to load report history.');
    } finally {
      setPrevReportsLoading(false);
    }
  }, []);

  async function handleViewReportDetail(reportId) {
    setReportDetailLoading(true);
    try {
      const { data } = await api.get(`/reports/${reportId}`);
      setSelectedReportDetail(data.report);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to load report analysis.');
    } finally {
      setReportDetailLoading(false);
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

  useEffect(() => {
    if (section === 'analytics' && survey) loadAnalytics();
    if (section === 'report') loadPreviousReports();
  }, [section, survey, loadPreviousReports]);

  async function handleSaveSurvey(e) {
    e.preventDefault();
    setBuilderErr('');
    setBuilderMsg('');

    // ── Client-side pre-validation ──
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        setBuilderErr(`Question ${i + 1}: text cannot be empty.`);
        return;
      }
      if ((q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE')) {
        if (q.options.length < 2) {
          setBuilderErr(`Question ${i + 1}: "${q.type.replace('_', ' ')}" needs at least 2 options.`);
          return;
        }
        const emptyOpt = q.options.find(o => !o.text.trim());
        if (emptyOpt) {
          setBuilderErr(`Question ${i + 1}: all option texts must be filled in.`);
          return;
        }
      }
    }
    if (!surveyForm.latitude || !surveyForm.longitude) {
      setBuilderErr('Location: latitude and longitude are required. Use "Use My Current Location" or enter manually.');
      return;
    }

    const startDt = new Date(surveyForm.startTime);
    const endDt = new Date(surveyForm.endTime);
    const now = new Date();
    // 2-minute buffer for client-server clock drift and user typing
    const gracePastLimit = new Date(now.getTime() - 2 * 60 * 1000);

    if (isNaN(startDt.getTime())) {
      setBuilderErr('Please select a valid start date & time.');
      return;
    }
    if (isNaN(endDt.getTime())) {
      setBuilderErr('Please select a valid end date & time.');
      return;
    }
    if (startDt < gracePastLimit) {
      setBuilderErr('Start time cannot be in the past. Please choose the current time or a future date/time.');
      return;
    }
    if (endDt <= now) {
      setBuilderErr('End time must be strictly in the future.');
      return;
    }
    if (endDt <= startDt) {
      setBuilderErr('End date & time must be strictly after the start date & time.');
      return;
    }

    setBuilderLoading(true);
    const payload = {
      title: surveyForm.title,
      description: surveyForm.description,
      location: {
        city: surveyForm.city,
        latitude: parseFloat(surveyForm.latitude),
        longitude: parseFloat(surveyForm.longitude),
        radius: parseFloat(surveyForm.radius),
      },
      startTime: startDt.toISOString(),
      endTime: endDt.toISOString(),
      questions: questions.map(q => {
        const needsOptions = q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE';
        return {
          questionId: q.questionId,
          text: q.text,
          type: q.type,
          options: needsOptions ? (q.options || []) : [],
          required: q.required,
        };
      }),
    };
    try {
      if (builderMode === 'create') {
        await api.post('/surveys', payload);
        setBuilderMsg('Survey created successfully!');
      } else {
        await api.put(`/surveys/${survey._id}`, payload);
        setBuilderMsg('Survey updated successfully!');
      }
      await loadSurvey();
      setTimeout(() => setSection('overview'), 1200);
    } catch (err) {
      setBuilderErr(err.response?.data?.message || 'Failed to save survey.');
    } finally {
      setBuilderLoading(false);
    }
  }

  async function handlePublish() {
    if (!survey) return;
    setPublishLoading(true);
    setPublishErr('');
    setPublishMsg('');

    const startVal = publishStartTime || surveyForm.startTime || survey.startTime;
    const endVal = publishEndTime || surveyForm.endTime || survey.endTime;

    const startDt = new Date(startVal);
    const endDt = new Date(endVal);
    const now = new Date();
    const gracePastLimit = new Date(now.getTime() - 2 * 60 * 1000);

    if (isNaN(startDt.getTime())) {
      setPublishErr('Please select a valid publish start date & time.');
      setPublishLoading(false);
      return;
    }
    if (isNaN(endDt.getTime())) {
      setPublishErr('Please select a valid survey end date & time.');
      setPublishLoading(false);
      return;
    }
    if (startDt < gracePastLimit) {
      setPublishErr('Publish start time cannot be in the past. Click "⚡ Set Start to Now" or choose a future time.');
      setPublishLoading(false);
      return;
    }
    if (endDt <= now) {
      setPublishErr('Survey end date & time must be strictly in the future.');
      setPublishLoading(false);
      return;
    }
    if (endDt <= startDt) {
      setPublishErr('End date & time must be strictly after the publish start date & time.');
      setPublishLoading(false);
      return;
    }

    try {
      await api.patch(`/surveys/${survey._id}/publish`, {
        startTime: startDt.toISOString(),
        endTime: endDt.toISOString(),
      });
      setPublishMsg('Survey published successfully! Timing has been scheduled/activated.');
      await loadSurvey();
    } catch (err) {
      setPublishErr(err.response?.data?.message || 'Failed to publish survey.');
    } finally {
      setPublishLoading(false);
    }
  }

  async function handleGenerateReport() {
    if (!survey) return;
    setReportLoading(true);
    setReportErr('');
    setReportMsg('');
    try {
      const { data } = await api.post(`/surveys/${survey._id}/report`);
      setReport(data.report);
      setReportMsg('🎉 Report generated! Redirecting to your default User Dashboard…');
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      } else {
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...stored, role: 'USER', surveyerStatus: 'COMPLETED' }));
      }
      setTimeout(() => {
        window.location.href = '/dashboard/user?tab=history';
      }, 1200);
    } catch (err) {
      setReportErr(err.response?.data?.message || 'Failed to generate report.');
    } finally {
      setReportLoading(false);
    }
  }

  async function handleSubmitReport() {
    if (!report) return;
    setReportLoading(true);
    setReportErr('');
    try {
      const { data } = await api.patch(`/reports/${report.id}/submit`);
      setReportMsg('🎉 Report submitted! Redirecting to your default User Dashboard…');
      setReport({ ...report, status: 'SUBMITTED' });
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      } else {
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...stored, role: 'USER', surveyerStatus: 'COMPLETED' }));
      }
      setTimeout(() => {
        window.location.href = '/dashboard/user?tab=history';
      }, 1200);
    } catch (err) {
      setReportErr(err.response?.data?.message || 'Failed to submit report.');
    } finally {
      setReportLoading(false);
    }
  }

  // ── Question builder helpers ──
  function addQuestion() {
    setQuestions([...questions, newQuestion()]);
  }

  function removeQuestion(idx) {
    setQuestions(questions.filter((_, i) => i !== idx));
  }

  function updateQuestion(idx, field, value) {
    setQuestions(questions.map((q, i) => {
      if (i !== idx) return q;
      const updated = { ...q, [field]: value };
      // When type changes, reset options to match server validator rules
      if (field === 'type') {
        if (value === 'YES_NO' || value === 'RATING') {
          updated.options = [];  // validator requires empty options for these types
        } else if (value === 'SINGLE_CHOICE' || value === 'MULTIPLE_CHOICE') {
          // ensure at least 2 options
          updated.options = q.options.length >= 2 ? q.options : [
            { optionId: genOId(), text: '' },
            { optionId: genOId(), text: '' },
          ];
        }
      }
      return updated;
    }));
  }

  function addOption(qIdx) {
    setQuestions(questions.map((q, i) => i === qIdx
      ? { ...q, options: [...q.options, { optionId: genOId(), text: '' }] }
      : q));
  }

  function removeOption(qIdx, oIdx) {
    setQuestions(questions.map((q, i) => i === qIdx
      ? { ...q, options: q.options.filter((_, oi) => oi !== oIdx) }
      : q));
  }

  function updateOption(qIdx, oIdx, value) {
    setQuestions(questions.map((q, i) => i === qIdx
      ? { ...q, options: q.options.map((o, oi) => oi === oIdx ? { ...o, text: value } : o) }
      : q));
  }

  // ────────────────────── SECTIONS ──────────────────────
  function renderOverview() {
    if (surveyLoading) return <div className="dash-loading"><div className="dash-spinner" /><span>Loading…</span></div>;

    const steps = [
      { done: !!survey, label: 'Create Survey' },
      { done: survey?.status === 'PUBLISHED' || survey?.status === 'COMPLETED', label: 'Publish Survey' },
      { done: survey?.status === 'COMPLETED', label: 'Survey Completed' },
      { done: !!report || survey?.status === 'COMPLETED', label: 'Generate Report' },
      { done: report?.status === 'SUBMITTED', label: 'Submit Report' },
    ];

    return (
      <div>
        <div className="dash-section-header">
          <div>
            <div className="dash-section-title">Surveyer Overview</div>
            <div className="dash-section-subtitle">ID: {user.surveyerId} · Status: {user.surveyerStatus}</div>
          </div>
          {survey && survey.status === 'DRAFT' && (
            <button className="btn btn-secondary" onClick={() => setSection('builder')}>✏️ Edit Survey</button>
          )}
        </div>

        {/* Progress tracker */}
        <div className="dash-card" style={{ marginBottom: 24 }}>
          <div className="dash-card-title">Survey Progress</div>
          <div style={{ display: 'flex', gap: 0, marginTop: 16, position: 'relative' }}>
            {steps.map((step, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                {i < steps.length - 1 && (
                  <div style={{
                    position: 'absolute', top: 16, left: '50%', width: '100%', height: 2,
                    background: step.done ? 'var(--accent-mid,#1d4ed8)' : 'var(--border)',
                  }} />
                )}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', margin: '0 auto 8px',
                  background: step.done ? 'var(--accent-mid,#1d4ed8)' : 'var(--bg-input,#f1f5f9)',
                  border: `2px solid ${step.done ? 'var(--accent-mid,#1d4ed8)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: step.done ? '#fff' : 'var(--text-muted)',
                  position: 'relative', zIndex: 1,
                }}>
                  {step.done ? '✓' : i + 1}
                </div>
                <div style={{ fontSize: 11, color: step.done ? 'var(--accent-mid)' : 'var(--text-muted)', fontWeight: step.done ? 700 : 500 }}>
                  {step.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {!survey ? (
          <div className="dash-card" style={{ borderLeft: '4px solid var(--accent-mid)', textAlign: 'center', padding: '36px 24px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div className="dash-card-title" style={{ fontSize: 20, marginBottom: 8 }}>
              {approvedProposal ? `Approved Project: ${approvedProposal.title}` : 'Ready to Start Your Survey'}
            </div>
            <div className="dash-card-subtitle" style={{ maxWidth: 540, margin: '0 auto 20px', lineHeight: 1.6, fontSize: 14 }}>
              {approvedProposal
                ? `Your proposal for "${approvedProposal.location?.city || 'your area'}" is approved! Start by creating questions in the survey builder to launch.`
                : 'Go to Survey Builder to set up your questions and publish your survey.'}
            </div>
            <button className="btn btn-primary btn-lg" onClick={() => setSection('builder')}>
              🚀 Start Designing Survey Questions →
            </button>
          </div>
        ) : (
          <div className="dash-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div className="dash-card-title">{survey.title}</div>
                <div className="dash-card-subtitle">{survey.surveyId}</div>
              </div>
              <StatusBadge status={survey.status} />
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{survey.description}</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[
                ['📍 City', survey.location?.city],
                ['📏 Radius', `${survey.location?.radius} km`],
                ['❓ Questions', survey.questions?.length],
                ['🕐 Start', new Date(survey.startTime).toLocaleString()],
                ['🕑 End', new Date(survey.endTime).toLocaleString()],
                ['📋 Proposal', survey.proposalId?.title || '—'],
              ].map(([label, val]) => (
                <div key={label} style={{ padding: 12, background: 'var(--bg-input)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Publish action */}
            {survey.status === 'DRAFT' && (() => {
              const now = new Date();
              const pStart = publishStartTime ? new Date(publishStartTime) : new Date(survey.startTime);
              const pEnd = publishEndTime ? new Date(publishEndTime) : new Date(survey.endTime);
              const willBeLiveImmediately = pStart <= now && pEnd > now;
              const willBeScheduled = pStart > now;

              return (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 6 }}>
                    🚀 Publish Survey with Date & Time Conduction
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                    Verify or adjust your conduction window before publishing. Conduction and response collection will only be active during this exact date & time window.
                  </div>

                  <div className="form-row" style={{ marginBottom: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <label className="form-label" style={{ marginBottom: 0, fontSize: 12 }}>Publish / Start Time *</label>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={() => setPublishStartTime(getNowDateTimeString())}
                        >
                          ⚡ Set to Now
                        </button>
                      </div>
                      <input
                        type="datetime-local"
                        className="form-input"
                        value={publishStartTime}
                        onChange={e => setPublishStartTime(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <label className="form-label" style={{ marginBottom: 0, fontSize: 12 }}>End Date & Time *</label>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11, padding: '2px 8px' }}
                          onClick={() => {
                            const d = new Date(publishStartTime ? new Date(publishStartTime) : new Date());
                            d.setDate(d.getDate() + 7);
                            d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                            setPublishEndTime(d.toISOString().slice(0, 16));
                          }}
                        >
                          📅 +7 Days
                        </button>
                      </div>
                      <input
                        type="datetime-local"
                        className="form-input"
                        value={publishEndTime}
                        onChange={e => setPublishEndTime(e.target.value)}
                      />
                    </div>
                  </div>

                  {willBeLiveImmediately && (
                    <div style={{ fontSize: 12, color: '#065f46', background: '#d1fae5', padding: '6px 12px', borderRadius: 6, marginBottom: 12 }}>
                      🟢 <strong>Immediate Launch:</strong> Survey will go live and start accepting responses immediately upon publishing.
                    </div>
                  )}
                  {willBeScheduled && (
                    <div style={{ fontSize: 12, color: '#1e40af', background: '#dbeafe', padding: '6px 12px', borderRadius: 6, marginBottom: 12 }}>
                      ⏰ <strong>Scheduled Launch:</strong> Survey will open for responses on <strong>{pStart.toLocaleString()}</strong>.
                    </div>
                  )}

                  {publishErr && <div className="alert alert-error" style={{ marginBottom: 12 }}>⚠️ {publishErr}</div>}
                  {publishMsg && <div className="alert alert-success" style={{ marginBottom: 12 }}>✅ {publishMsg}</div>}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button className="btn btn-primary" onClick={handlePublish} disabled={publishLoading}>
                      {publishLoading ? '⏳ Publishing…' : '🚀 Publish Survey'}
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Start time cannot be in past, and end time must be in future.
                    </span>
                  </div>
                </div>
              );
            })()}

            {survey.status === 'PUBLISHED' && (() => {
              const surveyLink = `${window.location.origin}/survey/${survey.surveyId}`;
              const now = new Date();
              const sStart = new Date(survey.startTime);
              const sEnd = new Date(survey.endTime);
              const isLiveNow = now >= sStart && now <= sEnd;
              const isFutureScheduled = now < sStart;
              const isExpired = now > sEnd;

              return (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  {isLiveNow && (
                    <div className="alert alert-info" style={{ marginBottom: 16, background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' }}>
                      🟢 <strong>Conducting Now (Live):</strong> Your survey is live and accepting responses until <strong>{sEnd.toLocaleString()}</strong>.
                    </div>
                  )}
                  {isFutureScheduled && (
                    <div className="alert alert-info" style={{ marginBottom: 16, background: '#eff6ff', borderColor: '#bfdbfe', color: '#1e40af' }}>
                      ⏰ <strong>Scheduled Conduction:</strong> Survey is published and will automatically open on <strong>{sStart.toLocaleString()}</strong>.
                    </div>
                  )}
                  {isExpired && (
                    <div className="alert alert-error" style={{ marginBottom: 16 }}>
                      🏁 <strong>Conduction Window Ended:</strong> This survey closed on <strong>{sEnd.toLocaleString()}</strong>.
                    </div>
                  )}

                  {/* Shareable link card */}
                  <div style={{
                    background: 'var(--bg-input,#f1f5f9)',
                    borderRadius: 12,
                    padding: 16,
                    border: '1.5px solid var(--border)',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                      🔗 Shareable Survey Link
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        readOnly
                        value={surveyLink}
                        style={{
                          flex: 1, minWidth: 200,
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: '1px solid var(--border-input)',
                          background: '#fff',
                          fontSize: 13,
                          color: 'var(--accent-mid,#1d4ed8)',
                          fontFamily: 'monospace',
                          cursor: 'text',
                        }}
                        onFocus={e => e.target.select()}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          navigator.clipboard.writeText(surveyLink)
                            .then(() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); })
                            .catch(() => {});
                        }}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {linkCopied ? '✅ Copied!' : '📋 Copy Link'}
                      </button>
                      <a
                        href={surveyLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary btn-sm"
                        style={{ whiteSpace: 'nowrap', textDecoration: 'none' }}
                      >
                        🔗 Open Link
                      </a>
                    </div>
                    <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-faint,#9ca3af)' }}>
                      Anyone with this link can view and submit responses — no login required.
                    </div>
                  </div>
                </div>
              );
            })()}

            {survey.status === 'COMPLETED' && (
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-secondary" onClick={() => setSection('analytics')}>📈 View Analytics</button>
                <button className="btn btn-primary" onClick={() => setSection('report')}>📄 Generate Report</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderBuilder() {
    return (
      <div>
        <div className="dash-section-header">
          <div>
            <div className="dash-section-title">{builderMode === 'create' ? 'Create Survey' : 'Edit Survey'}</div>
            <div className="dash-section-subtitle">Build your survey with questions and set location + timing</div>
          </div>
        </div>

        <form className="dash-form" onSubmit={handleSaveSurvey}>
          <div className="dash-card" style={{ marginBottom: 20 }}>
            <div className="dash-card-title" style={{ marginBottom: 16 }}>Survey Details</div>
            <div className="dash-form">
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input className="form-input" required value={surveyForm.title} onChange={e => setSurveyForm({...surveyForm,title:e.target.value})} placeholder="e.g. Road Condition Survey" />
              </div>
              <div className="form-group">
                <label className="form-label">Description *</label>
                <textarea className="form-textarea" required value={surveyForm.description} onChange={e => setSurveyForm({...surveyForm,description:e.target.value})} placeholder="Describe what this survey is about…" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="form-label" style={{ marginBottom: 0 }}>Location *</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={detectBuilderLocation}
                  disabled={bldLocDetecting}
                  style={{ fontSize: 12 }}
                >
                  {bldLocDetecting ? '📡 Detecting…' : '📍 Use My Current Location'}
                </button>
              </div>
              {bldLocErr && <div className="alert alert-error" style={{ marginBottom: 8, fontSize: 12 }}>⚠️ {bldLocErr}</div>}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">City *</label>
                  <input className="form-input" required value={surveyForm.city} onChange={e => setSurveyForm({...surveyForm,city:e.target.value})} placeholder="e.g. Chennai" />
                </div>
                <div className="form-group">
                  <label className="form-label">Radius (km, 1–100) *</label>
                  <input className="form-input" type="number" min="1" max="100" required value={surveyForm.radius} onChange={e => setSurveyForm({...surveyForm,radius:e.target.value})} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Latitude *</label>
                  <input className="form-input" type="number" step="any" required value={surveyForm.latitude} onChange={e => setSurveyForm({...surveyForm,latitude:e.target.value})} placeholder="Auto-filled or enter manually" readOnly={bldLocDetecting} />
                </div>
                <div className="form-group">
                  <label className="form-label">Longitude *</label>
                  <input className="form-input" type="number" step="any" required value={surveyForm.longitude} onChange={e => setSurveyForm({...surveyForm,longitude:e.target.value})} placeholder="Auto-filled or enter manually" readOnly={bldLocDetecting} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Start Date & Time *</label>
                  <input className="form-input" type="datetime-local" required value={surveyForm.startTime ? surveyForm.startTime.slice(0, 16) : ''} onChange={e => setSurveyForm({...surveyForm, startTime: e.target.value})} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Must not be in the past</span>
                </div>
                <div className="form-group">
                  <label className="form-label">End Date & Time *</label>
                  <input className="form-input" type="datetime-local" required value={surveyForm.endTime ? surveyForm.endTime.slice(0, 16) : ''} onChange={e => setSurveyForm({...surveyForm, endTime: e.target.value})} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Must be strictly after start time & in future</span>
                </div>
              </div>
            </div>
          </div>

          {/* Questions */}
          <div className="dash-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div className="dash-card-title">Questions ({questions.length})</div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addQuestion}>+ Add Question</button>
            </div>

            {questions.map((q, qi) => (
              <div className="question-card" key={q.questionId}>
                <div className="question-card-header">
                  <span className="question-number">Question {qi + 1}</span>
                  {questions.length > 1 && (
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => removeQuestion(qi)}>✕ Remove</button>
                  )}
                </div>
                <div className="form-row" style={{ marginBottom: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Question Text *</label>
                    <input className="form-input" required value={q.text} placeholder="Type your question…"
                      onChange={e => updateQuestion(qi, 'text', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Type *</label>
                    <select className="form-select" value={q.type} onChange={e => updateQuestion(qi, 'type', e.target.value)}>
                      {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
                    <input type="checkbox" checked={q.required} onChange={e => updateQuestion(qi,'required',e.target.checked)} />
                    <span style={{ color:'var(--text-secondary)' }}>Required</span>
                  </label>
                </div>

                {(q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Options:</div>
                    {q.options.map((opt, oi) => (
                      <div className="option-row" key={opt.optionId}>
                        <input className="form-input" value={opt.text} placeholder={`Option ${oi+1}`}
                          onChange={e => updateOption(qi, oi, e.target.value)} style={{ flex:1 }} />
                        {q.options.length > 1 && (
                          <button type="button" className="option-remove" onClick={() => removeOption(qi, oi)}>✕</button>
                        )}
                      </div>
                    ))}
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => addOption(qi)}>+ Add Option</button>
                  </div>
                )}
                {q.type === 'YES_NO' && <div className="alert alert-info" style={{ fontSize:12 }}>Participants will choose between Yes or No.</div>}
                {q.type === 'RATING' && <div className="alert alert-info" style={{ fontSize:12 }}>Participants will rate from 1 to 5 stars.</div>}
              </div>
            ))}

            {builderErr && <div className="alert alert-error">{builderErr}</div>}
            {builderMsg && <div className="alert alert-success">✅ {builderMsg}</div>}

            <div style={{ display:'flex', gap:12, justifyContent:'flex-end', marginTop:16 }}>
              <button type="submit" className="btn btn-primary btn-lg" disabled={builderLoading}>
                {builderLoading ? '⏳ Saving…' : builderMode === 'create' ? '💾 Create Survey' : '💾 Update Survey'}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  function renderAnalytics() {
    if (!survey) return (
      <div className="dash-empty">
        <div className="dash-empty-icon">📈</div>
        <div className="dash-empty-title">No survey yet</div>
        <div className="dash-empty-desc">Create and publish a survey first to see analytics.</div>
      </div>
    );

    if (analyticsLoading) return <div className="dash-loading"><div className="dash-spinner" /><span>Loading analytics…</span></div>;
    if (analyticsErr) return <div className="alert alert-error">⚠️ {analyticsErr}</div>;
    if (!analytics) return (
      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <button className="btn btn-primary" onClick={loadAnalytics}>Load Analytics</button>
      </div>
    );

    const questionsList = analytics.analytics || [];
    const filteredQuestions = questionsList.filter(q => {
      if (qTypeFilter === 'ALL') return true;
      if (qTypeFilter === 'RATING') return q.type === 'RATING';
      if (qTypeFilter === 'YES_NO') return q.type === 'YES_NO';
      if (qTypeFilter === 'CHOICE') return q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE';
      return true;
    });

    const maxTimelineCount = Math.max(...(analytics.timeline?.map(t => t.count) || [1]), 1);

    return (
      <div>
        {/* Header */}
        <div className="dash-section-header">
          <div>
            <div className="dash-section-title">Survey Analytics & Intelligence</div>
            <div className="dash-section-subtitle">{analytics.survey?.title} · Real-time statistical analysis</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={loadAnalytics}>🔄 Refresh Data</button>
            <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>🖨️ Export PDF</button>
          </div>
        </div>

        {/* ── KPI Summary Cards ── */}
        <div className="dash-stats-grid" style={{ marginBottom: 20 }}>
          <div className="dash-stat">
            <div className="dash-stat-icon">👥</div>
            <div className="dash-stat-val">{analytics.totalResponses}</div>
            <div className="dash-stat-label">Total Responses</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {analytics.authenticatedCount || 0} Registered · {analytics.anonymousCount || 0} Anonymous
            </div>
          </div>

          <div className="dash-stat">
            <div className="dash-stat-icon">🎯</div>
            <div className="dash-stat-val" style={{ color: '#047857' }}>{analytics.completionRate || 100}%</div>
            <div className="dash-stat-label">Completion Rate</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Avg question coverage
            </div>
          </div>

          <div className="dash-stat">
            <div className="dash-stat-icon">⭐</div>
            <div className="dash-stat-val" style={{ color: '#d97706' }}>
              {analytics.overallInsights?.overallAverageRating ? `${analytics.overallInsights.overallAverageRating}/5` : 'N/A'}
            </div>
            <div className="dash-stat-label">Average Satisfaction</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Across all ratings
            </div>
          </div>

          <div className="dash-stat">
            <div className="dash-stat-icon">❓</div>
            <div className="dash-stat-val" style={{ color: '#1d4ed8' }}>{questionsList.length}</div>
            <div className="dash-stat-label">Survey Questions</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Interactive query items
            </div>
          </div>
        </div>

        {/* ── Analysis View Subnav Tabs ── */}
        <div className="tab-subnav">
          {[
            { id: 'overview', label: '📊 Overview & Trends' },
            { id: 'breakdown', label: '🔬 Question Breakdown' },
            { id: 'sentiment', label: '💡 Sentiment & CSAT Pulse' },
          ].map(tab => (
            <button
              key={tab.id}
              className={`tab-subnav-btn ${analyticsTab === tab.id ? 'active' : ''}`}
              onClick={() => setAnalyticsTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ═════════ TAB 1: OVERVIEW & TRENDS ═════════ */}
        {analyticsTab === 'overview' && (
          <div>
            {/* Response Timeline Chart */}
            <div className="timeline-chart-wrap">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>📈 Response Velocity & Timeline</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Daily distribution of received survey submissions</div>
                </div>
                <span className="badge badge-published">Live Tracking</span>
              </div>

              {(!analytics.timeline || analytics.timeline.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  No submission timeline data recorded yet.
                </div>
              ) : (
                <div className="timeline-chart-bars">
                  {analytics.timeline.map((item, idx) => {
                    const heightPct = Math.max((item.count / maxTimelineCount) * 100, 12);
                    return (
                      <div className="timeline-bar-col" key={idx}>
                        <span className="timeline-bar-count">{item.count}</span>
                        <div className="timeline-bar-fill" style={{ height: `${heightPct}%` }} title={`${item.date}: ${item.count} responses`} />
                        <span className="timeline-bar-label">{item.date.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Question Matrix */}
            <div className="dash-card">
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
                📋 Question Performance Summary Matrix
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {questionsList.map((q, idx) => (
                  <div key={q.questionId} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', background: 'var(--bg-input)', borderRadius: 10,
                    fontSize: 13, gap: 12
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 700, color: 'var(--accent-mid)' }}>Q{idx + 1}. </span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{q.question}</span>
                    </div>
                    <span className="badge badge-draft" style={{ fontSize: 10 }}>{q.type.replace('_', ' ')}</span>
                    <div style={{ minWidth: 100, textAlign: 'right', fontWeight: 600 }}>
                      {q.type === 'RATING' ? `⭐ ${q.average || 0}/5 avg` : `${q.answeredCount || 0} answers`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═════════ TAB 2: QUESTION BREAKDOWN ═════════ */}
        {analyticsTab === 'breakdown' && (
          <div>
            {/* Filter Pills */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {[
                { id: 'ALL', label: 'All Questions' },
                { id: 'RATING', label: '⭐ Rating Scores' },
                { id: 'CHOICE', label: '🔘 Single & Multiple Choice' },
                { id: 'YES_NO', label: '⚖️ Yes / No' },
              ].map(f => (
                <button
                  key={f.id}
                  className={`btn btn-sm ${qTypeFilter === f.id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setQTypeFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {filteredQuestions.length === 0 ? (
              <div className="dash-empty">
                <div className="dash-empty-icon">🔍</div>
                <div className="dash-empty-title">No questions match filter</div>
              </div>
            ) : (
              filteredQuestions.map((q, i) => (
                <div className="chart-question" key={q.questionId}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div className="chart-question-title">Q{i + 1}. {q.question}</div>
                    <span className="badge badge-published" style={{ fontSize: 10 }}>{q.type.replace('_', ' ')}</span>
                  </div>

                  {/* Top Choice Badge */}
                  {q.topChoice && (
                    <div style={{ marginBottom: 12 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: '#047857',
                        background: '#d1fae5', padding: '3px 8px', borderRadius: 6
                      }}>
                        👑 Leading Choice: {q.topChoice.option} ({q.topChoice.percentage}%)
                      </span>
                    </div>
                  )}

                  {/* Rating Special Section */}
                  {q.type === 'RATING' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 16, background: 'var(--bg-input)', padding: '14px 18px', borderRadius: 12 }}>
                      <div>
                        <div className="chart-average">⭐ {q.average}/5</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Average Rating Score</div>
                      </div>
                      {q.csat !== undefined && (
                        <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 20 }}>
                          <div style={{ fontSize: 24, fontWeight: 800, color: '#047857' }}>{q.csat}%</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>CSAT (4-5 ★ positive)</div>
                        </div>
                      )}
                      {q.sentiment && (
                        <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 20 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{q.sentiment.ratingHealth}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Overall Health</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Yes/No Sentiment Badge */}
                  {q.type === 'YES_NO' && q.sentiment && (
                    <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Sentiment Index:</span>
                      <span className={`badge ${q.sentiment.yesPercentage >= 50 ? 'badge-approved' : 'badge-rejected'}`}>
                        {q.sentiment.label} ({q.sentiment.yesPercentage}% Yes)
                      </span>
                    </div>
                  )}

                  {/* Distribution Bar Chart */}
                  {q.results?.map((r, ri) => (
                    <div className="chart-bar-row" key={ri}>
                      <div className="chart-bar-label">{q.type === 'RATING' ? `★ ${r.option || r.rating} Star` : r.option}</div>
                      <div className="chart-bar-track">
                        <div className="chart-bar-fill" style={{ width: `${r.percentage}%` }} />
                      </div>
                      <div className="chart-bar-pct">{r.count} ({r.percentage}%)</div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {/* ═════════ TAB 3: SENTIMENT & CSAT PULSE ═════════ */}
        {analyticsTab === 'sentiment' && (
          <div>
            <div className="dash-card" style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                🌟 Satisfaction & Sentiment Index (CSAT)
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                Aggregate sentiment categorized into Positive, Neutral, and Critical classifications.
              </div>

              {questionsList.filter(q => q.type === 'RATING').length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  No rating questions in this survey to compute star CSAT scores.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                  {questionsList.filter(q => q.type === 'RATING').map(q => (
                    <div key={q.questionId} style={{
                      border: '1px solid var(--border)', borderRadius: 14, padding: 18,
                      background: 'var(--bg-card)'
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                        {q.question}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <span style={{ fontSize: 28, fontWeight: 800, color: '#d97706' }}>⭐ {q.average}/5</span>
                        <span className="badge badge-approved">CSAT {q.csat || 0}%</span>
                      </div>

                      {q.sentiment && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#047857' }}>● Positive (4-5★):</span>
                            <strong>{q.sentiment.positivePercentage}%</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#b45309' }}>● Neutral (3★):</span>
                            <strong>{q.sentiment.neutralPercentage}%</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#b91c1c' }}>● Critical (1-2★):</span>
                            <strong>{q.sentiment.negativePercentage}%</strong>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderReport() {
    const canGenerate = survey?.status === 'COMPLETED';

    return (
      <div>
        <div className="dash-section-header">
          <div>
            <div className="dash-section-title">Survey Reports & Historical Analysis</div>
            <div className="dash-section-subtitle">Compile final reports and examine analytics from previous surveys</div>
          </div>
        </div>

        {/* ── Subnav Tabs for Current vs Previous Reports ── */}
        <div className="tab-subnav">
          <button
            className={`tab-subnav-btn ${reportSubTab === 'current' ? 'active' : ''}`}
            onClick={() => { setReportSubTab('current'); setSelectedReportDetail(null); }}
          >
            📑 Current Survey Report
          </button>
          <button
            className={`tab-subnav-btn ${reportSubTab === 'history' ? 'active' : ''}`}
            onClick={() => { setReportSubTab('history'); loadPreviousReports(); }}
          >
            🗂️ Previous Reports Archive ({previousReports.length})
          </button>
        </div>

        {/* ═════════ TAB 1: CURRENT SURVEY REPORT ═════════ */}
        {reportSubTab === 'current' && (
          <div>
            {!canGenerate && (
              <div className="alert alert-warn" style={{ marginBottom: 20 }}>
                ⚠️ The report can only be generated after the survey is completed (end time has passed).
                {survey && <span> Current status: <strong>{survey.status}</strong></span>}
              </div>
            )}

            {reportErr && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {reportErr}</div>}
            {reportMsg && <div className="alert alert-success" style={{ marginBottom: 16 }}>✅ {reportMsg}</div>}

            {!report ? (
              <div className="dash-card">
                <div className="dash-card-title">Generate Current Survey Report</div>
                <div className="dash-card-subtitle" style={{ marginBottom: 20 }}>
                  Compile all collected responses, metrics, and question distributions into a definitive report.
                </div>
                <button className="btn btn-primary btn-lg" onClick={handleGenerateReport} disabled={!canGenerate || reportLoading}>
                  {reportLoading ? '⏳ Generating…' : '📊 Generate Report'}
                </button>
              </div>
            ) : (
              <div className="dash-card">
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div className="dash-card-title">📄 Report {report.reportId}</div>
                    <div className="dash-card-subtitle">Generated for {survey?.title}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={pdfLoading}
                      onClick={() => handleDownloadPdf('current-report-content', `${survey?.title || 'survey'}-report-${report.reportId}`)}
                    >
                      {pdfLoading ? '⏳ Generating…' : '📥 Download PDF'}
                    </button>
                    <span className={`badge badge-${report.status === 'SUBMITTED' ? 'submitted' : 'draft'}`}>
                      {report.status === 'SUBMITTED' ? '📤 SUBMITTED' : '📝 DRAFT'}
                    </span>
                  </div>
                </div>

                <div id="current-report-content">

                {[
                  ['Total Responses', report.totalResponses],
                  ['Status', report.status],
                ].map(([label, val]) => (
                  <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--border)', fontSize:14 }}>
                    <span style={{ color:'var(--text-muted)' }}>{label}</span>
                    <span style={{ fontWeight:600 }}>{val}</span>
                  </div>
                ))}
                </div>

                {report.status !== 'SUBMITTED' && (
                  <div style={{ marginTop: 20 }}>
                    <button className="btn btn-primary btn-lg" onClick={handleSubmitReport} disabled={reportLoading}>
                      {reportLoading ? '⏳ Submitting…' : '📤 Submit Final Report'}
                    </button>
                    <div style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>
                      ⚠️ Submitting is irreversible. Your Surveyer authorization will end after submission.
                    </div>
                  </div>
                )}

                {report.status === 'SUBMITTED' && (
                  <div style={{ marginTop: 20 }}>
                    <div className="alert alert-success" style={{ marginBottom: 16 }}>
                      🎉 Report generated and submitted successfully! Your survey cycle is completed, and your account has returned to User. You can view all analytics and history in your User Dashboard.
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <button
                        className="btn btn-primary btn-lg"
                        onClick={() => { window.location.href = '/dashboard/user?tab=history'; }}
                      >
                        🚀 View in User Dashboard (Survey History)
                      </button>
                      <button
                        className="btn btn-secondary btn-lg"
                        onClick={() => setReportSubTab('history')}
                      >
                        📜 Review Archive Here
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═════════ TAB 2: PREVIOUS REPORTS ARCHIVE & ANALYTICS ═════════ */}
        {reportSubTab === 'history' && (
          <div>
            {/* If a report detail is selected, view its full analysis */}
            {selectedReportDetail ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setSelectedReportDetail(null)}>
                    ← Back to Reports List
                  </button>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={pdfLoading}
                      onClick={() => handleDownloadPdf('surveyer-report-content', selectedReportDetail.surveyId?.title || selectedReportDetail.reportId)}
                      title="Download as PDF"
                    >
                      {pdfLoading ? '⏳ Generating PDF…' : '📥 Download as PDF'}
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => window.print()} title="Print document">
                      🖨️ Print
                    </button>
                  </div>
                </div>

                {/* Printable Report Container */}
                <div id="surveyer-report-content" style={{ padding: '4px 2px' }}>
                  {/* Report Header Card */}
                  <div className="dash-card" style={{ marginBottom: 20, borderTop: '4px solid #1d4ed8' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
                          {selectedReportDetail.surveyId?.title || 'Survey Report'}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                          Report ID: <code style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedReportDetail.reportId}</code> · 
                          Survey ID: <code style={{ fontFamily: 'monospace' }}>{selectedReportDetail.surveyId?.surveyId}</code>
                        </div>
                      </div>
                      <span className={`badge badge-${selectedReportDetail.status === 'SUBMITTED' ? 'submitted' : 'draft'}`} style={{ fontSize: 12 }}>
                        {selectedReportDetail.status === 'SUBMITTED' ? '📤 SUBMITTED' : '📝 DRAFT'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Responses</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-mid)' }}>{selectedReportDetail.totalResponses}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Submitted At</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                          {selectedReportDetail.submittedAt ? new Date(selectedReportDetail.submittedAt).toLocaleDateString() : 'Draft'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Location</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>
                          📍 {selectedReportDetail.surveyId?.location?.city || 'Local Area'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Comparative Benchmark Section */}
                  {previousReports.length > 1 && (
                    <div className="dash-card" style={{ marginBottom: 20, background: '#fafbff', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>📊 Surveyor Historical Benchmark</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                        {(() => {
                          const avgResp = Math.round(previousReports.reduce((s, r) => s + (r.totalResponses || 0), 0) / previousReports.length);
                          const delta = (selectedReportDetail.totalResponses || 0) - avgResp;
                          return (
                            <>
                              <div style={{ background: '#fff', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Response Delta</div>
                                <div style={{ fontSize: 18, fontWeight: 800, color: delta >= 0 ? '#047857' : '#b45309' }}>
                                  {delta >= 0 ? `+${delta}` : delta} vs average
                                </div>
                              </div>
                              <div style={{ background: '#fff', padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Archive Average</div>
                                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-mid)' }}>
                                  {avgResp} responses / survey
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Question Analytics Snapshot of this historical report */}
                  <div className="dash-section-title" style={{ marginBottom: 12 }}>📊 Historical Question Analytics</div>
                  {(!selectedReportDetail.analytics || selectedReportDetail.analytics.length === 0) ? (
                    <div className="alert alert-info">No question breakdown recorded for this report.</div>
                  ) : (
                    selectedReportDetail.analytics.map((q, idx) => (
                      <div className="chart-question" key={idx} style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div className="chart-question-title">Q{idx + 1}. {q.question}</div>
                          <span className="badge badge-draft" style={{ fontSize: 10 }}>{q.type?.replace('_', ' ')}</span>
                        </div>

                        {q.type === 'RATING' && q.average && (
                          <div style={{ marginBottom: 12 }}>
                            <span style={{ fontSize: 20, fontWeight: 800, color: '#d97706' }}>⭐ {q.average}/5</span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>Average Historical Rating</span>
                          </div>
                        )}

                        {q.results?.map((r, ri) => (
                          <div className="chart-bar-row" key={ri}>
                            <div className="chart-bar-label">{q.type === 'RATING' ? `★ ${r.option} Star` : r.option}</div>
                            <div className="chart-bar-track">
                              <div className="chart-bar-fill" style={{ width: `${r.percentage}%` }} />
                            </div>
                            <div className="chart-bar-pct">{r.count} ({r.percentage}%)</div>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              /* Reports Table / List View */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    All finalized and draft reports generated across your survey cycles.
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={loadPreviousReports}>🔄 Refresh Archive</button>
                </div>

                {prevReportsErr && <div className="alert alert-error">{prevReportsErr}</div>}
                {prevReportsLoading && (
                  <div className="dash-loading"><div className="dash-spinner" /><span>Loading report archive…</span></div>
                )}

                {!prevReportsLoading && previousReports.length === 0 && (
                  <div className="dash-empty">
                    <div className="dash-empty-icon">🗂️</div>
                    <div className="dash-empty-title">No previous reports found</div>
                    <div className="dash-empty-desc">Completed survey reports will appear here for historical analysis.</div>
                  </div>
                )}

                {!prevReportsLoading && previousReports.length > 0 && (
                  <div className="dash-list">
                    {previousReports.map(item => (
                      <div key={item._id} className="dash-card" style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                              {item.surveyId?.title || 'Survey'}
                            </div>
                            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)', marginTop: 4, flexWrap: 'wrap' }}>
                              <span>🔖 Report ID: <strong>{item.reportId}</strong></span>
                              <span>👥 {item.totalResponses} responses</span>
                              <span>📅 Created: {new Date(item.createdAt).toLocaleDateString()}</span>
                              {item.surveyId?.location?.city && <span>📍 {item.surveyId.location.city}</span>}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span className={`badge badge-${item.status === 'SUBMITTED' ? 'submitted' : 'draft'}`}>
                              {item.status === 'SUBMITTED' ? '📤 SUBMITTED' : '📝 DRAFT'}
                            </span>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleViewReportDetail(item._id)}
                              disabled={reportDetailLoading}
                            >
                              👁️ View Report Analysis
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const renderSection = () => {
    if (section === 'overview')   return renderOverview();
    if (section === 'builder')    return renderBuilder();
    if (section === 'analytics')  return renderAnalytics();
    if (section === 'report')     return renderReport();
    if (section === 'profile')    return <ProfilePage onBack={() => setSection('overview')} />;
    return null;
  };

  return (
    <div className="dash-root">
      <Navbar title="Surveyer Dashboard" />
      <div className="dash-body">
        <div className="dash-sidebar">
          <div className="dash-sidebar-label">Dashboard</div>
          {SECTIONS.map(s => (
            <button key={s.key} className={`dash-sidebar-btn ${section === s.key ? 'active' : ''}`}
              onClick={() => setSection(s.key)}>
              <span className="dash-sidebar-icon">{s.icon}</span> {s.label}
            </button>
          ))}

          {survey && (
            <div style={{ marginTop: 16 }}>
              <div className="dash-sidebar-label">Survey Status</div>
              <div style={{ padding:'8px 12px' }}>
                <StatusBadge status={survey.status} />
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6 }}>{survey.surveyId}</div>
              </div>
            </div>
          )}

          <ProfilePanel onManage={() => setSection('profile')} />
        </div>

        <div className="dash-main">
          {renderSection()}
          <DashboardFooter />
        </div>
      </div>
    </div>
  );
}
