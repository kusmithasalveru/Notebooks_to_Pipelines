"""Papermill subprocess runner with timeout and output extraction."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import traceback
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

import papermill
from papermill.exceptions import PapermillExecutionError

from .database import SessionLocal
from .models import Run, RunOutput, get_run_artifacts_dir, get_runs_dir


class NotebookRunner:
    """Executes a Jupyter notebook via papermill in a subprocess."""

    def __init__(self, db: Session, timeout_seconds: int = 120):
        self.db = db
        self.timeout_seconds = timeout_seconds
        self.runs_dir = get_runs_dir()

    def run(self, run: Run, notebook_path: str, parameters: Dict[str, Any]) -> Run:
        """Execute the notebook with given parameters, return updated Run."""
        run.status = "running"
        run.started_at = __import__("datetime").datetime.utcnow()
        self.db.commit()

        # Prepare artifact directory
        artifacts_dir = get_run_artifacts_dir(run.id)
        os.makedirs(artifacts_dir, exist_ok=True)

        output_notebook = os.path.join(artifacts_dir, "output.ipynb")

        # Run papermill via its Python API (not subprocess).
        # Using the API avoids the brittle `sys.executable -m papermill` shell
        # invocation, which can resolve to a different interpreter that lacks
        # papermill installed, silently breaking execution.
        start = time.time()
        completed = None
        error_message = None

        try:
            # CRITICAL: cwd is the run's own artifact directory, so the kernel
            # writes summary.json / chart.png there and runs never overwrite
            # each other's outputs.
            papermill.execute_notebook(
                notebook_path,
                output_notebook,
                cwd=artifacts_dir,
                parameters=parameters,
                log_output=True,
                progress_bar=True,
                request_timeout=self.timeout_seconds,
            )
            completed = time.time()
            run.status = "completed"

        except papermill.exceptions.PapermillExecutionError as e:
            completed = time.time()
            run.status = "failed"
            error_message = (
                f"Notebook execution failed: {e}"
            )

        except subprocess.TimeoutExpired:
            completed = time.time()
            run.status = "timeout"
            error_message = f"Notebook execution timed out after {self.timeout_seconds}s"
            run.error_message = error_message

        except Exception as e:
            completed = time.time()
            run.status = "failed"
            error_message = f"Execution error: {type(e).__name__}: {e}"
            run.error_message = error_message[:2000]

        run.completed_at = __import__("datetime").datetime.utcnow()
        if completed:
            run.duration_ms = int((completed - start) * 1000)
        run.output_notebook_path = output_notebook
        self.db.commit()

        # Extract outputs if execution succeeded
        if run.status == "completed" and os.path.exists(output_notebook):
            self._extract_outputs(run, output_notebook, artifacts_dir)

        return run

    def _extract_outputs(self, run: Run, output_notebook_path: str, artifacts_dir: str) -> None:
        """Extract outputs from the executed notebook using nbclient."""
        import nbformat
        from nbclient import NotebookClient

        try:
            nb = nbformat.read(output_notebook_path, as_version=4)

            # 1. Save the executed notebook itself
            self._save_output(run, "notebook", file_path=os.path.relpath(output_notebook_path, self.runs_dir))

            # 2. Extract all cell outputs
            stdout_parts = []
            stderr_parts = []
            chart_paths: List[str] = []

            for cell_idx, cell in enumerate(nb.cells):
                if cell.cell_type != "code":
                    continue
                for output in cell.outputs:
                    otype = output.get("output_type")
                    if otype == "stream":
                        name = output.get("name", "stdout")
                        text = output.get("text", "")
                        if name == "stdout":
                            stdout_parts.append(f"[cell {cell_idx}] {text}")
                        else:
                            stderr_parts.append(f"[cell {cell_idx}] {text}")
                    elif otype == "display_data":
                        # Look for image/png (chart)
                        data = output.get("data", {})
                        if "image/png" in data:
                            import base64
                            png_data = base64.b64decode(data["image/png"])
                            chart_path = os.path.join(artifacts_dir, f"chart_cell_{cell_idx}.png")
                            with open(chart_path, "wb") as f:
                                f.write(png_data)
                            chart_paths.append(chart_path)
                            rel_path = os.path.relpath(chart_path, self.runs_dir)
                            self._save_output(run, "chart", file_path=rel_path)
                    elif otype == "execute_result":
                        # Capture text/plain results (e.g., DataFrame reprs)
                        data = output.get("data", {})
                        if "text/plain" in data:
                            stdout_parts.append(f"[cell {cell_idx}] {data['text/plain']}")

            # 2b. Persist image files the notebook itself wrote into the artifacts
            # directory (e.g. chart.png via matplotlib savefig). These are NOT cell
            # outputs, so the loop above misses them. Scanning the directory keeps
            # every chart in the run's own isolated folder, retrievable per run.
            for name in sorted(os.listdir(artifacts_dir)):
                if name == "output.ipynb":
                    continue
                if name.lower().endswith((".png", ".jpg", ".jpeg", ".svg", ".gif")):
                    rel = os.path.relpath(os.path.join(artifacts_dir, name), self.runs_dir)
                    if rel not in chart_paths:
                        chart_paths.append(rel)
                        self._save_output(run, "chart", file_path=rel)

            # Save stdout/stderr
            if stdout_parts:
                self._save_output(run, "stdout", content_text="\n".join(stdout_parts))
            if stderr_parts:
                self._save_output(run, "stderr", content_text="\n".join(stderr_parts))

            # 3. Look for summary.json in the artifacts directory
            summary_path = os.path.join(artifacts_dir, "summary.json")
            if os.path.exists(summary_path):
                with open(summary_path) as f:
                    summary = json.load(f)
                self._save_output(run, "summary", file_path=os.path.relpath(summary_path, self.runs_dir), content_json=summary)

        except Exception as e:
            # Don't fail the run if extraction fails; just log it
            traceback.print_exc()
            self._save_output(run, "stderr", content_text=f"Output extraction failed: {e}")

    def _save_output(
        self,
        run: Run,
        artifact_type: str,
        file_path: Optional[str] = None,
        content_json: Optional[Dict] = None,
        content_text: Optional[str] = None,
    ) -> None:
        output = RunOutput(
            run_id=run.id,
            artifact_type=artifact_type,
            file_path=file_path,
            content_json=content_json,
            content_text=content_text,
        )
        self.db.add(output)
        self.db.commit()


def create_run(
    db: Session,
    notebook_name: str,
    parameters: Dict[str, Any],
    input_notebook_path: str,
) -> Run:
    """Create a new Run record."""
    run = Run(
        notebook_name=notebook_name,
        parameters=parameters,
        status="pending",
        input_notebook_path=input_notebook_path,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def get_run(db: Session, run_id: int) -> Optional[Run]:
    return db.query(Run).filter(Run.id == run_id).first()


def list_runs(db: Session, limit: int = 100, offset: int = 0) -> List[Run]:
    return db.query(Run).order_by(Run.started_at.desc()).offset(offset).limit(limit).all()


def run_notebook_in_background(
    db: Session,
    run_id: int,
    notebook_path: str,
    parameters: Dict[str, Any],
    timeout_seconds: int = 120,
) -> None:
    """Execute a run in a background thread.

    The status lifecycle is: pending -> running -> completed | failed | timeout.
    A fresh session is opened for the worker thread because SQLite sessions are
    bound to the thread that created them (check_same_thread=False allows the
    connection to be shared, but the thread-local identity of SessionLocal is
    not safe to reuse here).
    """
    import threading

    def _worker() -> None:
        db_local = SessionLocal()
        try:
            run = get_run(db_local, run_id)
            if run is None:
                return
            NotebookRunner(db_local, timeout_seconds=timeout_seconds).run(
                run, notebook_path, parameters
            )
        finally:
            db_local.close()

    threading.Thread(target=_worker, daemon=True, name=f"run-{run_id}").start()