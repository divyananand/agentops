import os
import sys
import time
import uuid

# lets python find db.py one folder up, same trick as the other files
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from db import get_cursor
from orchestrator import run_agent

ALL_TOOLS = ["search_docs", "create_task", "update_task", "generate_report"]
WRITES = ["create_task", "update_task"]

# each test: the request, tools it MUST use, tools it must NOT use
TESTS = [
    {"request": "What is slowing the team down?", "expect": ["search_docs"], "forbid": WRITES},
    {"request": "Find the blockers in the docs and create a task for each one", "expect": ["search_docs", "create_task"], "forbid": ["update_task"], "bad_words": ["retry", "webhook", "lunch", "budget", "hiring"]},
    {"request": "Create a task called 'write tests' with high priority", "expect": ["create_task"], "forbid": ["search_docs", "update_task"]},
    {"request": "Give me a summary report of the tasks", "expect": ["generate_report"], "forbid": WRITES},
    {"request": "Mark task 1 as completed", "expect": ["update_task"], "forbid": ["create_task"]},
    {"request": "When is the team lunch?", "expect": ["search_docs"], "forbid": WRITES},
    {"request": "How many tasks are pending?", "expect": ["generate_report"], "forbid": WRITES},
    {"request": "What did we decide about hiring?", "expect": ["search_docs"], "forbid": WRITES},
    # no tool needed at all, so using any tool is a fail
    {"request": "Hello, what can you do?", "expect": [], "forbid": ALL_TOOLS},
    # there is no delete tool. the agent should not try to fake it with the others
    {"request": "Delete all the tasks", "expect": [], "forbid": WRITES},
]


def calls_made(run_id):
    # every tool call in this run, with the input Claude sent
    with get_cursor() as cur:
        cur.execute("SELECT tool_name, input FROM agent_logs WHERE run_id = %s ORDER BY id", (run_id,))
        return cur.fetchall()


def run_evals():
    passed = 0
    run_ids = []

    for i in range(len(TESTS)):
        test = TESTS[i]
        run_id = str(uuid.uuid4())
        run_ids.append(run_id)
        print("\n[{}/{}] {}".format(i + 1, len(TESTS), test["request"]))

        crashed = False
        try:
            # auto_decision="rejected": no human to click, and nothing gets written
            run_agent(test["request"], run_id, auto_decision="rejected")
        except Exception as e:
            crashed = True
            print("   agent crashed:", e)

        calls = calls_made(run_id)
        used = [c["tool_name"] for c in calls]

        # what it should have used but didn't, and what it used but shouldn't have
        missing = [t for t in test["expect"] if t not in used]
        forbidden_hit = [t for t in test["forbid"] if t in used]

        # argument check: did a call carry words from a document that isn't a blocker?
        bad_hit = []
        for c in calls:
            text = str(c["input"]).lower()
            for w in test.get("bad_words", []):
                if w in text:
                    bad_hit.append(c["tool_name"] + " input contains '" + w + "'")

        # a crash always counts as a fail, so an empty list can't sneak through as a pass
        ok = (not crashed) and len(missing) == 0 and len(forbidden_hit) == 0 and len(bad_hit) == 0
        if ok:
            passed = passed + 1

        print("   used:", used if used else "no tools")
        print("   ", "PASS" if ok else "FAIL")
        if missing:
            print("    missing:", missing)
        if forbidden_hit:
            print("    should not have used:", forbidden_hit)
        if bad_hit:
            print("    bad input:", bad_hit)

        # voyage allows 3 searches a minute without a payment method, so wait after a search
        if "search_docs" in used and i < len(TESTS) - 1:
            print("   waiting 22s (voyage rate limit)...")
            time.sleep(22)

    # what the whole eval cost, from the same agent_runs table
    with get_cursor() as cur:
        cur.execute("SELECT COALESCE(SUM(cost_usd), 0) AS cost FROM agent_runs WHERE run_id = ANY(%s)", (run_ids,))
        cost = cur.fetchone()["cost"]

    print("\n==============================")
    print("score: {}/{} passed".format(passed, len(TESTS)))
    print("eval cost: ${:.4f}".format(float(cost)))


if __name__ == "__main__":
    run_evals()
