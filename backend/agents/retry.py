import time
import psycopg2
import voyageai
from tools import TransientToolError

# only these errors are worth retrying, because they're temporary:
# our fake error, a dropped database connection, and voyage's rate limit
# anything NOT in this list (bad input, a real bug) fails straight away, no retry
RETRYABLE = (
    TransientToolError,
    psycopg2.OperationalError,
    voyageai.error.RateLimitError,
)


def run_with_retry(func, tool_input, max_attempts=3, base_delay=1):
    # returns (result, how many attempts it took)
    attempt = 1
    while True:
        try:
            result = func(**tool_input)
            return result, attempt
        except RETRYABLE as e:
            # out of attempts, so let the error go up to the orchestrator
            if attempt >= max_attempts:
                e.attempts = attempt
                raise

            # backoff: 1s, then 2s, then 4s. each wait is double the last
            wait = base_delay * (2 ** (attempt - 1))
            print("-> attempt {} failed ({}), retrying in {}s".format(attempt, e, wait))
            time.sleep(wait)
            attempt = attempt + 1