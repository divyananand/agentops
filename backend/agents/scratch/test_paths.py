import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from logger import log_tool_call
from guardrails import validate_tool_call

# blocked path: the guard rejects the call, so we log it with status "blocked"
bad_input = {"title": "x", "priority": "urgent"}
problems = validate_tool_call("create_task", bad_input)
log_tool_call("path-test", "create_task", bad_input, "; ".join(problems), "blocked", 0)

# error path: pretend the tool crashed
log_tool_call("path-test", "update_task", {"task_id": 999}, "connection lost", "error", 55)

print("done, check supabase")