import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))   # so python finds db.py

from logger import log_tool_call

# pretend a tool call just happened and save it
log_tool_call("test-run", "search_docs", {"query": "blocker"}, [{"id": 1}], "success", 123)
print("done, now check supabase")