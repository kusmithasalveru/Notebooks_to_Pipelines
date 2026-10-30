"""Compute structured diffs between two runs' persisted outputs."""
import os
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from .models import Run, RunOutput
from .schemas import ComparisonResponse, RunResponse, OutputResponse


def _run_to_response(run: Run) -> RunResponse:
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


def _outputs_to_response(outputs: List[RunOutput]) -> List[OutputResponse]:
    return [
        OutputResponse(
            id=o.id,
            artifact_type=o.artifact_type,
            file_path=o.file_path,
            content_json=o.content_json,
            content_text=o.content_text,
            created_at=o.created_at,
        )
        for o in outputs
    ]


def _get_summary(db: Session, run: Run) -> Optional[List[Dict[str, Any]]]:
    """Return the persisted summary.json for a run, or None."""
    output = (
        db.query(RunOutput)
        .filter(RunOutput.run_id == run.id, RunOutput.artifact_type == "summary")
        .first()
    )
    if output and output.content_json:
        return output.content_json
    return None


def _get_chart_path(db: Session, run: Run) -> Optional[str]:
    output = (
        db.query(RunOutput)
        .filter(RunOutput.run_id == run.id, RunOutput.artifact_type == "chart")
        .first()
    )
    if output and output.file_path:
        return output.file_path
    return None


def compare_runs(db: Session, run_a: Run, run_b: Run) -> ComparisonResponse:
    """Compare two runs. Returns a ComparisonResponse with visual + structured diff."""
    # --- Incompatibility checks ---
    incompatibility = None
    if run_a.status != "completed":
        incompatibility = f"Run {run_a.id} is not completed (status={run_a.status})"
    if run_b.status != "completed":
        incompatibility = f"Run {run_b.id} is not completed (status={run_b.status})"
    if incompatibility is None and run_a.notebook_name != run_b.notebook_name:
        incompatibility = (
            f"Notebooks differ: '{run_a.notebook_name}' vs '{run_b.notebook_name}'"
        )

    # --- Visual payload ---
    chart_a = _get_chart_path(db, run_a)
    chart_b = _get_chart_path(db, run_b)
    summary_a = _get_summary(db, run_a)
    summary_b = _get_summary(db, run_b)

    visual = {
        "chart_a": chart_a,
        "chart_b": chart_b,
        "summary_a": summary_a,
        "summary_b": summary_b,
    }

    # --- Structured diff ---
    structured_diff: Dict[str, Any] = {
        "parameters_changed": {},
        "rows_changed": None,
        "total_revenue_changed": None,
        "product_changes": [],
        "compatible": True,
    }

    if incompatibility is None:
        # Parameters that differ
        all_keys = set(run_a.parameters.keys()) | set(run_b.parameters.keys())
        for key in sorted(all_keys):
            va = run_a.parameters.get(key)
            vb = run_b.parameters.get(key)
            if va != vb:
                structured_diff["parameters_changed"][key] = {"run_a": va, "run_b": vb}

        if summary_a is not None and summary_b is not None:
            d1 = {r["product"]: r for r in summary_a}
            d2 = {r["product"]: r for r in summary_b}

            rows_a = sum(r.get("num_sales", 0) for r in summary_a)
            rows_b = sum(r.get("num_sales", 0) for r in summary_b)
            rev_a = sum(r.get("total_revenue", 0) for r in summary_a)
            rev_b = sum(r.get("total_revenue", 0) for r in summary_b)

            structured_diff["rows_changed"] = {"run_a": rows_a, "run_b": rows_b, "delta": rows_b - rows_a}
            structured_diff["total_revenue_changed"] = {"run_a": rev_a, "run_b": rev_b, "delta": rev_b - rev_a}

            for product in sorted(set(d1) | set(d2)):
                if product not in d1:
                    structured_diff["product_changes"].append({
                        "product": product,
                        "change": "appeared",
                        "run_a": None,
                        "run_b": d2[product]["total_revenue"],
                    })
                elif product not in d2:
                    structured_diff["product_changes"].append({
                        "product": product,
                        "change": "disappeared",
                        "run_a": d1[product]["total_revenue"],
                        "run_b": None,
                    })
                else:
                    delta = d2[product]["total_revenue"] - d1[product]["total_revenue"]
                    if delta != 0:
                        structured_diff["product_changes"].append({
                            "product": product,
                            "change": "changed",
                            "run_a": d1[product]["total_revenue"],
                            "run_b": d2[product]["total_revenue"],
                            "delta": delta,
                        })
        else:
            structured_diff["compatible"] = False
            structured_diff["note"] = "Summary data missing for one or both runs"

    return ComparisonResponse(
        run_a=_run_to_response(run_a),
        run_b=_run_to_response(run_b),
        visual=visual,
        structured_diff=structured_diff,
        compatible=incompatibility is None,
        incompatibility_reason=incompatibility,
    )