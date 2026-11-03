import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from approvals import request_approval

# pretend the agent wants to create a task. we give you 60 seconds to answer
approval_id, status = request_approval("test-run", "create_task", {"title": "test"}, timeout_seconds=120)
print("result:", approval_id, status)