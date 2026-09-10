import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/dashboard.css';
import '../login.css';

const API = '/api/public';  // proxied by Vite → http://localhost:5000/api/public

export default function PublicSurvey() {
  const { surveyId } = useParams();
  const navigate = useNavigate();

  const [survey, setSurvey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Respondent name (optional)
  const [name, setName] = useState('');

  // Answers keyed by questionId
  const [answers, setAnswers] = useState({});

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitErr, setSubmitErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/surveys/${surveyId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Survey unavailable.');
        setSurvey(data.survey);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [surveyId]);

  function setAnswer(questionId, value) {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  }

  function toggleMulti(questionId, option) {
    const cur = answers[questionId] || [];
    const updated = cur.includes(option)
      ? cur.filter(x => x !== option)
      : [...cur, option];
    setAnswer(questionId, updated);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitErr('');

    // Validate required questions
    for (const q of survey.questions) {
      if (q.required) {
        const ans = answers[q.questionId];
        const missing = ans === undefined || ans === null || ans === '' ||
          (Array.isArray(ans) && ans.length === 0);
        if (missing) {
          setSubmitErr(`Please answer: "${q.text}"`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const answersArr = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer,
      }));

      const res = await fetch(`${API}/surveys/${surveyId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersArr, respondentName: name || 'Anonymous' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Submission failed.');
      setSubmitted(true);
    } catch (err) {
      setSubmitErr(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ──
  if (loading) return (
    <div className="dash-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="dash-loading">
        <div className="dash-spinner" />
        <span>Loading survey…</span>
      </div>
    </div>
  );

  // ── Error ──
  if (error) return (
    <div className="dash-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary,#0a0c10)', marginBottom: 8 }}>
          Survey Unavailable
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted,#6b7280)', marginBottom: 24 }}>{error}</div>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>← Go Back</button>
      </div>
    </div>
  );

  // ── Thank you screen ──
  if (submitted) return (
    <div className="dash-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 64, marginBottom: 16, animation: 'none' }}>🎉</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary,#0a0c10)', marginBottom: 8 }}>
          Thank You!
        </div>
        <div style={{ fontSize: 15, color: 'var(--text-muted,#6b7280)', marginBottom: 8 }}>
          Your response has been recorded for
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-mid,#1d4ed8)', marginBottom: 24 }}>
          {survey.title}
        </div>
        <div className="alert alert-success" style={{ marginBottom: 20 }}>
          ✅ Your answers have been submitted successfully.
        </div>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>← Back to Home</button>
      </div>
    </div>
  );

  return (
    <div className="dash-root" style={{ height: 'auto', minHeight: '100vh', overflowY: 'auto' }}>
      {/* ── Header bar ── */}
      <div style={{
        background: '#ffffff',
        borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
        padding: '16px 36px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="url(#p-grad)" />
            <path d="M8 10h12M8 14h8M8 18h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <defs>
              <linearGradient id="p-grad" x1="0" y1="0" x2="28" y2="28">
                <stop offset="0%" stopColor="#0f2d6e" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
            </defs>
          </svg>
          <span style={{
            fontSize: 18, fontWeight: 800,
            background: 'linear-gradient(135deg, #0f2d6e 0%, #1d4ed8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            SurveyAI
          </span>
          <span style={{
            fontSize: 11, fontWeight: 600, color: '#059669',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            padding: '2px 8px', borderRadius: 12,
          }}>
            Verified Survey
          </span>
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', fontFamily: 'monospace' }}>
          ID: {survey.surveyId}
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '36px 24px 60px' }}>

        {/* Survey info card */}
        <div className="dash-card" style={{ marginBottom: 24, borderTop: '4px solid #1d4ed8' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary,#0a0c10)', marginBottom: 8 }}>
            {survey.title}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-muted,#6b7280)', marginBottom: 14, lineHeight: 1.6 }}>
            {survey.description}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12, color: 'var(--text-muted,#6b7280)' }}>
            <span>📍 {survey.location}</span>
            <span>🕑 Closes: {new Date(survey.endTime).toLocaleString()}</span>
            <span>❓ {survey.questions.length} question{survey.questions.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Optional name */}
          <div className="dash-card" style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary,#374151)', marginBottom: 8 }}>
              Your Name <span style={{ color: 'var(--text-faint,#9ca3af)', fontWeight: 400 }}>(optional)</span>
            </div>
            <input
              className="form-input"
              placeholder="e.g. John Doe (leave blank to remain anonymous)"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          {/* Questions */}
          {survey.questions.map((q, idx) => (
            <div className="question-block" key={q.questionId} style={{ marginBottom: 16 }}>
              <div className="question-block-text">
                <span style={{ color: 'var(--accent-mid,#1d4ed8)', marginRight: 6 }}>{idx + 1}.</span>
                {q.text}
                {q.required && <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>}
              </div>

              {/* SINGLE_CHOICE */}
              {q.type === 'SINGLE_CHOICE' && q.options.map(opt => (
                <div key={opt.optionId}
                  className={`option-choice ${answers[q.questionId] === opt.text ? 'selected' : ''}`}
                  onClick={() => setAnswer(q.questionId, opt.text)}>
                  <span>{answers[q.questionId] === opt.text ? '🔵' : '⚪'}</span> {opt.text}
                </div>
              ))}

              {/* YES_NO */}
              {q.type === 'YES_NO' && ['Yes', 'No'].map(opt => (
                <div key={opt}
                  className={`option-choice ${answers[q.questionId] === opt ? 'selected' : ''}`}
                  onClick={() => setAnswer(q.questionId, opt)}>
                  <span>{answers[q.questionId] === opt ? '🔵' : '⚪'}</span> {opt}
                </div>
              ))}

              {/* MULTIPLE_CHOICE */}
              {q.type === 'MULTIPLE_CHOICE' && q.options.map(opt => {
                const sel = (answers[q.questionId] || []).includes(opt.text);
                return (
                  <div key={opt.optionId}
                    className={`option-choice ${sel ? 'selected' : ''}`}
                    onClick={() => toggleMulti(q.questionId, opt.text)}>
                    <span>{sel ? '☑️' : '☐'}</span> {opt.text}
                  </div>
                );
              })}

              {/* RATING */}
              {q.type === 'RATING' && (
                <div>
                  <div className="star-row">
                    {[1, 2, 3, 4, 5].map(s => (
                      <button key={s} type="button"
                        className={`star-btn ${(answers[q.questionId] || 0) >= s ? 'lit' : ''}`}
                        onClick={() => setAnswer(q.questionId, s)}>★</button>
                    ))}
                    {answers[q.questionId] && (
                      <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--text-muted,#6b7280)' }}>
                        {answers[q.questionId]}/5
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Error */}
          {submitErr && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              ⚠️ {submitErr}
            </div>
          )}

          {/* Submit */}
          <button type="submit" className="btn btn-primary btn-lg"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={submitting}>
            {submitting ? '⏳ Submitting…' : '✅ Submit Survey Response'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--text-faint,#9ca3af)' }}>
            Your response is anonymous unless you enter your name above.
          </div>
        </form>

        {/* ── Public Footer ── */}
        <footer style={{
          textAlign: 'center', marginTop: 48, paddingTop: 24,
          borderTop: '1px solid rgba(0, 0, 0, 0.08)',
          fontSize: 12, color: 'var(--text-muted, #64748b)',
          display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center'
        }}>
          <div>Powered by <strong style={{ color: 'var(--text-primary, #0f172a)' }}>SurveyAI Enterprise</strong> • Protected by 256-bit SSL encryption</div>
          <div style={{ color: 'var(--text-faint, #94a3b8)', fontSize: '11px' }}>Never submit passwords or sensitive personal data through this form.</div>
        </footer>
      </div>
    </div>
  );
}
