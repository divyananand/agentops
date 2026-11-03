import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from contextlib import contextmanager

# step 1: load the .env FIRST, before anything reads from it
# the path points at the .env that sits next to this file (backend/.env)
env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path=env_path)

# step 2: only now read the variable
# if this line is above load_dotenv, it comes out as None (that was our bug)
DATABASE_URL = os.getenv("DATABASE_URL")


@contextmanager
def get_cursor():
    # open a connection to supabase
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    cur = conn.cursor()
    try:
        yield cur        # hands the cursor to whoever wrote "with get_cursor() as cur"
        conn.commit()    # save changes if nothing went wrong
    except Exception:
        conn.rollback()  # undo half-finished changes if something broke
        raise
    finally:
        cur.close()      # always close, even after an error
        conn.close()