"""Pydantic schemas for request/response validation."""
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class RunCreate(BaseModel):
    notebook_name: str = Field(..., min_length=1, max_length=255)
    parameters: Dict[str, Any] = Field(default_factory=dict)


class RunResponse(BaseModel):
    id: int
    notebook_name: str
    parameters: Dict[str, Any]
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class RunDetailResponse(RunResponse):
    outputs: List["OutputResponse"] = []


class OutputResponse(BaseModel):
    id: int
    artifact_type: str
    file_path: Optional[str] = None
    content_json: Optional[Any] = None  # can be dict or list
    content_text: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ComparisonResponse(BaseModel):
    run_a: RunResponse
    run_b: RunResponse
    visual: Dict[str, Any]  # paths to charts, tables for side-by-side
    structured_diff: Dict[str, Any]  # computed differences
    compatible: bool
    incompatibility_reason: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    db_path: str


OutputResponse.model_rebuild()
RunDetailResponse.model_rebuild()