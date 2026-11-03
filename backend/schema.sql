-- rebuilds the AgentOps database from scratch.
-- run it once in the supabase sql editor (or psql), then run agents/embed_docs.py
-- to fill in the embedding column for the sample documents

-- pgvector, for the embedding column and similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- the to-do list the agent reads and changes
CREATE TABLE IF NOT EXISTS tasks (
    id          serial PRIMARY KEY,
    title       text NOT NULL,
    description text,
    status      text DEFAULT 'pending',
    priority    text DEFAULT 'medium',
    due_date    text,
    created_at  timestamptz DEFAULT now()
);

-- the team documents search_docs looks through. voyage-4 embeddings are 1024 numbers long
CREATE TABLE IF NOT EXISTS documents (
    id         serial PRIMARY KEY,
    title      text,
    content    text NOT NULL,
    created_at timestamptz DEFAULT now(),
    embedding  vector(1024)
);

-- one row per user request: what it cost and how many times claude was called
CREATE TABLE IF NOT EXISTS agent_runs (
    run_id        text PRIMARY KEY,
    user_message  text,
    input_tokens  integer,
    output_tokens integer,
    cost_usd      numeric(10, 6),
    claude_calls  integer,
    created_at    timestamptz DEFAULT now()
);

-- one row per tool call. status is success, error, blocked, rejected or expired
CREATE TABLE IF NOT EXISTS agent_logs (
    id         serial PRIMARY KEY,
    run_id     text NOT NULL,
    tool_name  text NOT NULL,
    input      jsonb,
    output     jsonb,
    status     text NOT NULL,
    latency_ms integer,
    created_at timestamptz DEFAULT now(),
    attempts   integer DEFAULT 1
);

-- the approval tickets. pending until a human approves or rejects, or it expires
CREATE TABLE IF NOT EXISTS approvals (
    id         serial PRIMARY KEY,
    run_id     text NOT NULL,
    tool_name  text NOT NULL,
    tool_input jsonb,
    status     text NOT NULL DEFAULT 'pending',
    created_at timestamptz DEFAULT now(),
    decided_at timestamptz
);

-- sample documents. the evals expect exactly these: 3 real blockers
-- (one of them never says "blocker") and 4 that are not
INSERT INTO documents (title, content) VALUES
    ('Sprint Notes',  'Blocker: API rate limiting is causing failed requests during peak load.'),
    ('Meeting Notes', 'Blocker: Frontend team waiting on updated design tokens from design team.'),
    ('Standup Log',   'Task discussed: need to add retry logic to the payment webhook handler.'),
    ('Team Social',   'Team lunch is booked for Friday at 12:30 at the Italian place near the office.'),
    ('Hiring Update', 'We are interviewing two backend engineer candidates next week.'),
    ('Budget Review', 'Q3 cloud spend came in 12 percent under budget.'),
    ('Release Notes', 'We cannot ship the mobile release until the security review is signed off.');
