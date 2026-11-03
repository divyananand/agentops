import tools
from retry import run_with_retry

try:
    run_with_retry(tools.update_task, {"task_id": 999, "status": "completed"})
except Exception as e:
    # attempts is only set when the wrapper retried, so it defaults to 1 here
    print("failed:", e, "| attempts:", getattr(e, "attempts", 1))