import os
import sys
import uuid
import secrets
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from pydantic import BaseModel
from db import get_cursor

# orchestrator.py lives in backend/agents, so add that folder to where python looks
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "agents"))
from orchestrator import run_agent

router = APIRouter()

# most the demo may spend in 24 hours, in dollars. change it with the DAILY_BUDGET_USD env var
DAILY_BUDGET_USD = float(os.getenv("DAILY_BUDGET_USD", "1.00"))
MAX_MESSAGE_CHARS = 300


def require_key(x_demo_key: str = Header(default="")):
    secret = os.getenv("DEMO_KEY")
    # no secret set means nobody gets in. fails closed, so a forgotten env var can't leave it open
    if not secret or not secrets.compare_digest(x_demo_key.encode(), secret.encode()):
        raise HTTPException(status_code=401, detail="demo key required")


class RunRequest(BaseModel):
    message: str


class Decision(BaseModel):
    decision: str   # approved or rejected
    run_id: str     # proves you own the run this ticket belongs to


@router.post("/agent/run", dependencies=[Depends(require_key)])
def start_run(body: RunRequest, background_tasks: BackgroundTasks):
    if len(body.message) > MAX_MESSAGE_CHARS:
        raise HTTPException(status_code=400, detail="message too long")

    # what the last 24 hours of runs cost. runs are saved when they finish,
    # so this is a little behind a run that's still going. close enough for a cap
    with get_cursor() as cur:
        cur.execute(
            "SELECT COALESCE(SUM(cost_usd), 0) AS spent FROM agent_runs WHERE created_at > now() - interval '24 hours'"
        )
        spent = float(cur.fetchone()["spent"])

    if spent >= DAILY_BUDGET_USD:
        raise HTTPException(status_code=429, detail="daily demo budget reached")

    run_id = str(uuid.uuid4())
    background_tasks.add_task(run_agent, body.message, run_id)
    return {"run_id": run_id}


@router.get("/approvals/pending", dependencies=[Depends(require_key)])
def get_pending(run_id: str):
    # only the tickets for the run you ask about
    with get_cursor() as cur:
        cur.execute(
            "SELECT * FROM approvals WHERE status = 'pending' AND run_id = %s ORDER BY id",
            (run_id,)
        )
        return cur.fetchall()


@router.post("/approvals/{approval_id}/decision", dependencies=[Depends(require_key)])
def decide(approval_id: int, body: Decision):
    if body.decision not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="decision must be approved or rejected")

    with get_cursor() as cur:
        # the run_id has to match too. it's a random uuid, so nobody can guess
        # someone else's and approve their ticket
        cur.execute(
            """
            UPDATE approvals SET status = %s, decided_at = now()
            WHERE id = %s AND run_id = %s AND status = 'pending'
            RETURNING id, tool_name, status
            """,
            (body.decision, approval_id, body.run_id)
        )
        row = cur.fetchone()

    if row is None:
        raise HTTPException(status_code=409, detail="already decided, expired, or not your run")
    return row
