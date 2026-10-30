/**
 * API client for the Capstone Notebook Pipeline backend.
 *
 * All endpoints are proxied through Vite's dev server to the FastAPI
 * backend on http://127.0.0.1:8000.
 *
 * No mock data: every call returns real persisted run data from the
 * running backend. States are: loading, success, error, timeout.
 */

const BASE = '';
const TIMEOUT_MS = 180_000;

/**
 * Fetch JSON from the backend with a timeout.
 * Returns the parsed JSON response on success.
 * Throws on network error, non-2xx, or timeout.
 */
async function fetchJSON(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASE + url, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...opts,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Upload a notebook and parameters to create a new run.
 * Returns the run record with id and initial status.
 */
async function uploadRun(file, params) {
  const form = new FormData();
  form.append('notebook', file);
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    qs.set(k, String(v));
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASE + '/runs?' + qs.toString(), {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Upload timed out');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * List all persisted runs, newest first.
 */
async function listRuns() {
  return fetchJSON('/runs');
}

/**
 * Get a single run by ID, including all outputs.
 */
async function getRun(id) {
  return fetchJSON(`/runs/${id}`);
}

/**
 * Compare two runs by ID.
 * Returns visual + structured diff data.
 */
async function compareRuns(a, b) {
  return fetchJSON(`/runs/${a}/compare/${b}`, { method: 'POST' });
}

/**
 * Fetch a binary artifact (chart.png, output.ipynb, summary.json).
 * Returns a Blob.
 */
async function fetchArtifact(runId, artifactPath) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      BASE + `/runs/${runId}/artifacts/${artifactPath}`,
      { signal: controller.signal }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `HTTP ${res.status}`);
    }
    return await res.blob();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Artifact fetch timed out');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Health check.
 */
async function health() {
  return fetchJSON('/health');
}

/**
 * Build a proxied URL for a run artifact.
 *
 * The backend stores file paths with OS-specific separators (e.g.
 * '9\chart.png' on Windows). The artifact endpoint matches by basename, so
 * we pass just the filename. The returned URL is relative ('/runs/...') so
 * it is forwarded to the backend by the Vite dev server proxy.
 */
function artifactUrl(runId, artifactPath) {
  if (!artifactPath) return '';
  const name = artifactPath.replace(/^[\\/]+/, '').split(/[\\/]/).pop();
  return `/runs/${runId}/artifacts/${encodeURIComponent(name)}`;
}

export {
  uploadRun,
  listRuns,
  getRun,
  compareRuns,
  fetchArtifact,
  health,
  artifactUrl,
};