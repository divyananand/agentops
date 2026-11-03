import json
from db import get_cursor   # same checkout desk as the tools use


def log_tool_call(run_id, tool_name, tool_input, output, status, latency_ms, attempts=1):
    input_json = json.dumps(tool_input, default=str)
    output_json = json.dumps(output, default=str)

    try:
        with get_cursor() as cur:
            cur.execute(
                """
                INSERT INTO agent_logs (run_id, tool_name, input, output, status, latency_ms, attempts)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (run_id, tool_name, input_json, output_json, status, latency_ms, attempts)
            )
    except Exception as e:
        print("-> logging failed:", e)

# prices per ONE MILLION tokens, for claude-sonnet-4-6
# checked on anthropic's pricing page (platform.claude.com/docs/en/about-claude/pricing)
# prices can change, so these two lines are the only place to update
INPUT_PRICE_PER_M = 3.00
OUTPUT_PRICE_PER_M = 15.00


def log_run(run_id, user_message, input_tokens, output_tokens, claude_calls):
    # cost = tokens / 1 million * price per million
    cost = (input_tokens / 1_000_000) * INPUT_PRICE_PER_M + (output_tokens / 1_000_000) * OUTPUT_PRICE_PER_M

    # same try/except idea: a logging problem must never crash the agent
    try:
        with get_cursor() as cur:
            cur.execute(
                """
                INSERT INTO agent_runs (run_id, user_message, input_tokens, output_tokens, cost_usd, claude_calls)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (run_id, user_message, input_tokens, output_tokens, cost, claude_calls)
            )
    except Exception as e:
        print("-> run logging failed:", e)