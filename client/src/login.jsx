import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import axios from 'axios';
import surveyBoard from './assets/surveyboard.webp';
import surveyCrayon from './assets/surveycrayon.webp';
import './login.css';

gsap.registerPlugin(ScrollTrigger);

const API = '/api/auth';

const FEATURES = [
  {
    icon: '📊',
    title: 'Real-Time Analytics',
    desc: 'Watch responses pour in live. Beautiful dashboards update instantly as your audience responds.',
  },
  {
    icon: '🤖',
    title: 'AI-Powered Insights',
    desc: 'Our AI analyses trends, sentiments, and patterns across thousands of responses automatically.',
  },
  {
    icon: '🎨',
    title: 'Drag & Drop Builder',
    desc: 'Create stunning surveys in minutes with our intuitive no-code builder. 50+ question types.',
  },
  {
    icon: '🔒',
    title: 'Enterprise Security',
    desc: 'End-to-end encryption, GDPR compliance, and role-based access control built in by default.',
  },
  {
    icon: '🌐',
    title: 'Multi-Channel Reach',
    desc: 'Distribute via email, QR code, embed, or link. Reach your audience wherever they are.',
  },
  {
    icon: '📁',
    title: 'Export Everything',
    desc: 'Export to CSV, Excel, PDF or push directly to your CRM, Slack, or Google Sheets.',
  },
];

const STATS = [
  { value: '2M+', label: 'Surveys Created' },
  { value: '98%', label: 'Satisfaction Rate' },
  { value: '150+', label: 'Countries Reached' },
  { value: '10x', label: 'Faster Insights' },
];

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Refs
  const pageRef       = useRef(null);
  const canvasRef     = useRef(null);
  const animFrameRef  = useRef(null);
  const cardRef       = useRef(null);
  const orb1Ref       = useRef(null);
  const orb2Ref       = useRef(null);
  const orb3Ref       = useRef(null);
  const titleRef      = useRef(null);
  const formRef       = useRef(null);
  const googleRef     = useRef(null);
  // Scroll section refs
  const scrollSecRef  = useRef(null);
  const img1Ref       = useRef(null);
  const img2Ref       = useRef(null);
  const taglineRef    = useRef(null);
  const statsRef      = useRef(null);
  const featuresRef   = useRef(null);
  const ctaBannerRef  = useRef(null);

  /* ─── Canvas Particle Animation (hero only) ─────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const hero = canvas.parentElement;
    let w = (canvas.width = hero.offsetWidth || window.innerWidth);
    let h = (canvas.height = hero.offsetHeight || window.innerHeight);

    // Light-mode particle settings: soft navy dots on white background
    const baseHue = 215; // dark-blue family

    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.8 + 0.4,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.4,
      alpha: Math.random() * 0.18 + 0.05,
      hue: Math.random() * 30 + baseHue,  // 215–245 navy→royal-blue
    }));

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `hsla(${baseHue},70%,35%,${0.05 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      particles.forEach(p => {
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0 || p.x > w) p.dx *= -1;
        if (p.y < 0 || p.y > h) p.dy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},65%,38%,${p.alpha})`;
        ctx.fill();
      });
      animFrameRef.current = requestAnimationFrame(draw);
    };
    draw();

    const onResize = () => {
      w = canvas.width = hero.offsetWidth || window.innerWidth;
      h = canvas.height = hero.offsetHeight || window.innerHeight;
    };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(animFrameRef.current); window.removeEventListener('resize', onResize); };
  }, []);

  /* ─── GSAP Hero Entrance + Orbs ────────────────────────── */
  useEffect(() => {
    gsap.to(orb1Ref.current, { y: -40, x: 20, duration: 6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    gsap.to(orb2Ref.current, { y: 30, x: -25, duration: 8, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    gsap.to(orb3Ref.current, { y: -20, x: 15, duration: 5, ease: 'sine.inOut', yoyo: true, repeat: -1 });

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(cardRef.current,  { opacity: 0, y: 60, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.9 })
      .fromTo(titleRef.current, { opacity: 0, y: 20 },               { opacity: 1, y: 0, duration: 0.5 }, '-=0.4')
      .fromTo(formRef.current,  { opacity: 0, y: 20 },               { opacity: 1, y: 0, duration: 0.5 }, '-=0.2');
  }, []);

  /* ─── GSAP ScrollTrigger Animations ────────────────────── */
  useEffect(() => {
    const ctx = gsap.context(() => {

      // Tagline fade-up
      gsap.fromTo(taglineRef.current,
        { opacity: 0, y: 60 },
        { opacity: 1, y: 0, duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: taglineRef.current, start: 'top 85%', toggleActions: 'play none none reverse' }
        }
      );

      // Image 1 — slide from left
      gsap.fromTo(img1Ref.current,
        { opacity: 0, x: -100, rotation: -4 },
        { opacity: 1, x: 0, rotation: 0, duration: 1.1, ease: 'power3.out',
          scrollTrigger: { trigger: img1Ref.current, start: 'top 80%', toggleActions: 'play none none reverse' }
        }
      );

      // Image 2 — slide from right + parallax
      gsap.fromTo(img2Ref.current,
        { opacity: 0, x: 100, rotation: 4 },
        { opacity: 1, x: 0, rotation: 0, duration: 1.1, ease: 'power3.out',
          scrollTrigger: { trigger: img2Ref.current, start: 'top 80%', toggleActions: 'play none none reverse' }
        }
      );

      // Parallax float on scroll for both images
      gsap.to(img1Ref.current, {
        y: -40,
        ease: 'none',
        scrollTrigger: { trigger: scrollSecRef.current, start: 'top bottom', end: 'bottom top', scrub: 1.5 },
      });
      gsap.to(img2Ref.current, {
        y: 30,
        ease: 'none',
        scrollTrigger: { trigger: scrollSecRef.current, start: 'top bottom', end: 'bottom top', scrub: 2 },
      });

      // Stats counter pop-in
      gsap.fromTo(statsRef.current.querySelectorAll('.stat-item'),
        { opacity: 0, y: 40, scale: 0.85 },
        { opacity: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.12, ease: 'back.out(1.6)',
          scrollTrigger: { trigger: statsRef.current, start: 'top 82%', toggleActions: 'play none none reverse' }
        }
      );

      // Feature cards stagger
      gsap.fromTo(featuresRef.current.querySelectorAll('.feature-card'),
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 0.7, stagger: 0.1, ease: 'power3.out',
          scrollTrigger: { trigger: featuresRef.current, start: 'top 82%', toggleActions: 'play none none reverse' }
        }
      );

      // CTA banner zoom
      gsap.fromTo(ctaBannerRef.current,
        { opacity: 0, scale: 0.94 },
        { opacity: 1, scale: 1, duration: 0.9, ease: 'power3.out',
          scrollTrigger: { trigger: ctaBannerRef.current, start: 'top 85%', toggleActions: 'play none none reverse' }
        }
      );

    }, scrollSecRef);

    return () => ctx.revert();
  }, []);

  /* ─── Helpers ───────────────────────────────────────────── */
  const switchMode = (newMode) => {
    if (newMode === mode) return;
    gsap.to(formRef.current, {
      opacity: 0, y: 10, duration: 0.2,
      onComplete: () => {
        setMode(newMode); setError(''); setForm({ name: '', email: '', password: '' });
        gsap.fromTo(formRef.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out' });
      },
    });
  };

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const successNav = (role) => gsap.to(cardRef.current, {
    scale: 1.04, opacity: 0, duration: 0.4, ease: 'power2.in',
    onComplete: () => {
      const path = role === 'ADMIN'    ? '/dashboard/admin'
                 : role === 'SURVEYER' ? '/dashboard/surveyer'
                 : '/dashboard/user';
      navigate(path);
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    gsap.fromTo(cardRef.current, { scale: 1 }, { scale: 0.98, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.inOut' });
    try {
      if (mode === 'login') {
        const { data } = await axios.post(`${API}/login`, { loginId: form.email, password: form.password });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        successNav(data.user.role);
      } else {
        await axios.post(`${API}/register`, { name: form.name, email: form.email, password: form.password });
        const { data } = await axios.post(`${API}/login`, { loginId: form.email, password: form.password });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        successNav(data.user.role);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong.');
      gsap.fromTo(cardRef.current, { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' });
    } finally { setLoading(false); }
  };


  return (
    <div className="lp-root" ref={pageRef}>

      {/* ══════════════════ HEADER ══════════════════ */}
      <header className="lp-header" role="banner">
        <div className="lp-header-inner">
          {/* Logo */}
          <a href="/" className="lp-header-logo" aria-label="SurveyAI Homepage">
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #0f2d6e 0%, #1d4ed8 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 10px rgba(15, 45, 110, 0.28)',
            }}>
              <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
                <path d="M7 10h14M7 14h10M7 18h12" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </div>
            <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>SurveyAI</span>
          </a>

          {/* Nav links */}
          <nav className="lp-header-nav" aria-label="Landing Navigation">
            <a href="#features" className="lp-header-link">Features</a>
            <a href="#how-it-works" className="lp-header-link">How It Works</a>
            <a href="#stats" className="lp-header-link">Impact & Stats</a>
            <a href="#security" className="lp-header-link" onClick={(e) => { e.preventDefault(); const el = document.getElementById('contact'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}>Security & Trust</a>
            <a href="#contact" className="lp-header-link">Contact</a>
          </nav>

          {/* Actions */}
          <div className="lp-header-actions">
            <div style={{
              display: 'none', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#059669',
              background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)',
              padding: '4px 10px', borderRadius: 16,
            }} className="lp-header-status-badge">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
              Operational
            </div>
            <button className="lp-header-signin" onClick={() => { switchMode('login'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              Sign In
            </button>
            <button className="lp-header-cta" onClick={() => { switchMode('register'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              Get Started Free →
            </button>
          </div>
        </div>
      </header>

      {/* ══════════════════ HERO SECTION ══════════════════ */}
      <section className="lp-hero">
        <canvas ref={canvasRef} className="lp-canvas" />
        <div ref={orb1Ref} className="orb orb-1" />
        <div ref={orb2Ref} className="orb orb-2" />
        <div ref={orb3Ref} className="orb orb-3" />

        {/* Login Card */}
        <div ref={cardRef} className="login-card">
          <div className="brand">
            <div className="brand-icon">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect width="28" height="28" rx="8" fill="url(#lg)" />
                <path d="M8 10h12M8 14h8M8 18h10" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <defs>
                  <linearGradient id="lg" x1="0" y1="0" x2="28" y2="28">
                    <stop offset="0%" stopColor="#0f2d6e" />
                    <stop offset="100%" stopColor="#1d4ed8" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="brand-name">SurveyAI</span>
          </div>

          <div ref={titleRef} className="card-header">
            <h1 className="card-title">{mode === 'login' ? 'Welcome back' : 'Create account'}</h1>
            <p className="card-subtitle">
              {mode === 'login' ? 'Sign in to continue to SurveyAI' : "Join SurveyAI — it's free"}
            </p>
          </div>

          <div className="tab-switcher">
            <button className={`tab-btn ${mode === 'login' ? 'active' : ''}`} onClick={() => switchMode('login')}>Sign In</button>
            <button className={`tab-btn ${mode === 'register' ? 'active' : ''}`} onClick={() => switchMode('register')}>Register</button>
            <div className={`tab-slider ${mode === 'register' ? 'right' : ''}`} />
          </div>

          <form ref={formRef} className="auth-form" onSubmit={handleSubmit} noValidate>
            {mode === 'register' && (
              <div className="field-group">
                <label htmlFor="reg-name">Full Name</label>
                <div className="input-wrapper">
                  <span className="input-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  </span>
                  <input id="reg-name" type="text" name="name" placeholder="John Doe" value={form.name} onChange={handleChange} required autoComplete="name" />
                </div>
              </div>
            )}

            <div className="field-group">
              <label htmlFor="auth-email">Email Address</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                </span>
                <input id="auth-email" type="email" name="email" placeholder="you@example.com" value={form.email} onChange={handleChange} required autoComplete="email" />
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="auth-password">Password</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                </span>
                <input id="auth-password" type="password" name="password" placeholder={mode === 'register' ? 'Min. 6 characters' : 'Enter password'} value={form.password} onChange={handleChange} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              </div>
            </div>

            {error && (
              <div className="error-box">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                {error}
              </div>
            )}

            <button id="auth-submit-btn" type="submit" className="submit-btn" disabled={loading}>
              {loading ? <span className="spinner" /> : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="footer-note">
            By continuing, you agree to our <a href="#terms">Terms of Service</a> &amp; <a href="#privacy">Privacy Policy</a>.
          </p>
        </div>

        {/* Scroll hint */}
        <div className="scroll-hint">
          <span>Discover SurveyAI</span>
          <div className="scroll-arrow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
          </div>
        </div>
      </section>

      {/* ══════════════════ SCROLL SECTION ══════════════════ */}
      <div className="lp-scroll-sections" ref={scrollSecRef}>

        {/* ── Tagline ── */}
        <section className="sec-tagline" ref={taglineRef}>
          <p className="sec-eyebrow">The smart way to survey</p>
          <h2 className="sec-headline">
            Turn questions into<br />
            <span className="grad-text">actionable intelligence</span>
          </h2>
          <p className="sec-body">
            SurveyAI combines powerful survey creation with AI analysis to help you understand your audience faster than ever before.
          </p>
        </section>

        {/* ── Image + Text Row 1 ── */}
        <section className="sec-image-row" id="how-it-works">
          <div className="image-col" ref={img1Ref}>
            <div className="img-frame">
              <img src={surveyBoard} alt="Survey clipboard illustration" className="feature-img" />
              <div className="img-glow img-glow-purple" />
            </div>
          </div>
          <div className="text-col">
            <span className="pill">📋 Smart Forms</span>
            <h3 className="text-col-title">Build surveys in minutes, not hours</h3>
            <p className="text-col-body">
              Our drag-and-drop builder with 50+ question types means you can go from idea to live survey in under 5 minutes. Conditional logic, branching, and skip rules work exactly as you'd expect.
            </p>
            <ul className="check-list">
              <li>✓ 50+ question types</li>
              <li>✓ Conditional branching logic</li>
              <li>✓ Mobile-first responsive design</li>
              <li>✓ Custom themes & branding</li>
            </ul>
          </div>
        </section>

        {/* ── Stats ── */}
        <section className="sec-stats" id="stats" ref={statsRef}>
          <div className="stats-grid">
            {STATS.map(s => (
              <div className="stat-item" key={s.label}>
                <span className="stat-value">{s.value}</span>
                <span className="stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Image + Text Row 2 (reversed) ── */}
        <section className="sec-image-row sec-image-row--rev">
          <div className="image-col" ref={img2Ref}>
            <div className="img-frame img-frame--teal">
              <img src={surveyCrayon} alt="Colorful survey crayons" className="feature-img" />
              <div className="img-glow img-glow-teal" />
            </div>
          </div>
          <div className="text-col">
            <span className="pill pill--teal">🤖 AI Analysis</span>
            <h3 className="text-col-title">Insights in seconds, not days</h3>
            <p className="text-col-body">
              Stop spending hours in spreadsheets. SurveyAI reads through every response, detects sentiment, identifies key themes, and surfaces what matters most — automatically.
            </p>
            <ul className="check-list">
              <li>✓ Sentiment analysis per response</li>
              <li>✓ Auto-theme clustering</li>
              <li>✓ Real-time live dashboards</li>
              <li>✓ Export to CSV / Excel / PDF</li>
            </ul>
          </div>
        </section>

        {/* ── Feature Grid ── */}
        <section className="sec-features" id="features">
          <p className="sec-eyebrow">Everything you need</p>
          <h2 className="sec-headline sec-headline--center">Built for teams of all sizes</h2>
          <div className="features-grid" ref={featuresRef}>
            {FEATURES.map(f => (
              <div className="feature-card" key={f.title}>
                <span className="feature-icon">{f.icon}</span>
                <h4 className="feature-title">{f.title}</h4>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA Banner ── */}
        <section className="sec-cta" ref={ctaBannerRef}>
          <div className="cta-card">
            <div className="cta-orb cta-orb-1" />
            <div className="cta-orb cta-orb-2" />
            <h2 className="cta-title">Ready to get started?</h2>
            <p className="cta-sub">Join 2 million+ teams already using SurveyAI to collect smarter feedback.</p>
            <button
              className="cta-btn"
              onClick={() => {
                switchMode('register');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              Create Free Account →
            </button>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="lp-footer" id="contact" role="contentinfo">
          <div className="lp-footer-top">
            {/* Brand column */}
            <div className="lp-footer-col lp-footer-brand-col">
              <div className="lp-footer-logo">
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                    <path d="M7 10h14M7 14h10M7 18h12" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
                  </svg>
                </div>
                <span>SurveyAI</span>
              </div>
              <p className="lp-footer-tagline">
                The enterprise platform for real-time survey orchestration, geofenced polling, and AI-driven sentiment analysis.
              </p>

              {/* Trust Badges */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8' }}>
                  <span>🛡️</span>
                  <span><strong>SOC 2 Type II</strong> Certified Infrastructure</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8' }}>
                  <span>🔒</span>
                  <span><strong>256-Bit TLS</strong> Encryption &amp; GDPR Compliant</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  <span><strong>99.98%</strong> High-Availability SLA</span>
                </div>
              </div>

              {/* Social icons */}
              <div className="lp-footer-socials">
                {[
                  { label:'Twitter/X', path:'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.261 5.638 5.9-5.638zm-1.161 17.52h1.833L7.084 4.126H5.117z' },
                  { label:'LinkedIn', path:'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z M4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' },
                  { label:'GitHub',   path:'M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22' },
                ].map(s => (
                  <a key={s.label} href="#" aria-label={s.label} className="lp-footer-social-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d={s.path} />
                    </svg>
                  </a>
                ))}
              </div>
            </div>

            {/* Product column */}
            <div className="lp-footer-col">
              <div className="lp-footer-col-title">Product</div>
              <ul className="lp-footer-links">
                {['Survey Builder', 'Sentiment & CSAT Engine', 'Geofenced Distribution', 'Live Analytics', 'PDF Export Reports'].map(l => (
                  <li key={l}><a href="#features" className="lp-footer-link">{l}</a></li>
                ))}
              </ul>
            </div>

            {/* Solutions column */}
            <div className="lp-footer-col">
              <div className="lp-footer-col-title">Solutions</div>
              <ul className="lp-footer-links">
                {['Municipal & Smart Cities', 'Public Transport Studies', 'Citizen Sentiment Pulse', 'Research & Academia', 'Enterprise Teams'].map(l => (
                  <li key={l}><a href="#how-it-works" className="lp-footer-link">{l}</a></li>
                ))}
              </ul>
            </div>

            {/* Trust & Security column */}
            <div className="lp-footer-col">
              <div className="lp-footer-col-title">Trust & Security</div>
              <ul className="lp-footer-links">
                {['Security Architecture', 'Privacy Framework', 'Data Encryption Standards', 'Compliance & Audits', 'System Status (99.98%)'].map(l => (
                  <li key={l}><a href="#stats" className="lp-footer-link">{l}</a></li>
                ))}
              </ul>
            </div>

            {/* Company & Support column */}
            <div className="lp-footer-col">
              <div className="lp-footer-col-title">Resources</div>
              <ul className="lp-footer-links">
                {['Documentation', 'REST API Reference', 'Help Center', 'Release Notes', 'Contact Support'].map(l => (
                  <li key={l}><a href="#features" className="lp-footer-link">{l}</a></li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="lp-footer-bottom">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <p className="lp-footer-copy">© {new Date().getFullYear()} SurveyAI Technologies Inc. All rights reserved.</p>
              <span style={{ color: '#334155' }}>•</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#34d399' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                All Systems Operational
              </span>
            </div>
            <div className="lp-footer-legal">
              <a href="#privacy" className="lp-footer-legal-link">Privacy Policy</a>
              <a href="#terms" className="lp-footer-legal-link">Terms of Service</a>
              <a href="#cookies" className="lp-footer-legal-link">Cookie Preferences</a>
              <a href="#security" className="lp-footer-legal-link">Security Whitepaper</a>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
