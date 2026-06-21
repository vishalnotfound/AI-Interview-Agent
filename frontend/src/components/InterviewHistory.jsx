import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiGetHistory, apiDeleteReport, apiGetProctorFlags } from '../api';
import FinalReport from './FinalReport';

export default function InterviewHistory({ onBack }) {
  const { token } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [deleting, setDeleting] = useState(null);

  // Proctoring log state
  const [proctorFlags, setProctorFlags] = useState([]);
  const [proctorLoading, setProctorLoading] = useState(false);
  const [lightboxImg, setLightboxImg] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGetHistory(token);
      setRecords(data.records || []);
    } catch (err) {
      setError(err.message || 'Failed to load history.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (recordId, e) => {
    e.stopPropagation();
    if (deleting) return;
    setDeleting(recordId);
    try {
      await apiDeleteReport(token, recordId);
      setRecords((prev) => prev.filter((r) => r.id !== recordId));
      if (expandedId === recordId) setExpandedId(null);
    } catch (err) {
      setError(err.message || 'Failed to delete record.');
    } finally {
      setDeleting(null);
    }
  };

  const handleExpand = async (recordId) => {
    setExpandedId(recordId);
    setProctorFlags([]);
    setProctorLoading(true);
    try {
      const data = await apiGetProctorFlags(token, recordId);
      setProctorFlags(data.flags || []);
    } catch (err) {
      console.error('Failed to load proctor flags:', err);
      setProctorFlags([]);
    } finally {
      setProctorLoading(false);
    }
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return 'Unknown date';
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTimestamp = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getScoreColor = (score) => {
    if (score >= 75) return 'var(--success)';
    if (score >= 50) return 'var(--warning)';
    return 'var(--danger)';
  };

  const getRecBadgeClass = (rec) => {
    const map = {
      'Strongly Recommend': 'rec-strong',
      'Recommend': 'rec-good',
      'Consider': 'rec-consider',
      'Do Not Recommend': 'rec-no',
    };
    return map[rec] || 'rec-good';
  };

  const getObjectIcon = (label) => {
    const icons = {
      'cell phone': '📱',
      'book': '📖',
      'laptop': '💻',
      'remote': '🎮',
      'tablet': '📋',
    };
    return icons[label] || '⚠️';
  };

  // Render expanded report
  if (expandedId) {
    const record = records.find((r) => r.id === expandedId);
    if (record) {
      return (
        <div className="history-container" style={{ animation: 'slideUp 0.4s ease' }}>
          <button className="btn btn-secondary history-back-btn" onClick={() => { setExpandedId(null); setProctorFlags([]); }}>
            ← Back to History
          </button>
          <p className="history-record-date" style={{ textAlign: 'center', marginBottom: '8px' }}>
            {formatDate(record.created_at)}
          </p>
          <FinalReport report={record} />

          {/* ─── Proctoring Log Section ─── */}
          <div className="proctor-log-section">
            <div className="proctor-log-header">
              <h3 className="proctor-log-title">
                🛡️ Proctoring Log
              </h3>
              {!proctorLoading && (
                <span className={`proctor-log-status ${proctorFlags.length === 0 ? 'clean' : 'flagged'}`}>
                  {proctorFlags.length === 0 ? '✅ Clean Session' : `🚩 ${proctorFlags.length} Flag${proctorFlags.length > 1 ? 's' : ''}`}
                </span>
              )}
            </div>

            {proctorLoading && (
              <div className="proctor-log-loading">
                <div className="spinner" />
                <span>Loading proctoring data…</span>
              </div>
            )}

            {!proctorLoading && proctorFlags.length === 0 && (
              <div className="proctor-log-empty">
                <div className="proctor-log-empty-icon">🎉</div>
                <p>No suspicious items were detected during this interview.</p>
                <p className="proctor-log-empty-sub">The session was completed without any proctoring flags.</p>
              </div>
            )}

            {!proctorLoading && proctorFlags.length > 0 && (
              <div className="proctor-log-timeline">
                {proctorFlags.map((flag, index) => (
                  <div key={flag.id || index} className="proctor-log-item">
                    <div className="proctor-log-item-marker">
                      <div className="proctor-log-dot" />
                      {index < proctorFlags.length - 1 && <div className="proctor-log-line" />}
                    </div>
                    <div className="proctor-log-item-content">
                      <div className="proctor-log-item-header">
                        <span className="proctor-log-item-icon">
                          {getObjectIcon(flag.object_label)}
                        </span>
                        <span className="proctor-log-item-label">{flag.object_label}</span>
                        <span className="proctor-log-item-confidence">
                          {Math.round(flag.confidence * 100)}% confidence
                        </span>
                        <span className="proctor-log-item-time">
                          {formatTimestamp(flag.timestamp)}
                        </span>
                      </div>
                      {flag.screenshot && (
                        <div
                          className="proctor-log-thumbnail"
                          onClick={() => setLightboxImg(flag.screenshot)}
                          title="Click to enlarge"
                        >
                          <img src={flag.screenshot} alt={`Flagged: ${flag.object_label}`} />
                          <div className="proctor-log-thumbnail-overlay">
                            <span>🔍 Click to enlarge</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lightbox Modal */}
          {lightboxImg && (
            <div className="proctor-lightbox" onClick={() => setLightboxImg(null)}>
              <div className="proctor-lightbox-content" onClick={(e) => e.stopPropagation()}>
                <button className="proctor-lightbox-close" onClick={() => setLightboxImg(null)}>×</button>
                <img src={lightboxImg} alt="Proctoring screenshot" />
              </div>
            </div>
          )}
        </div>
      );
    }
  }

  return (
    <div className="history-container">
      <div className="history-header">
        <button className="btn btn-secondary history-back-btn" onClick={onBack}>
          ← Back to Home
        </button>
        <h2 className="history-title">📜 Interview History</h2>
        <p className="history-subtitle">
          {records.length > 0
            ? `You have ${records.length} past interview${records.length > 1 ? 's' : ''}`
            : ''}
        </p>
      </div>

      {loading && (
        <div className="history-loading">
          <div className="spinner"></div>
          <p>Loading your history…</p>
        </div>
      )}

      {error && <p className="error-text" style={{ textAlign: 'center' }}>{error}</p>}

      {!loading && !error && records.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <h3>No interviews yet</h3>
          <p>Complete your first interview to see it here. Your reports will be saved automatically.</p>
          <button className="btn btn-primary" onClick={onBack} style={{ maxWidth: '240px' }}>
            Start Interview
          </button>
        </div>
      )}

      {!loading && records.length > 0 && (
        <div className="history-grid">
          {records.map((record) => (
            <div
              key={record.id}
              className="history-card"
              onClick={() => handleExpand(record.id)}
            >
              <div className="history-card-top">
                <div className="history-score-ring">
                  <svg viewBox="0 0 36 36">
                    <path
                      className="score-bg"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="score-fill"
                      strokeDasharray={`${record.overall_score}, 100`}
                      style={{ stroke: getScoreColor(record.overall_score) }}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <span className="history-score-value" style={{ color: getScoreColor(record.overall_score) }}>
                    {record.overall_score}
                  </span>
                </div>

                <div className="history-card-info">
                  <span className="history-card-date">{formatDate(record.created_at)}</span>
                  <span className={`history-rec-badge ${getRecBadgeClass(record.hire_recommendation)}`}>
                    {record.hire_recommendation}
                  </span>
                </div>
              </div>

              <p className="history-card-summary">{record.summary}</p>

              <div className="history-card-actions">
                <div className="history-card-actions-left">
                  <span className="history-view-hint">Click to view full report →</span>
                  {/* Proctor flag badge on card */}
                  {record.flag_count > 0 ? (
                    <span className="history-flag-badge flagged">
                      🚩 {record.flag_count} flag{record.flag_count > 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="history-flag-badge clean">
                      ✅ Clean
                    </span>
                  )}
                </div>
                <button
                  className="history-delete-btn"
                  onClick={(e) => handleDelete(record.id, e)}
                  disabled={deleting === record.id}
                  title="Delete this record"
                >
                  {deleting === record.id ? '⏳' : '🗑️'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
