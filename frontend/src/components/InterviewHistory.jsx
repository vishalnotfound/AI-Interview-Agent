import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiGetHistory, apiDeleteReport } from '../api';
import FinalReport from './FinalReport';

export default function InterviewHistory({ onBack }) {
  const { token } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [deleting, setDeleting] = useState(null);

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

  // Render expanded report
  if (expandedId) {
    const record = records.find((r) => r.id === expandedId);
    if (record) {
      return (
        <div className="history-container" style={{ animation: 'slideUp 0.4s ease' }}>
          <button className="btn btn-secondary history-back-btn" onClick={() => setExpandedId(null)}>
            ← Back to History
          </button>
          <p className="history-record-date" style={{ textAlign: 'center', marginBottom: '8px' }}>
            {formatDate(record.created_at)}
          </p>
          <FinalReport report={record} />
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
              onClick={() => setExpandedId(record.id)}
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
                <span className="history-view-hint">Click to view full report →</span>
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
