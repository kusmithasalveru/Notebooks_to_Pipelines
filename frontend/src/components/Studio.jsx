/**
 * Studio view — upload a notebook, set parameters, execute, and track the run
 * until the backend reports a terminal state.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { uploadRun, getRun } from '../api';

const REGIONS = ['North', 'South', 'East', 'West'];
const TERMINAL = ['completed', 'failed', 'timeout'];

function Studio() {
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [region, setRegion] = useState('North');
  const [minSales, setMinSales] = useState(5000);
  const [executing, setExecuting] = useState(false);
  const [runId, setRunId] = useState(null);
  const [runStatus, setRunStatus] = useState(null);
  const [runData, setRunData] = useState(null);
  const [error, setError] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const fileInputRef = useRef(null);
  const pollRef = useRef(null);
  const timerRef = useRef(null);

  const stopAll = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetForm = useCallback(() => {
    stopAll();
    setFile(null);
    setFileError(null);
    setRegion('North');
    setMinSales(5000);
    setExecuting(false);
    setRunId(null);
    setRunStatus(null);
    setRunData(null);
    setError(null);
    setElapsedMs(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [stopAll]);

  const acceptFile = useCallback((f) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.ipynb')) {
      setFileError('Only .ipynb files are allowed');
      setFile(null);
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setFileError('File too large (max 10 MB)');
      setFile(null);
      return;
    }
    setFile(f);
    setFileError(null);
  }, []);

  const handleFileChange = useCallback((e) => {
    acceptFile(e.target.files && e.target.files[0]);
  }, [acceptFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      acceptFile(e.dataTransfer.files[0]);
    }
  }, [acceptFile]);

  const startPolling = useCallback((id) => {
    const poll = async () => {
      try {
        const run = await getRun(id);
        setRunStatus(run.status);
        setRunData(run);
        if (TERMINAL.includes(run.status)) {
          stopAll();
          setExecuting(false);
          if (typeof run.duration_ms === 'number') setElapsedMs(run.duration_ms);
        }
      } catch (err) {
        setError('Polling failed: ' + err.message);
        stopAll();
        setExecuting(false);
      }
    };
    poll();
    pollRef.current = setInterval(poll, 2000);
  }, [stopAll]);

  const handleExecute = useCallback(async () => {
    if (!file) {
      setError('Please select a notebook file');
      return;
    }
    if (executing) return;

    setError(null);
    setExecuting(true);
    setRunId(null);
    setRunStatus('submitting');
    setRunData(null);
    setElapsedMs(0);

    const startTime = Date.now();
    timerRef.current = setInterval(() => setElapsedMs(Date.now() - startTime), 100);

    try {
      const run = await uploadRun(file, { region, min_sales: Number(minSales) });
      setRunId(run.id);
      setRunStatus(run.status);
      setRunData(run);
      startPolling(run.id);
    } catch (err) {
      setError(err.message || 'Upload failed');
      stopAll();
      setExecuting(false);
    }
  }, [file, region, minSales, executing, startPolling, stopAll]);

  useEffect(() => stopAll, [stopAll]);

  const formatElapsed = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const rem = seconds % 60;
    return minutes > 0 ? minutes + 'm ' + rem + 's' : seconds + 's';
  };

  const statusStyles = {
    pending: { background: 'rgba(255, 193, 7, 0.2)', color: '#ffc107' },
    running: { background: 'rgba(33, 150, 243, 0.2)', color: '#2196f3' },
    completed: { background: 'rgba(76, 175, 80, 0.2)', color: '#4caf50' },
    failed: { background: 'rgba(244, 67, 54, 0.2)', color: '#f44336' },
    timeout: { background: 'rgba(255, 152, 0, 0.2)', color: '#ff9800' },
    submitting: { background: 'rgba(156, 39, 176, 0.2)', color: '#9c27b0' },
  };
  const statusStyle = statusStyles[runStatus] || statusStyles.pending;

  return (
    <section className="studio" aria-labelledby="studio-title">
      <header className="studio__header">
        <h1 id="studio-title" className="studio__title">Studio</h1>
        <p className="studio__subtitle">Upload a notebook, configure parameters, and execute</p>
      </header>

      <div className="studio__grid">
        <div className="studio__panel studio__panel--upload">
          <h2 className="studio__section-title">Notebook</h2>

          <div
            className={'drop-zone' + (file ? ' drop-zone--has-file' : '')}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            aria-label="Drop zone for notebook file. Press Enter to browse."
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (fileInputRef.current) fileInputRef.current.click();
              }
            }}
          >
            <input
              ref={fileInputRef}
              id="notebook-file"
              type="file"
              accept=".ipynb"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={executing}
              aria-describedby="file-hint"
            />
            <label htmlFor="notebook-file" className="drop-zone__label">
              <svg className="drop-zone__icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="currentColor" strokeWidth="2" />
                <polyline points="14 2 14 8 20 8" fill="none" stroke="currentColor" strokeWidth="2" />
                <line x1="12" y1="18" x2="12" y2="12" fill="none" stroke="currentColor" strokeWidth="2" />
                <line x1="9" y1="15" x2="15" y2="15" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
              {file ? (
                <>
                  <p className="drop-zone__filename">{file.name}</p>
                  <p className="drop-zone__size">{(file.size / 1024).toFixed(1)} KB</p>
                </>
              ) : (
                <>
                  <p>Drag &amp; drop a <strong>.ipynb</strong> file here</p>
                  <p id="file-hint" className="drop-zone__hint">or click to browse (max 10 MB)</p>
                </>
              )}
            </label>
          </div>

          {fileError && <p className="field-error" role="alert">{fileError}</p>}

          <div className="studio__section-divider" aria-hidden="true" />

          <h2 className="studio__section-title">Parameters</h2>

          <div className="param-grid">
            <div className="field-wrapper">
              <label htmlFor="param-region" className="field-label">Region</label>
              <select
                id="param-region"
                className="field-select"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                disabled={executing}
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="field-wrapper">
              <label htmlFor="param-min-sales" className="field-label">Min Sales</label>
              <input
                id="param-min-sales"
                type="number"
                className="field-input"
                value={minSales}
                onChange={(e) => setMinSales(Math.max(0, Number(e.target.value)) || 0)}
                min={0}
                step={100}
                disabled={executing}
              />
            </div>
          </div>

          {error && <p className="studio__error" role="alert">{error}</p>}

          <button
            className="studio__execute-btn"
            onClick={handleExecute}
            disabled={executing || !file}
            aria-busy={executing}
          >
            {executing ? 'Executing…' : 'Execute Notebook'}
          </button>
        </div>

        <div className="studio__panel studio__panel--status">
          <h2 className="studio__section-title">Execution Status</h2>

          {runId === null && !executing ? (
            <div className="studio__empty">
              <svg className="studio__empty-icon" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12 8v4M12 16h.01" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
              <p>No execution started</p>
              <span className="studio__empty-hint">Select a notebook and click Execute</span>
            </div>
          ) : (
            <>
              <div className="studio__status-header">
                <div className="studio__run-id">
                  <span className="studio__run-label">Run ID</span>
                  <code className="studio__run-code">{runId === null ? '—' : runId}</code>
                </div>
                <span
                  className="studio__status-badge"
                  style={{ background: statusStyle.background, color: statusStyle.color }}
                  aria-live="polite"
                >
                  {(runStatus || 'pending').toUpperCase()}
                </span>
              </div>

              <div className="studio__timer">
                <svg className="studio__timer-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12 6v6l4 2" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
                <span>Elapsed: {formatElapsed(elapsedMs)}</span>
              </div>

              {runData && (
                <details className="studio__details">
                  <summary>Response details</summary>
                  <pre className="studio__json">{JSON.stringify(runData, null, 2)}</pre>
                </details>
              )}

              {runStatus === 'completed' && (
                <p className="studio__completed-msg">
                  Execution completed successfully.
                </p>
              )}
              {runStatus === 'failed' && (
                <p className="studio__failed-msg">Execution failed. See response details above.</p>
              )}
              {runStatus === 'timeout' && (
                <p className="studio__timeout-msg">Execution timed out.</p>
              )}

              {runId && runStatus && TERMINAL.includes(runStatus) && (
                <a
                  href={`#/details/${runId}`}
                  className="studio__view-details"
                >
                  View Run Details →
                </a>
              )}

              <button className="studio__reset-btn" onClick={resetForm} disabled={executing}>
                New Execution
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default Studio;