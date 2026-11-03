import sys
import os
import anthropic
from dotenv import load_dotenv
from guardrails import validate_tool_call
import time
import uuid
from logger import log_tool_call , log_run
from retry import run_with_retry
from approvals import request_approval

# lets python find db.py, which sits one folder up
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from tools import TOOLS, search_docs, create_task, update_task, generate_report

# load the api key from .env (one folder up)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# turns the tool name claude sends into the real function
TOOL_FUNCTIONS = {
    "search_docs": search_docs,
    "create_task": create_task,
    "update_task": update_task,
    "generate_report": generate_report
}

# the most times one request is allowed to call claude. a safety net against runaway loops
MAX_CLAUDE_CALLS = 8
# tools that change data. the agent must get a human's OK before running these
# a set is just a list where you can ask "is this name in it?" quickly
REQUIRES_APPROVAL = {"create_task", "update_task"}

# a tiny stand-in shaped like claude's text block (it has .type and .text),
# so the code that prints answers works the same for both cases
class StopNotice:
    type = "text"

    def __init__(self, text):
        self.text = text

def run_agent(user_message, run_id=None, auto_decision=None):
    # the web endpoint passes in its own id. from the terminal we make one, like before
    if run_id is None:
        run_id = str(uuid.uuid4())
        # running totals for this whole request
    # they start at 0 and we add to them after every claude call
    total_input = 0
    total_output = 0
    claude_calls = 0

    messages = [{"role": "user", "content": user_message}]

    while True:
                # cap check. runs BEFORE each claude call, so we never go over the limit
        if claude_calls >= MAX_CLAUDE_CALLS:
            print("-> STOPPED: hit the limit of", MAX_CLAUDE_CALLS, "claude calls")
            # still save the run so the cost shows up on the runs page
            log_run(run_id, user_message, total_input, total_output, claude_calls)
            return [StopNotice("I stopped because this request needed too many steps. Please try a simpler request.")]
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            tools=TOOLS,
            messages=messages
        )

        total_input += response.usage.input_tokens
        total_output += response.usage.output_tokens
        claude_calls += 1

        if response.stop_reason != "tool_use":
            log_run(run_id, user_message, total_input, total_output, claude_calls)
            return response.content

        messages.append({"role": "assistant", "content": response.content})

        tool_results = []
        for block in response.content:
            if block.type == "tool_use":

                # PATH 1: blocked. the guard says no, so the tool never runs
                problems = validate_tool_call(block.name, block.input)
                if problems:
                    message = "Error, tool was not run: " + "; ".join(problems)
                    print("-> BLOCKED:", block.name, problems)
                    # latency is 0 because nothing ran
                    log_tool_call(run_id, block.name, block.input, message, "blocked", 0)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": message,
                        "is_error": True
                    })
                    continue
                                # approval gate. only for tools that change data
                if block.name in REQUIRES_APPROVAL:
                    # eval mode: a decision is passed in, so there's no human and no ticket
                    if auto_decision is not None:
                        decision = auto_decision
                    else:
                        approval_id, decision = request_approval(run_id, block.name, block.input)

                    # anything except "approved" means the tool must NOT run
                    if decision != "approved":
                        if decision == "rejected":
                            message = "The user rejected this action. Nothing was changed."
                        else:
                            message = "The user did not respond in time. The action was NOT done."

                        print("-> NOT RUN:", block.name, decision)
                        # latency 0 because nothing ran. the status is "rejected" or "expired"
                        log_tool_call(run_id, block.name, block.input, message, decision, 0)
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": message,
                            "is_error": True
                        })
                        continue   # skip the tool, go to the next request

                # start the stopwatch right before the tool runs
                start = time.time()
                try:
                    # goes through the retry wrapper. it hands back the result AND how many tries it took
                    result, attempts = run_with_retry(TOOL_FUNCTIONS[block.name], block.input)
                    latency_ms = int((time.time() - start) * 1000)

                    # PATH 3: success. the tool ran and returned normally
                    print("-> tool called:", block.name, block.input, latency_ms, "ms")
                    log_tool_call(run_id, block.name, block.input, result, "success", latency_ms,attempts)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": str(result)
                    })

                except Exception as e:
                    latency_ms = int((time.time() - start) * 1000)

                    # PATH 2: error. the guard passed it but the tool crashed
                    message = "Error while running tool: " + str(e)
                    print("-> FAILED:", block.name, e)
                    attempts = getattr(e, "attempts", 1)
                    message = "Error while running tool after {} attempt(s): {}".format(attempts, e)
                    log_tool_call(run_id, block.name, block.input, message, "error", latency_ms, attempts)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": message,
                        "is_error": True
                    })

        messages.append({"role": "user", "content": tool_results})


if __name__ == "__main__":
    answer = run_agent("Create a task called 'reject test' with high priority")
    for block in answer:
        if block.type == "text":
            print(block.text)