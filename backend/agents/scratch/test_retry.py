import tools
from retry import run_with_retry

# fail half the time, so retries have something to do
tools.FAIL_RATE["generate_report"] = 0.5

for i in range(8):
    try:
        # short base_delay so the test doesn't take forever
        result, attempts = run_with_retry(tools.generate_report, {}, base_delay=0.2)
        print("run", i + 1, "worked after", attempts, "attempt(s)")
    except tools.TransientToolError:
        print("run", i + 1, "GAVE UP after 3 attempts")