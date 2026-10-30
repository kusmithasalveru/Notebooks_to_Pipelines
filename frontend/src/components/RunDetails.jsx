/**
 * Run Details view — displays a single run's full data and outputs.
 *
 * Fetches GET /runs/{runId} and renders the run's metadata, parameters,
 * status timeline, and all persisted outputs (stdout, chart, summary.json).
 * Artifact links go through the backend endpoint /runs/{runId}/artifacts/{path}
 * to keep paths scoped to the correct run.
 *
 * Statuses handled: pending, running, completed, failed, timeout.
 */
import React, { useState, useEffect } from 'react';
import { getRun, artifactUrl } from '../api';

function RunDetails() {
  const hash = typeof window !== 'undefined' ? window.location.hash : '';
  // Extract runId from hash like #/details/42 or #/details/42/
  const match = hash.match(/^#\/?details\/(\d+)\/?$/);
  const runId = match ? Number(match[1]) : null;

  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!runId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getRun(runId)
      .then((data) => {
        setRun(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load run details');
        setLoading(false);
      });
  }, [runId]);

  const statusLabels = {
    pending: 'Pending',
    running: 'Running',
    completed: 'Completed',
    failed: 'Failed',
    timeout: 'Timeout',
  };

  const statusStyles = {
    pending: { bg: 'rgba(255, 193, 7, 0.15)', fg: '#ffc107' },
    running: { bg: 'rgba(33, 150, 243, 0.15)', fg: '#2196f3' },
    completed: { bg: 'rgba(76, 175, 80, 0.15)', fg: '#4caf50' },
    failed: { bg: 'rgba(244, 67, 54, 0.15)', fg: '#f44336' },
    timeout: { bg: 'rgba(255, 152, 0, 0.15)', fg: '#ff9800' },
  };
  const statusStyle = statusStyles[run?.status] || statusStyles.pending;

  const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  };

  const formatDuration = (ms) => {
    if (ms === null || ms === undefined) return '—';
    const total = Math.floor(ms / 1000);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return minutes > 0 ? minutes + 'm ' + seconds + 's' : seconds + 's';
  };

  // Build artifact links from the run's outputs
  const artifactLinks = run?.outputs?.map((o) => {
    if (!o.file_path) return null;
    return (
      <li key={o.id} className="run-detail__artifact">
        <a
          href={artifactUrl(run?.id, o.file_path)}
          target="_blank"
          rel="noopener noreferrer"
          className="run-detail__artifact-link"
        >
          {o.artifact_type}
        </a>
      </li>
    );
  }).filter(Boolean);

  return (
    <section className="run-details" aria-labelledby="run-details-title">
      <header className="run-details__header">
        <h1 id="run-details-title" className="run-details__title">
          Run Details
        </h1>
      </header>

      {loading ? (
        <div className="run-details__loading">
          <span className="run-details__spinner" aria-hidden="true" />
          <p>Loading run details…</p>
        </div>
      ) : !run ? (
        <div className="run-details__not-found">
          <p>Run not found.</p>
        </div>
      ) : (
        <div className="run-details__content">
          {error && <p className="run-details__error">{error}</p>}

          {run && (
            <>
              <div className="run-details__meta">
                <div className="run-details__meta-row">
                  <span className="run-details__meta-label">Run ID</span>
                  <span className="run-details__meta-value">{run.id}</span>
                </div>
                <div className="run-details__meta-row">
                  <span className="run-details__meta-label">Notebook</span>
                  <span className="run-details__meta-value">{run.notebook_name}</span>
                </div>
                <div className="run-details__meta-row">
                  <span className="run-details__meta-label">Parameters</span>
                  <span className="run-details__meta-value">
                    {run.parameters?.region ? `region=${run.parameters.region}` : ''}
                    {run.parameters?.min_sales ? `, min_sales=${run.parameters.min_sales}` : ''}
                  </span>
                </div>
                <div className="run-details__meta-row">
                  <span className="run-details__meta-label">Status</span>
                  <span
                    className="run-details__meta-value"
                    style={{ background: statusStyle.bg, color: statusStyle.fg }}
                  >
                    {statusLabels[run.status] || run.status}
                  </span>
                </div>
                {run.started_at && run.completed_at && (
                  <div className="run-details__meta-row">
                    <span className="run-details__meta-label">Started</span>
                    <span className="run-details__meta-value">{formatDate(run.started_at)}</span>
                  </div>
                )}
                {run.completed_at && (
                  <div className="run-details__meta-row">
                    <span className="run-details__meta-label">Completed</span>
                    <span className="run-details__meta-value">{formatDate(run.completed_at)}</span>
                  </div>
                )}
                {run.duration_ms !== null && run.duration_ms !== undefined && (
                  <div className="run-details__meta-row">
                    <span className="run-details__meta-label">Duration</span>
                    <span className="run-details__meta-value">{formatDuration(run.duration_ms)}</span>
                  </div>
                )}
                {run.error_message && (
                  <div className="run-details__meta-row">
                    <span className="run-details__meta-label">Error</span>
                    <span className="run-details__meta-value">{run.error_message}</span>
                  </div>
                )}
              </div>

              <div className="run-details__outputs">
                <h3 className="run-details__outputs-heading">Outputs</h3>
                {run.outputs && run.outputs.length > 0 ? (
                  <ul className="run-detail__outputs-list">
                    {artifactLinks}
                  </ul>
                ) : (
                  <p className="run-details__no-outputs">
                    No outputs recorded for this run.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {runId && (
        <div className="run-details__nav">
          <button
            className="run-details__nav-back"
            onClick={() => (window.location.hash = '#/runs')}
          >
            Back to Run History
          </button>
        </div>
      )}
    </section>
  );
}

export default RunDetails;