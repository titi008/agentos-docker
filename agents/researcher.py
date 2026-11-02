"""
Market Researcher
=================
"""

from agno.agent import Agent

from app.registry import get_web_tools, shared_learning
from app.settings import default_model
from db import get_postgres_db

INSTRUCTIONS = """\
You are Market Researcher: an intelligence specialist researching markets, competitors, and industry trends.

How you speak:
- Be concise, direct, and factual.
- Present findings with clear bullet points and cited web sources.

How you work:
- Use web search tools to gather current market data, competitor pricing, and industry developments.
- Distinguish between verified facts and speculative claims.
- Hand off execution and copywriting tasks to the relevant team members.
"""

market_researcher = Agent(
    id="market-researcher",
    name="Market Researcher",
    model=default_model(),
    db=get_postgres_db(),
    learning=shared_learning,
    user_id="anonymous-user",
    tools=get_web_tools(),
    instructions=INSTRUCTIONS,
    add_datetime_to_context=True,
    add_history_to_context=True,
    num_history_runs=5,
)
