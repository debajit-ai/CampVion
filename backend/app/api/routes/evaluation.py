import json
import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.db.database import get_db
from app.db import models
from app.agent.agent import AXORAAgent
from app.evaluation.benchmark_runner import run_project_55_benchmark, REPORT_PATH

router = APIRouter()

@router.get("/report")
def get_evaluation_report():
    """
    Retrieve the latest comparative Project 55 benchmark evaluation report.
    Compares the Agentic Execution Engine (DAG + LLM) against the Scripted Rule-Based Baseline.
    """
    if os.path.exists(REPORT_PATH):
        try:
            with open(REPORT_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return run_project_55_benchmark()

@router.post("/run-benchmark")
def execute_benchmark():
    """
    Run the full Project 55 comparative benchmark suite across all 15 scenarios.
    """
    return run_project_55_benchmark()

@router.get("/scenarios")
def list_scenarios(db: Session = Depends(get_db)):
    """
    List all 15 realistic evaluation and benchmark scenarios.
    """
    scenarios = db.query(models.EvaluationScenario).all()
    return [
        {
            "scenario_id": s.scenario_id,
            "name": s.name,
            "category": s.category,
            "student_id": s.student_id,
            "natural_language_request": s.natural_language_request,
            "expected_interpretation": s.expected_interpretation,
            "expected_eligibility": bool(s.expected_eligibility),
            "expected_workflow_steps": json.loads(s.expected_workflow_steps),
            "expected_approval_required": bool(s.expected_approval_required),
            "expected_final_state": s.expected_final_state,
            "expected_failure_mode": s.expected_failure_mode,
            "evaluation_criteria": json.loads(s.evaluation_criteria)
        }
        for s in scenarios
    ]

@router.get("/scenarios/{scenario_id}")
def get_scenario(scenario_id: str, db: Session = Depends(get_db)):
    """
    Retrieve scenario details and evaluation assertions.
    """
    s = db.query(models.EvaluationScenario).filter(models.EvaluationScenario.scenario_id == scenario_id).first()
    if not s:
        raise HTTPException(status_code=404, detail={"code": "SCENARIO_NOT_FOUND", "message": f"Scenario {scenario_id} was not found"})
    return {
        "scenario_id": s.scenario_id,
        "name": s.name,
        "category": s.category,
        "student_id": s.student_id,
        "natural_language_request": s.natural_language_request,
        "expected_interpretation": s.expected_interpretation,
        "expected_eligibility": bool(s.expected_eligibility),
        "expected_workflow_steps": json.loads(s.expected_workflow_steps),
        "expected_approval_required": bool(s.expected_approval_required),
        "expected_final_state": s.expected_final_state,
        "expected_failure_mode": s.expected_failure_mode,
        "evaluation_criteria": json.loads(s.evaluation_criteria)
    }

@router.post("/run/{scenario_id}")
def run_benchmark_scenario(scenario_id: str, db: Session = Depends(get_db)):
    """
    Execute a scenario through the AXORA Agent Engine and evaluate benchmark assertions.
    """
    s = db.query(models.EvaluationScenario).filter(models.EvaluationScenario.scenario_id == scenario_id).first()
    if not s:
        raise HTTPException(status_code=404, detail={"code": "SCENARIO_NOT_FOUND", "message": f"Scenario {scenario_id} was not found"})

    agent = AXORAAgent(db)
    result = agent.start(student_id=s.student_id, goal_text=s.natural_language_request)

    passed_checks = []
    failed_checks = []

    # Check final state
    if result.status == s.expected_final_state:
        passed_checks.append(f"Status matched expected state: {result.status}")
    else:
        # Note: In human approval scenarios, WAITING_FOR_HUMAN is expected
        if s.expected_approval_required and result.status == "WAITING_FOR_HUMAN":
            passed_checks.append("Agent correctly halted at human approval gate")
        else:
            failed_checks.append(f"Status mismatch: expected {s.expected_final_state}, got {result.status}")

    return {
        "scenario_id": s.scenario_id,
        "name": s.name,
        "request_id": result.request_id,
        "actual_status": result.status,
        "completed_tasks_count": len(result.completed_tasks),
        "failed_tasks_count": len(result.failed_tasks),
        "passed_checks": passed_checks,
        "failed_checks": failed_checks,
        "benchmark_passed": len(failed_checks) == 0
    }

