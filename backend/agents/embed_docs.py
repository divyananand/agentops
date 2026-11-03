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
    # only documents with no numbers yet, so it's safe to run again
    cur.execute("SELECT id, title, content FROM documents WHERE embedding IS NULL")
    docs = cur.fetchall()

    if len(docs) == 0:
        print("nothing to embed")
    else:
        # one text per document: title and content joined
        texts = []
        for i in range(len(docs)):
            texts.append((docs[i]["title"] or "") + ". " + docs[i]["content"])

        # one request for all of them. "document" because this is stored text
        result = vo.embed(texts, model="voyage-4", input_type="document")

        for i in range(len(docs)):
            # %s::vector tells postgres to read the text as a vector
            cur.execute(
                "UPDATE documents SET embedding = %s::vector WHERE id = %s",
                (str(result.embeddings[i]), docs[i]["id"])
            )

        print("embedded", len(docs), "documents")