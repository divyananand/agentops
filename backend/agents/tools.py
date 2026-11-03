import sys
import os
import random

# lets python find db.py, which sits one folder up (in backend/)
# putting it here means any file that imports tools.py works,
# so we don't have to repeat this line in every file
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# a temporary error: running the same call again could work
class TransientToolError(Exception):
    pass

# chance (0 to 1) that each tool fails on purpose. keep at 0.0 normally
FAIL_RATE = {"generate_report": 0.0}

def maybe_fail(tool_name):
    # random.random() gives a number between 0 and 1
    # if it lands under the fail rate, we raise the error
    if random.random() < FAIL_RATE.get(tool_name, 0):
        raise TransientToolError("simulated timeout in " + tool_name)

    




TOOLS = [
    {
    "name": "search_docs",
    # claude reads this to decide how to use the results, so we tell it exactly how the search behaves
    "description": "Search stored documents by meaning. Use this when you need information from the document database before answering. Results are ranked nearest first and ALWAYS include the closest documents even if they are unrelated. Each result has a distance (lower means closer). Judge relevance yourself and ignore results that do not actually answer the request.",
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                # semantic search matches meaning, so natural language works better than one keyword
                "description": "What you are looking for, described in plain natural language, for example 'things blocking the team'. Meaning is matched, not exact words."
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of results to return. Use 5 when the user does not specify a number."
            }
        },
        "required": ["query"]
    }
},

    {
        "name": "create_task",
        "description": "Create a new task when the user asks to add, create, or make a task. Use this tool when a new task needs to be stored in the task database.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {
                    "type": "string",
                    "description": "The title or short name of the task."
                },
                "description": {
                    "type": "string",
                    "description": "A detailed description of what the task involves."
                },
                "status": {
                    "type": "string",
                    "enum": ["pending", "in_progress", "completed"],
                    "description": "The current status of the task, such as pending, in_progress, or completed."
                },
                "priority": {
                            "type": "string",
                            "enum": ["low", "medium", "high"],
                            "description": "The priority of the task."
                        },
                "due_date": {
                    "type": "string",
                    "description": "The date by which the task should be completed."
                }
            },
            "required": ["title"]
        }
    },

    {
        "name": "update_task",
        "description": "Update an existing task when the user asks to change its details. Use the task ID to identify the exact task, and update only the fields the user requested to change.",
        "input_schema": {
            "type": "object",
            "properties": {
                "task_id": {
                    "type": "integer",
                    "description": "The unique ID of the task that should be updated."
                },
                "title": {
                    "type": "string",
                    "description": "The new title for the task."
                },
                "description": {
                    "type": "string",
                    "description": "The new description for the task."
                },
                "status": {
                    "type": "string",
                    "enum": ["pending", "in_progress", "completed"],
                    "description": "The new status of the task."
                },
                "priority": {
                    "type": "string",
                    # same list as create_task, keep them identical
                    "enum": ["low", "medium", "high"],
                    "description": "The new priority of the task."
                },
                "due_date": {
                    "type": "string",
                    "description": "The new due date for the task."
                }
            },
            "required": ["task_id"]
        }
    },

    {
        "name": "generate_report",
        "description": "Generate a report using the available task data. Use this tool when the user asks for a report or summary of the tasks.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    }
]

# ---------- THE KITCHEN: real functions that touch the database ----------
# Claude never sees any of this code. It only sees the TOOLS menu above.
# The orchestrator calls these when Claude asks for them.

from db import get_cursor   # the checkout desk from db.py (connect, commit, close handled for us)


def search_docs(query: str, limit: int = 5):
    # imported here (not at the top) so a missing key only matters when this tool runs
    import os
    import voyageai

    # make the client when needed. db.py already loaded the .env when it was imported
    vo = voyageai.Client(api_key=os.getenv("VOYAGE_API_KEY"))

    # turn the SEARCH QUESTION into 1024 numbers
    # input_type is "query" here, not "document", because this is a question, not stored text
    # it must be the same model we used for the documents (voyage-4), or the maps don't match
    query_numbers = vo.embed([query], model="voyage-4", input_type="query").embeddings[0]

    with get_cursor() as cur:
        # <=> is the distance between the question's pin and each document's pin
        # ORDER BY distance puts the closest document first
        # we also return the distance, so we can SEE how close each match is
        cur.execute(
            """
            SELECT id, title, content, embedding <=> %s::vector AS distance
            FROM documents
            WHERE embedding IS NOT NULL
            ORDER BY distance
            LIMIT %s
            """,
            (str(query_numbers), limit)
        )
        return cur.fetchall()


def create_task(title: str, description: str = None, status: str = "pending", priority: str = "medium", due_date: str = None):
    # only title is required (same as "required": ["title"] in the schema)
    # everything else has a Python default, so Claude can leave it out
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO tasks (title, description, status, priority, due_date)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, title, description, status, priority, due_date
            """,
            (title, description, status, priority, due_date)
        )
        return cur.fetchone()   # RETURNING gives us the new row back, so Claude can see the task id


def update_task(task_id: int, title: str = None, description: str = None, status: str = None, priority: str = None, due_date: str = None):
    with get_cursor() as cur:
        cur.execute(
            """
            UPDATE tasks
            SET title = COALESCE(%s, title),
                description = COALESCE(%s, description),
                status = COALESCE(%s, status),
                priority = COALESCE(%s, priority),
                due_date = COALESCE(%s, due_date)
            WHERE id = %s
            RETURNING id, title, description, status, priority, due_date
            """,
            (title, description, status, priority, due_date, task_id)
        )
        row = cur.fetchone()

        # no row came back, so that id doesn't exist. fail loudly instead of returning None
        # ValueError is NOT in retry.py's RETRYABLE list, so it won't be retried
        if row is None:
            raise ValueError("no task found with id " + str(task_id))
        return row


def generate_report():
    maybe_fail("generate_report") 
    # no inputs, matches the empty "properties" in the schema
    with get_cursor() as cur:
        cur.execute("SELECT status, COUNT(*) FROM tasks GROUP BY status")
        rows = cur.fetchall()
        # each row is a dict like {"status": "pending", "count": 3}
        # (the RealDictCursor thing we fixed earlier), so we read it by key
        return {row["status"]: row["count"] for row in rows}    