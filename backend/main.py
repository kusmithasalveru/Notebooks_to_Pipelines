"""FastAPI application for notebook pipeline execution and comparison."""
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.database import get_db, engine
from backend.models import Base, Run, RunOutput, get_run_artifacts_dir, get_runs_dir
from backend.runner import (
    NotebookRunner,
    create_run,
    get_run,
    list_runs,
    run_notebook_in_background,
)
from backend.compare import compare_runs
from backend.schemas import (
    RunCreate,
    RunResponse,
    RunDetailResponse,
    ComparisonResponse,
    HealthResponse,
)

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Capstone Notebook Pipeline API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Notebook upload directory
UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Max upload size: 10 MB
MAX_UPLOAD_SIZE = 10 * 1024 * 1024

# Allowed notebook extensions
ALLOWED_EXTENSIONS = {".ipynb"}


def _validate_notebook_upload(file: UploadFile) -> None:
    """Validate uploaded notebook file."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Only .ipynb files are allowed.",
        )

    # Check file size (approximate via content-length header)
    content_length = file.headers.get("content-length")
    if content_length and int(content_length) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024*1024)} MB.",
        )

    # Path traversal protection
    if ".." in file.filename or Path(file.filename).is_absolute():
        raise HTTPException(status_code=400, detail="Invalid filename")


def _save_uploaded_notebook(file: UploadFile, run_id: int) -> str:
    """Save uploaded notebook to a run-specific directory. Returns the saved path."""
    run_dir = UPLOAD_DIR / str(run_id)
    run_dir.mkdir(exist_ok=True)
    safe_name = "input.ipynb"
    save_path = run_dir / safe_name

    content = file.file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024*1024)} MB.",
        )

    with open(save_path, "wb") as f:
        f.write(content)

    return str(save_path)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Health check endpoint."""
    from backend.database import DB_PATH
    return HealthResponse(
        status="ok",
        timestamp=datetime.utcnow(),
        db_path=DB_PATH,
    )


@app.post("/runs", response_model=RunResponse, status_code=201)
async def create_run_endpoint(
    notebook: UploadFile = File(..., description="Jupyter notebook (.ipynb) to execute"),
    region: str = Query(..., description="Region parameter for the notebook"),
    min_sales: int = Query(..., description="Minimum sales threshold"),
) -> RunResponse:
    """
    Upload a notebook, create a run record, and start execution in the background.

    The notebook is executed asynchronously. Poll GET /runs/{id} to check status.
    Status lifecycle: pending -> running -> completed | failed | timeout

    **Security note:** Uploaded notebooks execute arbitrary Python code locally.
    Only upload trusted notebooks.
    """
    _validate_notebook_upload(notebook)

    # Create run record first (status=pending)
    parameters = {"region": region, "min_sales": min_sales}
    db_gen = get_db()
    db = next(db_gen)
    try:
        run = create_run(
            db=db,
            notebook_name=notebook.filename or "uploaded.ipynb",
            parameters=parameters,
            input_notebook_path="",  # will update after save
        )

        # Save notebook to disk
        notebook_path = _save_uploaded_notebook(notebook, run.id)

        # Update run with actual notebook path
        run.input_notebook_path = notebook_path
        db.commit()
        db.refresh(run)

        # Launch background execution
        run_notebook_in_background(
            db=db,
            run_id=run.id,
            notebook_path=notebook_path,
            parameters=parameters,
            timeout_seconds=120,
        )

        return RunResponse(
            id=run.id,
            notebook_name=run.notebook_name,
            parameters=run.parameters,
            status=run.status,
            started_at=run.started_at,
            completed_at=run.completed_at,
            duration_ms=run.duration_ms,
            error_message=run.error_message,
        )
    finally:
        try:
            next(db_gen)
        except StopIteration:
            pass


@app.get("/runs", response_model=List[RunResponse])
def list_runs_endpoint(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> List[RunResponse]:
    """List persisted run history, most recent first."""
    db_gen = get_db()
    db = next(db_gen)
    try:
        runs = list_runs(db, limit=limit, offset=offset)
        return [
            RunResponse(
                id=r.id,
                notebook_name=r.notebook_name,
                parameters=r.parameters,
                status=r.status,
                started_at=r.started_at,
                completed_at=r.completed_at,
                duration_ms=r.duration_ms,
                error_message=r.error_message,
            )
            for r in runs
        ]
    finally:
        try:
            next(db_gen)
        except StopIteration:
            pass


@app.get("/runs/{run_id}", response_model=RunDetailResponse)
def get_run_endpoint(run_id: int) -> RunDetailResponse:
    """Get run details including all persisted outputs."""
    db_gen = get_db()
    db = next(db_gen)
    try:
        run = get_run(db, run_id)
        if run is None:
            raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

        outputs = db.query(RunOutput).filter(RunOutput.run_id == run_id).all()
        output_responses = [
            {
                "id": o.id,
                "artifact_type": o.artifact_type,
                "file_path": o.file_path,
                "content_json": o.content_json,
                "content_text": o.content_text,
                "created_at": o.created_at,
            }
            for o in outputs
        ]

        return RunDetailResponse(
            id=run.id,
            notebook_name=run.notebook_name,
            parameters=run.parameters,
            status=run.status,
            started_at=run.started_at,
            completed_at=run.completed_at,
            duration_ms=run.duration_ms,
            error_message=run.error_message,
            outputs=output_responses,
        )
    finally:
        try:
            next(db_gen)
        except StopIteration:
            pass


@app.get("/runs/{run_id}/artifacts/{artifact_path:path}")
def get_run_artifact(run_id: int, artifact_path: str) -> FileResponse:
    """Serve a run artifact file (chart, notebook, etc.)."""
    db_gen = get_db()
    db = next(db_gen)
    try:
        run = get_run(db, run_id)
        if run is None:
            raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

        # Normalize path separators
        clean_path = artifact_path.replace("/", "\\").strip("\\")
        run_prefix = f"{run_id}\\"
        if not clean_path.startswith(run_prefix):
            full_rel_path = f"{run_id}\\{clean_path}"
        else:
            full_rel_path = clean_path

        # Match against RunOutput file_path in DB or directly check file existence
        outputs = db.query(RunOutput).filter(RunOutput.run_id == run_id).all()
        matching_rel_path = None

        for o in outputs:
            if o.file_path:
                norm_db = o.file_path.replace("/", "\\").strip("\\")
                if norm_db == full_rel_path or norm_db == clean_path or Path(norm_db).name == Path(clean_path).name:
                    matching_rel_path = o.file_path
                    break

        runs_dir = get_runs_dir()
        if matching_rel_path:
            full_path = Path(runs_dir) / matching_rel_path
        else:
            # Fallback: check directly inside the run's artifact directory
            full_path = Path(runs_dir) / str(run_id) / Path(clean_path).name

        if not full_path.exists():
            raise HTTPException(status_code=404, detail="Artifact file missing on disk")

        return FileResponse(full_path)
    finally:
        try:
            next(db_gen)
        except StopIteration:
            pass


@app.post("/runs/{run_a_id}/compare/{run_b_id}", response_model=ComparisonResponse)
def compare_runs_endpoint(run_a_id: int, run_b_id: int) -> ComparisonResponse:
    """Compare two completed runs."""
    db_gen = get_db()
    db = next(db_gen)
    try:
        run_a = get_run(db, run_a_id)
        run_b = get_run(db, run_b_id)

        if run_a is None:
            raise HTTPException(status_code=404, detail=f"Run {run_a_id} not found")
        if run_b is None:
            raise HTTPException(status_code=404, detail=f"Run {run_b_id} not found")

        return compare_runs(db, run_a, run_b)
    finally:
        try:
            next(db_gen)
        except StopIteration:
            pass