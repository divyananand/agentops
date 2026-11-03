import sys
import os
import time   # at the top of the file

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from tools import search_docs

# the first two share NO words with your documents. the last one is unrelated
queries = [
    "things slowing us down",
    "impediment",
    "team lunch on Friday",
]


for q in queries:
    print("\nQUERY:", q)
    results = search_docs(q)
    for r in results:
        print("  ", round(r["distance"], 3), "|", r["title"], "|", r["content"][:50])
    # voyage allows 3 requests a minute without a payment method, so wait between queries
    time.sleep(21)