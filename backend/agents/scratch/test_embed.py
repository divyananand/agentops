import os
import sys
import voyageai
from dotenv import load_dotenv

# lets python find db.py one folder up (same trick as the other files)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from db import get_cursor

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
vo = voyageai.Client(api_key=os.getenv("VOYAGE_API_KEY"))

with get_cursor() as cur:
    # only grab documents that don't have numbers yet
    # so you can run this script again later and it only does the new ones
    cur.execute("SELECT id, title, content FROM documents WHERE embedding IS NULL")
    docs = cur.fetchall()

    if len(docs) == 0:
        print("nothing to embed")
    else:
        # build the text for each document. title can be empty, so "or" gives "" instead
        texts = []
        for i in range(len(docs)):
            texts.append((docs[i]["title"] or "") + ". " + docs[i]["content"])

        # ONE request for all documents, not one per document (faster, fewer requests)
        # input_type "document" because this is stored text, not a search question
        result = vo.embed(texts, model="voyage-4", input_type="document")

        for i in range(len(docs)):
            # str() turns the list of numbers into text like "[0.01, -0.02, ...]"
            # %s::vector tells postgres to read that text as a vector
            cur.execute(
                "UPDATE documents SET embedding = %s::vector WHERE id = %s",
                (str(result.embeddings[i]), docs[i]["id"])
            )

        print("embedded", len(docs), "documents")