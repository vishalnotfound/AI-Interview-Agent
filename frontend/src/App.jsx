import { useState, useEffect } from 'react';
import ResumeUploader from './components/ResumeUploader';
import PreInterviewCheck from './components/PreInterviewCheck';
import InterviewSession from './components/InterviewSession';
import FinalReport from './components/FinalReport';
import InterviewHistory from './components/InterviewHistory';
import AuthModal from './components/AuthModal';
import UserMenu from './components/UserMenu';
import { useAuth } from './context/AuthContext';
import { wakeUpBackend, apiSaveReport } from './api';
import './App.css';

// Cancel any leftover TTS immediately on page load (runs before React mounts)
window.speechSynthesis?.cancel();

export default function App() {
  const [phase, setPhase] = useState('upload'); // upload | system-check | interview | report | history
  const [sessionId, setSessionId] = useState('');
  const [firstQuestion, setFirstQuestion] = useState('');
  const [finalReport, setFinalReport] = useState(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showPro, setShowPro] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  const { user, token, isLoggedIn } = useAuth();

  // Wake up the Render free-tier backend as soon as the app loads
  useEffect(() => { wakeUpBackend(); }, []);

  const handleUploadSuccess = (data) => {
    setSessionId(data.session_id);
    setFirstQuestion(data.first_question);
    setPhase('system-check');
  };

  const handleSystemCheckComplete = () => {
    setPhase('interview');
  };

  const handleInterviewComplete = async (report) => {
    setFinalReport(report);
    setPhase('report');

    // Auto-save report if user is logged in
    if (isLoggedIn && token) {
      try {
        await apiSaveReport(token, report);
      } catch (err) {
        console.error('Failed to auto-save report:', err);
      }
    }
  };

  const handleInterviewCancel = () => {
    // Reset all interview state and go back to upload
    window.speechSynthesis?.cancel();
    setSessionId('');
    setFirstQuestion('');
    setFinalReport(null);
    setPhase('upload');
  };

  const handleGoHome = () => {
    setPhase('upload');
    setFinalReport(null);
    setSessionId('');
    setFirstQuestion('');
  };

  return (
    <div className="app">
      <header className="app-header">
        <span className="logo" onClick={handleGoHome} style={{ cursor: 'pointer' }}>
          <svg className="logo-icon" width="28" height="28" viewBox="0 0 64 64" style={{ borderRadius: '50%', background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.08)' }}>
            <circle cx="32" cy="32" r="32" fill="#ffffff" />
            <svg x="10" y="10" width="44" height="44" viewBox="6 4 52 52">
              <line x1="32" y1="18" x2="32" y2="8" stroke="#003d29" strokeWidth="4" strokeLinecap="round"/>
              <circle cx="32" cy="8" r="4" fill="#d4af37"/>
              <rect x="12" y="18" width="40" height="38" rx="8" fill="#006241"/>
              <rect x="12" y="44" width="40" height="12" rx="4" fill="#004d33"/>
              <rect x="6" y="30" width="6" height="14" rx="2" fill="#003d29"/>
              <rect x="52" y="30" width="6" height="14" rx="2" fill="#003d29"/>
              <circle cx="24" cy="32" r="9" fill="#ffffff"/>
              <circle cx="25" cy="35" r="3.5" fill="#1e3932"/>
              <circle cx="26" cy="36" r="1" fill="#ffffff"/>
              <circle cx="40" cy="32" r="9" fill="#ffffff"/>
              <circle cx="42" cy="29" r="4" fill="#1e3932"/>
              <circle cx="42.5" cy="28.5" r="1" fill="#ffffff"/>
              <line x1="24" y1="50" x2="40" y2="50" stroke="#edebe4" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="28" y1="48" x2="28" y2="52" stroke="#edebe4" strokeWidth="2" strokeLinecap="round"/>
              <line x1="32" y1="48" x2="32" y2="52" stroke="#edebe4" strokeWidth="2" strokeLinecap="round"/>
              <line x1="36" y1="48" x2="36" y2="52" stroke="#edebe4" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </svg>
          <span className="logo-text">InterviewAI</span>
        </span>
        <div className="header-actions">
          <button className="nav-btn" onClick={() => setShowPro(true)}>Premium</button>
          <button className="nav-btn" onClick={() => setShowAbout(true)}>About</button>
          <a href="https://github.com/vishalnotfound/AI-Interview-Agent-bot" target="_blank" rel="noopener noreferrer" className="nav-icon-btn" title="go to github repo">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
            </svg>
          </a>
          {/* Auth button — Login or UserMenu */}
          {isLoggedIn ? (
            <UserMenu onHistoryClick={() => setPhase('history')} />
          ) : (
            <button className="nav-btn auth-login-btn" onClick={() => setShowAuth(true)}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Login
            </button>
          )}
        </div>
      </header>

      <main className="app-main">
        {phase === 'upload' && (
          <ResumeUploader onUploadSuccess={handleUploadSuccess} />
        )}
        {phase === 'system-check' && (
          <PreInterviewCheck 
            onReady={handleSystemCheckComplete}
            onCancel={handleInterviewCancel}
          />
        )}
        {phase === 'interview' && (
          <InterviewSession
            sessionId={sessionId}
            firstQuestion={firstQuestion}
            onComplete={handleInterviewComplete}
            onCancel={handleInterviewCancel}
          />
        )}
        {phase === 'report' && (
          <FinalReport report={finalReport} />
        )}
        {phase === 'history' && (
          <InterviewHistory onBack={handleGoHome} />
        )}
      </main>

      {showAbout && (
        <div className="modal-overlay" onClick={() => setShowAbout(false)}>
          <div className="about-modal" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowAbout(false)}>×</button>
            <h2>About InterviewAI</h2>
            <p className="about-desc" style={{ marginBottom: '10px' }}>
              InterviewAI is an AI-powered interview platform that analyzes your resume and conducts interactive, voice-based interviews. It adapts in real-time by generating questions based on your previous answers, simulating a realistic interview experience.
            </p>
            <p className="about-desc" style={{ marginBottom: '16px' }}>
              Get a detailed report at the end with a score out of 100, along with insights into your strengths and areas for improvement—so you know exactly what to work on.
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '10px' }}>
              More features are being tested and coming soon...
            </p>
            
            {/* Pro section moved to dedicated modal */}
            <div className="author-info">
              <p>Developed by <strong>Vishal Verma</strong></p>
              <div className="social-links">
                <a href="https://github.com/vishalnotfound" target="_blank" rel="noopener noreferrer" className="social-btn github-btn">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                  </svg>
                  GitHub
                </a>
                <a href="https://www.linkedin.com/in/vishalx343/" target="_blank" rel="noopener noreferrer" className="social-btn linkedin-btn">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.475-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  LinkedIn
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPro && (
        <div className="modal-overlay" onClick={() => setShowPro(false)}>
          <div className="about-modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowPro(false)}>×</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0 }}>Premium Features</h2>
              <span style={{ background: 'var(--warning)', color: '#fff', fontSize: '0.75rem', fontWeight: '700', padding: '2px 8px', borderRadius: '12px' }}>PAID</span>
            </div>
            <p className="about-desc" style={{ fontSize: '0.9rem' }}>
              We're continuously improving InterviewAI with powerful new features:
            </p>
            <ul className="features-list">
              <li><strong>AI Video Proctoring</strong> – Ensure realistic, distraction-free interview environments</li>
              <li><strong>Advanced Personalization</strong> – Tailored questions based on your profile, performance, and goals</li>
              <li><strong>User Accounts & History Tracking</strong> – Log in to access past interviews, reports, and progress over time</li>
              <li><strong>PDF Report Downloads</strong> – Save and share detailed interview reports with scores and insights</li>
              <li><strong>Job Recommendations</strong> – Get role suggestions based on your resume and interview performance</li>
              <li><strong>Performance Analytics</strong> – Deeper insights into strengths, weaknesses, and improvement areas</li>
              <li><strong>Enhanced Feedback System</strong> – More accurate and actionable suggestions</li>
            </ul>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 'auto' }}>
              *Note: These premium features are currently actively being designed and tested.
            </p>
          </div>
        </div>
      )}

      {showAuth && (
        <AuthModal onClose={() => setShowAuth(false)} />
      )}
    </div>
  );
}
