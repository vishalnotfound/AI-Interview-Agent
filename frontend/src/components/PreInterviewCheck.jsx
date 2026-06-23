import { useState, useEffect, useRef } from 'react';

export default function PreInterviewCheck({ onReady, onCancel }) {
  const [camStatus, setCamStatus] = useState('checking'); // checking | ok | error
  const [micStatus, setMicStatus] = useState('checking');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    let active = true;
    const checkSystems = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!active) return;
        setCamStatus('ok');
        setMicStatus('ok');
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        if (!active) return;
        setCamStatus('error');
        setMicStatus('error');
        console.error("System check failed:", err);
      }
    };
    checkSystems();
    
    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleJoin = () => {
    if (camStatus === 'ok' && micStatus === 'ok') {
      onReady();
    }
  };

  return (
    <div className="upload-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      {/* Animated background orbs */}
      <div className="bg-orbs" aria-hidden="true">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      <div className="system-check-modal" style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 24px 80px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        zIndex: 10
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Pre-Interview System Check</h2>
          <p style={{ margin: '8px 0 0', color: 'var(--text-muted)' }}>Let's make sure your camera and microphone are working properly before we begin.</p>
        </div>

        <div className="system-video-wrapper" style={{ width: '100%', aspectRatio: '4/3', borderRadius: '12px', background: '#000', overflow: 'hidden', position: 'relative' }}>
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`system-video ${camStatus === 'ok' ? 'active' : ''}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', opacity: camStatus === 'ok' ? 1 : 0, transition: 'opacity 0.3s ease' }}
          />
          {camStatus !== 'ok' && (
            <div className="system-video-placeholder" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>
              {camStatus === 'checking' ? (
                <>
                  <div className="spinner-sm"></div>
                  <p>Requesting access...</p>
                </>
              ) : (
                <>
                  <span className="error-icon" style={{ fontSize: '2rem' }}>⚠️</span>
                  <p>Camera or Microphone access denied</p>
                  <p style={{ fontSize: '0.8rem', textAlign: 'center', maxWidth: '80%' }}>Please allow permissions in your browser settings and refresh the page.</p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="system-status-pills" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <div className={`status-pill ${camStatus}`}>
            <span className="status-icon">📷</span>
            <span>Camera: {camStatus === 'checking' ? 'Checking...' : camStatus === 'ok' ? 'Ready' : 'Error'}</span>
          </div>
          <div className={`status-pill ${micStatus}`}>
            <span className="status-icon">🎤</span>
            <span>Mic: {micStatus === 'checking' ? 'Checking...' : micStatus === 'ok' ? 'Ready' : 'Error'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            style={{ flex: 2 }} 
            onClick={handleJoin}
            disabled={camStatus !== 'ok' || micStatus !== 'ok'}
          >
            Join Interview
          </button>
        </div>
      </div>
    </div>
  );
}
