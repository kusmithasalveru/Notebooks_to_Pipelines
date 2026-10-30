/**
 * Run History view — displays real persisted runs from GET /runs.
 *
 * No mock data. Loading, empty, error, and retry states are all handled.
 * Refreshes on mount and on a manual Refresh button. Details are not yet
 * available in this stage; a notice explains that.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { listRuns } from '../api';

const STATUS_STYLES = {
  pending: { bg: 'rgba(255, 193, 7, 0.15)', fg: '#ffc107' },
  running: { bg: 'rgba(33, 150, 243, 0.15)', fg: '#2196f3' },
  completed: { bg: 'rgba(76, 175, 80, 0.15)', fg: '#4caf50' },
  failed: { bg: 'rgba(244, 67, 54, 0.15)', fg: '#f44336' },
  timeout: { bg: 'rgba(255, 152, 0, 0.15)', fg: '#ff9800' },
};

function formatDuration(ms) {
  if (ms === null || ms === undefined) return '—';
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes > 0) return minutes + 'm ' + seconds + 's';
  return seconds + 's';
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

const refreshIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.974 5.974 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" fill="currentColor" />
  </svg>
);

const detailsIcon = (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path d="M9 3h6v18H9z" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M15 3h6v18h-6z" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
);

function RunHistory() {
  const [runs, setRuns] = useState([]);
  const [state, setState] = useState('loading'); // loading | empty | error | ready
  const [errorMessage, setErrorMessage] = useState('');

  const fetchRuns = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const data = await listRuns();
      if (!Array.isArray(data)) {
        throw new Error('Unexpected response shape from /runs');
      }
      setRuns(data);
      setState(data.length === 0 ? 'empty' : 'ready');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load run history');
      setState('error');
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  return (
    <section className="history" aria-labelledby="history-title">
      <header className="history__header">
        <div>
          <h1 id="history-title" className="history__title">Run History</h1>
          <p className="history__subtitle">
            All persisted notebook executions, newest first.
          </p>
        </div>
        <button
          className="history__refresh"
          onClick={fetchRuns}
          disabled={state === 'loading'}
        >
          Refresh
        </button>
      </header>

      {state === 'loading' && runs.length === 0 ? (
        <div className="history__empty" role="status">
          <span className="history__spinner" aria-hidden="true" />
          <p>Loading run history…</p>
        </div>
      ) : state === 'empty' ? (
        <div className="history__empty">
          <svg className="history__empty-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 3h6v18H9z" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M15 3h6v18h-6z" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          <p>No runs yet.</p>
          <span className="history__empty-hint">
            Use Studio to upload and execute a notebook.
          </span>
        </div>
      ) : state === 'error' ? (
        <div className="history__error" role="alert">
          <p>{errorMessage}</p>
          <button className="history__retry" onClick={fetchRuns} disabled={state === 'loading'}>
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="history__table-wrap">
            <table className="history__table">
              <thead>
                <tr>
                  <th scope="col">Run ID</th>
                  <th scope="col">Notebook</th>
                  <th scope="col">Region</th>
                  <th scope="col">Min Sales</th>
                  <th scope="col">Status</th>
                  <th scope="col">Started</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const style = STATUS_STYLES[run.status] || STATUS_STYLES.pending;
                  const params = run.parameters || {};
                  return (
                    <tr
                      key={run.id}
                      className="history__row"
                      onClick={() => (window.location.hash = `#/details/${run.id}`)}
                      role="link"
                      tabIndex={0}
                      aria-label={`View details for run ${run.id}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          window.location.hash = `#/details/${run.id}`;
                        }
                      }}
                    >
                      <td className="history__cell history__cell--mono">
                        <a
                          href={`#/details/${run.id}`}
                          className="history__run-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          #{run.id}
                        </a>
                      </td>
                      <td className="history__cell">{run.notebook_name}</td>
                      <td className="history__cell">{params.region ?? '—'}</td>
                      <td className="history__cell">{params.min_sales ?? '—'}</td>
                      <td className="history__cell">
                        <span
                          className="history__badge"
                          style={{ background: style.bg, color: style.fg }}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="history__cell">{formatDate(run.started_at)}</td>
                      <td className="history__cell">
                        <div className="history__actions">
                          <span className="history__duration">{formatDuration(run.duration_ms)}</span>
                          <a
                            href={`#/details/${run.id}`}
                            className="history__details-link"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`View details for run ${run.id}`}
                          >
                            {detailsIcon}
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="history__note">
            Click any run row to inspect its full details, outputs, and artifacts.
          </p>
        </>
      )}
    </section>
  );
}

export default RunHistory;