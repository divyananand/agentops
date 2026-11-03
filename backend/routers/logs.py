from fastapi import APIRouter, HTTPException
from db import get_cursor   # same checkout desk the tools use

router = APIRouter()


@router.get("/logs")
def get_logs():
    # every tool call, newest first. limit 100 so the page doesn't get huge
    with get_cursor() as cur:
        cur.execute("SELECT * FROM agent_logs ORDER BY created_at DESC LIMIT 100")
        return cur.fetchall()


@router.get("/runs")
def get_runs():
    # every run (one row per user request), newest first
    with get_cursor() as cur:
        cur.execute("SELECT * FROM agent_runs ORDER BY created_at DESC LIMIT 50")
        return cur.fetchall()


@router.get("/runs/{run_id}")
def get_run(run_id: str):
    # one run = the run row + all its tool calls, in the order they happened
    with get_cursor() as cur:
        cur.execute("SELECT * FROM agent_runs WHERE run_id = %s", (run_id,))
        run = cur.fetchone()

        # no such run, so tell the frontend with a proper 404
        if run is None:
            raise HTTPException(status_code=404, detail="run not found")

        # oldest first here (ASC), because a trace reads top to bottom like a story
        cur.execute("SELECT * FROM agent_logs WHERE run_id = %s ORDER BY id ASC", (run_id,))
        steps = cur.fetchall()

         # the approval tickets for this run, in the order they were asked
        cur.execute(
            "SELECT id, tool_name, tool_input, status, created_at, decided_at FROM approvals WHERE run_id = %s ORDER BY id",
            (run_id,)
        )
        approvals = cur.fetchall()

    # one more key in the object, so the page still needs just one fetch
    return {"run": run, "steps": steps, "approvals": approvals}


@router.get("/stats")
def get_stats():
    with get_cursor() as cur:
        # how many tool calls ended each way. one result row per status
        cur.execute("SELECT status, COUNT(*) AS calls FROM agent_logs GROUP BY status")
        status_counts = cur.fetchall()

        # average speed. only calls that actually ran: blocked and rejected rows
        # have latency 0 and would drag the average down. COALESCE gives 0 if there are no rows
        cur.execute(
            "SELECT COALESCE(AVG(latency_ms), 0) AS avg_latency_ms FROM agent_logs WHERE status IN ('success', 'error')"
        )
        avg_latency = cur.fetchone()["avg_latency_ms"]

        # how often each tool was called, busiest first
        cur.execute("SELECT tool_name, COUNT(*) AS calls FROM agent_logs GROUP BY tool_name ORDER BY calls DESC")
        tool_counts = cur.fetchall()

        # tool calls that needed more than one try
        cur.execute("SELECT COUNT(*) AS calls FROM agent_logs WHERE attempts > 1")
        retried = cur.fetchone()["calls"]

        # totals across all runs
        cur.execute(
            "SELECT COUNT(*) AS runs, COALESCE(SUM(cost_usd), 0) AS total_cost FROM agent_runs"
        )
        runs = cur.fetchone()

        # the 10 most recent tool calls
        cur.execute(
            "SELECT id, run_id, tool_name, status, latency_ms, created_at FROM agent_logs ORDER BY id DESC LIMIT 10"
        )
        recent = cur.fetchall()

    return {
        "status_counts": status_counts,
        "avg_latency_ms": avg_latency,
        "tool_counts": tool_counts,
        "retried_calls": retried,
        "total_runs": runs["runs"],
        "total_cost": runs["total_cost"],
        "recent": recent,
    }