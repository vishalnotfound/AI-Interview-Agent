export default function FinalReport({ report }) {
  if (!report) return null;

  const scoreColor =
    report.overall_score >= 75 ? 'var(--success)' :
    report.overall_score >= 50 ? 'var(--warning)' : 'var(--danger)';

  const recColor = {
    'Strongly Recommend': 'var(--success)',
    'Recommend': 'var(--primary)',
    'Consider': 'var(--warning)',
    'Do Not Recommend': 'var(--danger)',
  };

  return (
    <div className="report-container">
      <h1 className="report-title">🎯 Interview Report</h1>

      <div className="score-hero">
        <svg viewBox="0 0 36 36" className="big-ring">
          <path
            className="score-bg"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
          <path
            className="score-fill"
            strokeDasharray={`${report.overall_score}, 100`}
            style={{ stroke: scoreColor }}
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
          />
        </svg>
        <div className="score-center">
          <span className="big-score" style={{ color: scoreColor }}>{report.overall_score}</span>
          <span className="score-out-of">/100</span>
        </div>
      </div>

      <div
        className="recommendation-badge"
        style={{ backgroundColor: recColor[report.hire_recommendation] || 'var(--primary)' }}
      >
        {report.hire_recommendation}
      </div>

      <div className="report-section">
        <h3>📝 Summary</h3>
        <p>{report.summary}</p>
      </div>

      <div className="report-grid">
        <div className="report-card strength-card">
          <h3>💪 Strong Areas</h3>
          <p>{report.strong_areas}</p>
        </div>
        <div className="report-card weakness-card">
          <h3>⚠️ Areas to Improve</h3>
          <p>{report.weak_areas}</p>
        </div>
      </div>

      <div className="report-section roadmap-section">
        <h3>🗺️ Improvement Roadmap</h3>
        <p>{report.improvement_roadmap}</p>
      </div>

      {report.proctor_flags && report.proctor_flags.length > 0 && (
        <div className="report-section proctor-section" style={{ marginTop: '30px' }}>
          <h3 className="proctor-log-title" style={{ marginBottom: '16px' }}>🛡️ Proctoring Log</h3>
          <div className="proctor-log-timeline">
            {report.proctor_flags.map((flag, index) => (
              <div key={index} className="proctor-log-item">
                <div className="proctor-log-item-marker">
                  <div className="proctor-log-dot" />
                  {index < report.proctor_flags.length - 1 && <div className="proctor-log-line" />}
                </div>
                <div className="proctor-log-item-content">
                  <div className="proctor-log-item-header">
                    <span className="proctor-log-item-label">{flag.object_label}</span>
                    <span className="proctor-log-item-confidence">
                      {Math.round(flag.confidence * 100)}% confidence
                    </span>
                  </div>
                  {flag.screenshot && (
                    <div className="proctor-log-thumbnail" style={{ marginTop: '8px' }}>
                      <img src={flag.screenshot} alt={`Flagged: ${flag.object_label}`} style={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="btn btn-primary" onClick={() => window.location.reload()}>
        🔄 Start New Interview
      </button>
    </div>
  );
}
