import json
import time
from db import get_cursor


def request_approval(run_id, tool_name, tool_input, timeout_seconds=120, poll_seconds=2):
    # returns (approval_id, status) where status is "approved", "rejected" or "expired"

    # step 1: pin a ticket on the rail. status starts as "pending" (the table default)
    with get_cursor() as cur:
        cur.execute(
            "INSERT INTO approvals (run_id, tool_name, tool_input) VALUES (%s, %s, %s) RETURNING id",
            (run_id, tool_name, json.dumps(tool_input, default=str))
        )
        approval_id = cur.fetchone()["id"]

    print("-> waiting for approval #{} ({})".format(approval_id, tool_name))

    # step 2: look at the rail again and again until it's stamped or time runs out
    # we measure real clock time, because each database check also takes a couple of seconds
    start = time.time()
    while time.time() - start < timeout_seconds:
        with get_cursor() as cur:
            cur.execute("SELECT status FROM approvals WHERE id = %s", (approval_id,))
            status = cur.fetchone()["status"]

        # anything other than "pending" means a human has answered
        if status != "pending":
            return approval_id, status

        time.sleep(poll_seconds)

    # step 3: nobody answered in time, so mark it expired. AND status = 'pending'
    # makes sure we never overwrite an answer that arrived at the last second
    with get_cursor() as cur:
        cur.execute(
            "UPDATE approvals SET status = 'expired', decided_at = now() WHERE id = %s AND status = 'pending'",
            (approval_id,)
        )
    return approval_id, "expired"