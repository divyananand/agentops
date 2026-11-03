import anthropic
from tools import TOOLS
from dotenv import load_dotenv
import os

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
print("KEY LOADED:", os.getenv("ANTHROPIC_API_KEY"))
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    tools=TOOLS,
    messages=[
        {"role": "user", "content": "Find blockers in the docs"}
    ]
)

print(response.stop_reason)
print(response.content)