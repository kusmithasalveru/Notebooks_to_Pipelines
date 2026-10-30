"""SQLAlchemy models for run history and output artifacts."""
import json
import os
from datetime import datetime
from typing import Optional

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, Boolean, Index
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import relationship

from .database import Base


class Run(Base):
    __tablename__ = "runs"

    id = Column(Integer, primary_key=True, index=True)
    notebook_name = Column(String(255), nullable=False)
    parameters = Column(JSON, nullable=False)  # dict of injected params
    status = Column(String(32), nullable=False, default="pending")  # pending, running, completed, failed, timeout
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    input_notebook_path = Column(String(512), nullable=True)
    output_notebook_path = Column(String(512), nullable=True)

    # Relationships
    outputs = relationship("RunOutput", back_populates="run", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_runs_started_at", "started_at"),
        Index("ix_runs_status", "status"),
    )


class RunOutput(Base):
    __tablename__ = "run_outputs"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("runs.id", ondelete="CASCADE"), nullable=False, index=True)
    artifact_type = Column(String(64), nullable=False)  # "chart", "summary", "notebook", "stdout", "stderr"
    file_path = Column(String(512), nullable=True)  # relative to runs dir
    content_json = Column(JSON, nullable=True)  # for structured data (summary.json)
    content_text = Column(Text, nullable=True)  # for text outputs (stdout, stderr)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    run = relationship("Run", back_populates="outputs")


def get_runs_dir() -> str:
    """Return the absolute path to the runs directory."""
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "runs"))


def get_run_artifacts_dir(run_id: int) -> str:
    """Return the absolute path to a specific run's artifacts directory."""
    return os.path.join(get_runs_dir(), str(run_id))