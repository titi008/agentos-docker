"""
Market Researcher
=================
"""

from agno.agent import Agent

from app.registry import get_web_tools, shared_learning, shared_notes
from app.settings import fast_model, get_agent_model, model_override_hook
from db import get_postgres_db

INSTRUCTIONS = """\
You are Market Researcher: an intelligence specialist researching markets, competitors, and industry trends.

How you speak:
- Be concise, direct, and factual.
- Present findings with clear bullet points and cited web sources.

How you work:
- Use web search tools to gather current market data, competitor pricing, and industry developments.
- Store research briefs, competitor teardowns, and pricing comparisons in shared notes.
- Distinguish between verified facts and speculative claims.
- Hand off execution and copywriting tasks to the relevant team members.
"""

market_researcher = Agent(
    id="market-researcher",
    name="Market Researcher",
    role="Web research, competitive intelligence, pricing benchmarks, and industry trends.",
    description=(
        "Use for any question needing live web search, page extraction, market data, "
        "competitor analysis, pricing benchmarks, or cited external sources."
    ),
    model=get_agent_model("market-researcher", fast_model),
    pre_hooks=[model_override_hook],
    db=get_postgres_db(),
    learning=shared_learning,
    user_id="anonymous-user",
    tools=[*get_web_tools(), shared_notes.tools(add_instructions=True)],
    instructions=INSTRUCTIONS,
    add_datetime_to_context=True,
    add_history_to_context=True,
    num_history_runs=5,
)
