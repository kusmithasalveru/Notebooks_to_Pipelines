/**
 * Comparison view — compare two real runs using the backend comparison endpoint.
 *
 * Loads real run history, lets the user pick Run A and Run B, triggers the
 * backend comparison endpoint, and renders the structured diff and visual
 * artifacts (charts, summaries) returned by the backend.
 *
 * No mock data. All states (loading, empty, error, incompatible, retry) handled.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { listRuns, compareRuns, artifactUrl } from '../api';

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

function deltaStyle(delta) {
  if (delta === 0 || delta === null || delta === undefined) {
    return { color: '#a0aec0' };
  }
  return delta > 0 ? { color: '#4caf50' } : { color: '#f44336' };
}

function Comparison() {
  const [runs, setRuns] = useState([]);
  const [runsState, setRunsState] = useState('loading');
  const [runsError, setRunsError] = useState('');

  const [runAId, setRunAId] = useState(null);
  const [runBId, setRunBId] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [compareState, setCompareState] = useState('idle');
  const [compareError, setCompareError] = useState('');

  // Load runs on mount
  useEffect(() => {
    let cancelled = false;
    const fetchRuns = async () => {
      try {
        const dataJson = await listRuns();
        if (!cancelled) {
          if (!Array.isArray(dataJson)) {
            throw new Error('Unexpected response shape from /runs');
          }
          setRuns(dataJson);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load runs:', err);
        }
      }
    };
    fetchRuns();
    return () => { cancelled = true; };
  }, []);

  const fetchComparison = useCallback(async () => {
    if (!runAId || !runBId) return;
    if (runAId === runBId) {
      setCompareError('Please select two different runs.');
      return;
    }
    setComparison(null);
    setCompareState('loading');
    setCompareError('');
    try {
      const data = await compareRuns(runAId, runBId);
      if (!data) throw new Error('Empty response from comparison endpoint');
      setComparison(data);
      setCompareState('ready');
    } catch (err) {
      setCompareError(err.message || 'Comparison failed');
      setCompareState('error');
    }
  }, [runAId, runBId]);

  useEffect(() => {
    if (runAId && runBId && runAId !== runBId) {
      fetchComparison();
    } else if (runAId && runBId && runAId === runBId) {
      setComparison(null);
      setCompareState('idle');
      setCompareError('Please select two different runs.');
    } else {
      setComparison(null);
      setCompareState('idle');
      setCompareError('');
    }
  }, [runAId, runBId, fetchComparison]);

  useEffect(() => {
    setRunAId(null);
    setRunBId(null);
    setComparison(null);
    setCompareState('idle');
    setCompareError('');
  }, [runs]);

  const completedRuns = runs.filter(r => r.status === 'completed');

  const statusBadge = (status) => {
    const styles = {
      completed: { bg: 'rgba(76, 175, 80, 0.15)', fg: '#4caf50' },
      failed: { bg: 'rgba(244, 67, 54, 0.15)', fg: '#f44336' },
      timeout: { bg: 'rgba(255, 152, 0, 0.15)', fg: '#ff9800' },
      pending: { bg: 'rgba(255, 193, 7, 0.15)', fg: '#ffc107' },
      running: { bg: 'rgba(33, 150, 243, 0.15)', fg: '#2196f3' },
    };
    const s = styles[status] || { bg: 'rgba(255,255,255,0.1)', fg: '#fff' };
    return (
      <span style={{ background: s.bg, color: s.fg, padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
        {status.toUpperCase()}
      </span>
    );
  };

  const runOptionLabel = (run) => {
    const params = run.parameters || {};
    return `#${run.id} • ${run.notebook_name} • ${params.region ?? '?'} • min_sales=${params.min_sales ?? '?'}`;
  };

  return (
    <section className="comparison" aria-labelledby="comparison-title">
      <header className="comparison__header">
        <h1 id="comparison-title" className="comparison__title">Comparison</h1>
        <p className="comparison__subtitle">
          Compare two completed notebook runs side by side.
        </p>
      </header>

      <div className="comparison__selectors">
        <div className="comparison__selector">
          <label htmlFor="run-a" className="comparison__label">Run A</label>
          <select
            id="run-a"
            className="comparison__select"
            value={runAId ?? ''}
            onChange={(e) => setRunAId(Number(e.target.value) || null)}
            disabled={runs.length === 0}
          >
            <option value="">Select Run A</option>
            {completedRuns.map((run) => (
              <option key={run.id} value={run.id}>
                {runOptionLabel(run)}
              </option>
            ))}
          </select>
        </div>

        <div className="comparison__swap" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 16l-4-4 4-4M17 8l4-4-4-4M3 12h18" />
          </svg>
        </div>

        <div className="comparison__selector">
          <label htmlFor="run-b" className="comparison__label">Run B</label>
          <select
            id="run-b"
            className="comparison__select"
            value={runBId ?? ''}
            onChange={(e) => setRunBId(Number(e.target.value) || null)}
            disabled={runs.length === 0}
          >
            <option value="">Select Run B</option>
            {completedRuns.map((run) => (
              <option key={run.id} value={run.id}>
                {runOptionLabel(run)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {compareState === 'idle' && runAId && runBId && runAId === runBId && (
        <p className="comparison__error" role="alert">
          Please select two different runs to compare.
        </p>
      )}

      {compareState === 'error' && (
        <div className="comparison__error" role="alert">
          <p>{compareError}</p>
          <button className="comparison__retry" onClick={fetchComparison} disabled={compareState === 'loading'}>
            Retry
          </button>
        </div>
      )}

      {compareState === 'loading' && (
        <div className="comparison__loading" role="status">
          <span className="comparison__spinner" aria-hidden="true" />
          <p>Comparing runs…</p>
        </div>
      )}

      {!comparison ? null : (
        <div className="comparison__results">
          <div className="comparison__runs-header">
            <div className="comparison__run-column">
              <div className="comparison__run-title">
                Run A
                <span style={{ marginLeft: '8px' }}>{statusBadge(comparison.run_a.status)}</span>
              </div>
              <p className="comparison__run-meta">#{comparison.run_a.id} • {comparison.run_a.notebook_name}</p>
              <p className="comparison__run-meta">Region: {comparison.run_a.parameters?.region ?? '—'} | Min Sales: {comparison.run_a.parameters?.min_sales ?? '—'}</p>
            </div>

            <div className="comparison__vs">vs</div>

            <div className="comparison__run-column">
              <div className="comparison__run-title">
                Run B
                <span style={{ marginLeft: '8px' }}>{statusBadge(comparison.run_b.status)}</span>
              </div>
              <p className="comparison__run-meta">#{comparison.run_b.id} • {comparison.run_b.notebook_name}</p>
              <p className="comparison__run-meta">Region: {comparison.run_b.parameters?.region ?? '—'} | Min Sales: {comparison.run_b.parameters?.min_sales ?? '—'}</p>
            </div>
          </div>

          {!comparison.compatible ? (
            <div className="comparison__incompatible" role="alert">
              <h3>Incompatible Runs</h3>
              <p>{comparison.incompatibility_reason ?? 'Runs cannot be compared.'}</p>
              <p className="comparison__note">Only runs with the same notebook name and completed status can be compared.</p>
            </div>
          ) : (
            <>
              {/* Parameters Changed */}
              {Object.keys(comparison.structured_diff.parameters_changed).length > 0 && (
                <div className="comparison__section">
                  <h3 className="comparison__section-title">Parameter Differences</h3>
                  <table className="comparison__diff-table">
                    <thead>
                      <tr>
                        <th>Parameter</th>
                        <th>Run A</th>
                        <th>Run B</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(comparison.structured_diff.parameters_changed).map(([key, val]) => (
                        <tr key={key}>
                          <td>{key}</td>
                          <td>{String(val.run_a)}</td>
                          <td>{String(val.run_b)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Structured Diff */}
              <div className="comparison__section">
                <h3 className="comparison__section-title">Summary Differences</h3>
                <div className="comparison__diff-grid">
                  {comparison.structured_diff.rows_changed && (
                    <div className="comparison__diff-card">
                      <h4>Rows</h4>
                      <div className="comparison__diff-values">
                        <span>Run A: {comparison.structured_diff.rows_changed.run_a}</span>
                        <span>Run B: {comparison.structured_diff.rows_changed.run_b}</span>
                        <span style={deltaStyle(comparison.structured_diff.rows_changed.delta)}>
                          Δ {comparison.structured_diff.rows_changed.delta > 0 ? '+' : ''}{comparison.structured_diff.rows_changed.delta}
                        </span>
                      </div>
                    </div>
                  )}
                  {comparison.structured_diff.total_revenue_changed && (
                    <div className="comparison__diff-card">
                      <h4>Total Revenue</h4>
                      <div className="comparison__diff-values">
                        <span>Run A: ${comparison.structured_diff.total_revenue_changed.run_a.toLocaleString()}</span>
                        <span>Run B: ${comparison.structured_diff.total_revenue_changed.run_b.toLocaleString()}</span>
                        <span style={deltaStyle(comparison.structured_diff.total_revenue_changed.delta)}>
                          Δ {comparison.structured_diff.total_revenue_changed.delta > 0 ? '+' : ''}${comparison.structured_diff.total_revenue_changed.delta.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Product Changes */}
              {comparison.structured_diff.product_changes && comparison.structured_diff.product_changes.length > 0 && (
                <div className="comparison__section">
                  <h3 className="comparison__section-title">Product Revenue Changes</h3>
                  <table className="comparison__diff-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Change</th>
                        <th>Run A Revenue</th>
                        <th>Run B Revenue</th>
                        <th>Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.structured_diff.product_changes.map((pc, idx) => (
                        <tr key={idx}>
                          <td>{pc.product}</td>
                          <td>
                            <span style={{
                              background: pc.change === 'appeared' ? 'rgba(76, 175, 80, 0.15)' :
                                       pc.change === 'disappeared' ? 'rgba(244, 67, 54, 0.15)' :
                                       'rgba(255, 193, 7, 0.15)',
                              color: pc.change === 'appeared' ? '#4caf50' :
                                     pc.change === 'disappeared' ? '#f44336' :
                                     '#ffc107',
                              padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase'
                            }}>
                              {pc.change}
                            </span>
                          </td>
                          <td>{pc.run_a ? '$' + pc.run_a.toLocaleString() : '—'}</td>
                          <td>{pc.run_b ? '$' + pc.run_b.toLocaleString() : '—'}</td>
                          <td style={deltaStyle(pc.delta)}>
                            {pc.delta > 0 ? '+' : ''}${pc.delta.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Visual Comparison — Charts */}
              {(comparison.visual?.chart_a || comparison.visual?.chart_b) && (
                <div className="comparison__section">
                  <h3 className="comparison__section-title">Chart Comparison</h3>
                  <div className="comparison__charts">
                    <div className="comparison__chart">
                      <h4>Run A</h4>
                      {comparison.visual.chart_a ? (
                        <img
                          src={artifactUrl(comparison.run_a.id, comparison.visual.chart_a)}
                          alt="Run A chart"
                          className="comparison__chart-img"
                        />
                      ) : (
                        <p className="comparison__no-chart">No chart available</p>
                      )}
                    </div>
                    <div className="comparison__chart">
                      <h4>Run B</h4>
                      {comparison.visual.chart_b ? (
                        <img
                          src={artifactUrl(comparison.run_b.id, comparison.visual.chart_b)}
                          alt="Run B chart"
                          className="comparison__chart-img"
                        />
                      ) : (
                        <p className="comparison__no-chart">No chart available</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Summary Tables */}
              {(comparison.visual?.summary_a || comparison.visual?.summary_b) && (
                <div className="comparison__section">
                  <h3 className="comparison__section-title">Summary Tables</h3>
                  <div className="comparison__summary-tables">
                    <div className="comparison__summary-table">
                      <h4>Run A Summary</h4>
                      <table className="comparison__summary-table-inner">
                        <thead>
                          <tr><th>Product</th><th>Revenue</th><th>Units</th><th>Sales</th></tr>
                        </thead>
                        <tbody>
                          {comparison.visual.summary_a?.map((row, idx) => (
                            <tr key={idx}>
                              <td>{row.product}</td>
                              <td>${row.total_revenue.toLocaleString()}</td>
                              <td>{row.total_units.toLocaleString()}</td>
                              <td>{row.num_sales.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="comparison__summary-table">
                      <h4>Run B Summary</h4>
                      <table className="comparison__summary-table-inner">
                        <thead>
                          <tr><th>Product</th><th>Revenue</th><th>Units</th><th>Sales</th></tr>
                        </thead>
                        <tbody>
                          {comparison.visual.summary_b?.map((row, idx) => (
                            <tr key={idx}>
                              <td>{row.product}</td>
                              <td>${row.total_revenue.toLocaleString()}</td>
                              <td>{row.total_units.toLocaleString()}</td>
                              <td>{row.num_sales.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

export default Comparison;