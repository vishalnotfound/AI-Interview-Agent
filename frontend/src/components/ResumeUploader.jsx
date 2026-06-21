import { useState, useRef, useCallback, useEffect } from 'react';

export default function ResumeUploader({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [parsed, setParsed] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef(null);

  // System Check State
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

  const validateFile = (selected) => {
    const ext = selected.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx', 'doc'].includes(ext)) {
      setError('Please upload a PDF or DOCX file.');
      setFile(null);
      return false;
    }
    setFile(selected);
    setError('');
    return true;
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) validateFile(selected);
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first.');
      return;
    }
    if (camStatus !== 'ok') {
      setError('Camera & Microphone access is required to proceed.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const { uploadResume } = await import('../api');
      const data = await uploadResume(file);
      setParsed(true);
      setLoading(false);
      fileRef.current = data;
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
      setLoading(false);
    }
  };

  const handleStart = () => {
    if (fileRef.current) {
      onUploadSuccess(fileRef.current);
    }
  };

  const currentStep = parsed ? 1 : 0;

  return (
    <div className="upload-container">
      {/* Animated background orbs */}
      <div className="bg-orbs" aria-hidden="true">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      <div className="upload-card">
        <div className="upload-card-left">
          <div className="system-check-container">
            <h2 className="system-check-title">System Check</h2>
            <div className="system-video-wrapper">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className={`system-video ${camStatus === 'ok' ? 'active' : ''}`}
              />
              {camStatus !== 'ok' && (
                <div className="system-video-placeholder">
                  {camStatus === 'checking' ? (
                    <>
                      <div className="spinner-sm"></div>
                      <p>Requesting camera...</p>
                    </>
                  ) : (
                    <>
                      <span className="error-icon">⚠️</span>
                      <p>Camera access denied</p>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="system-status-pills">
              <div className={`status-pill ${camStatus}`}>
                <span className="status-icon">📷</span>
                <span>Camera: {camStatus === 'checking' ? 'Checking' : camStatus === 'ok' ? 'Ready' : 'Error'}</span>
              </div>
              <div className={`status-pill ${micStatus}`}>
                <span className="status-icon">🎤</span>
                <span>Microphone: {micStatus === 'checking' ? 'Checking' : micStatus === 'ok' ? 'Ready' : 'Error'}</span>
              </div>
            </div>
          </div>

        {/* Feature Pills */}
        <div className="feature-pills" style={{ marginTop: 'auto' }}>
          <span className="pill">
            <span className="pill-icon">🎯</span>
            <span>Tailored Questions</span>
          </span>
          <span className="pill">
            <span className="pill-icon">🎙️</span>
            <span>Voice Analysis</span>
          </span>
          <span className="pill">
            <span className="pill-icon">📊</span>
            <span>Smart Feedback</span>
          </span>
        </div>
        </div>

        <div className="upload-card-right">
        {/* Drop Zone */}
        <div
          className={`drop-zone ${dragActive ? 'drag-active' : ''} ${file ? 'has-file' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => document.getElementById('resume-file').click()}
        >
          <input
            type="file"
            accept=".pdf,.docx,.doc"
            onChange={handleFileChange}
            id="resume-file"
            className="file-input"
          />
          {file ? (
            <div className="file-selected">
              <span className="file-icon-selected">📎</span>
              <span className="file-name">{file.name}</span>
              <span className="file-size">{(file.size / 1024).toFixed(0)} KB</span>
            </div>
          ) : (
            <div className="drop-content">
              <div className="drop-icon">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <path d="M20 6v20M12 14l8-8 8 8" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M6 28v4a2 2 0 002 2h24a2 2 0 002-2v-4" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="drop-text">Drag & drop your resume here</p>
              <p className="drop-hint">or click to browse &middot; PDF, DOCX supported</p>
            </div>
          )}
        </div>

        {/* Error */}
        {error && <p className="error-text">{error}</p>}

        {/* Action Buttons */}
        {!parsed ? (
          <button
            className="btn btn-primary btn-glow"
            onClick={handleUpload}
            disabled={!file || loading}
          >
            {loading ? (
              <span className="loading-state">
                <span className="spinner-sm"></span>
                <span>Analyzing Resume</span>
              </span>
            ) : (
              <>
                <span>🚀</span>
                <span>Upload & Analyze</span>
              </>
            )}
          </button>
        ) : (
          <button className="btn btn-success btn-glow" onClick={handleStart}>
            <span>🎤</span>
            <span>Start Interview</span>
          </button>
        )}

        {parsed && (
          <p className="success-text">
            <span className="success-icon">✅</span> Resume analyzed! Ready to start.
          </p>
        )}

        {/* Step indicator */}
        <div className="steps-indicator">
          <div className={`step ${currentStep >= 0 ? 'active' : ''} ${currentStep > 0 ? 'completed' : ''}`}>
            <div className="step-dot">1</div>
            <span className="step-label">Upload</span>
          </div>
          <div className="step-line">
            <div className={`step-line-fill ${currentStep > 0 ? 'filled' : ''}`}></div>
          </div>
          <div className={`step ${currentStep >= 1 ? 'active' : ''}`}>
            <div className="step-dot">2</div>
            <span className="step-label">Interview</span>
          </div>
          <div className="step-line">
            <div className="step-line-fill"></div>
          </div>
          <div className="step">
            <div className="step-dot">3</div>
            <span className="step-label">Report</span>
          </div>
        </div>
        </div>
      </div>
      <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '1.5rem', fontSize: '0.9rem', maxWidth: '600px', margin: '1.5rem auto 0' }}>
        * Note for first-time users: Interview could take up to 30 seconds to start.
      </p>
    </div>
  );
}
