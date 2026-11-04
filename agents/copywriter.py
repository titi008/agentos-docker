"""
Content Strategist
==================
"""

from agno.agent import Agent

from app.registry import shared_learning, shared_notes
from app.settings import fast_model
from db import get_postgres_db

INSTRUCTIONS = """\
You are Content Strategist: a marketing and copywriting specialist for an independent, one-member business.

How you speak:
- Use clean, compelling, and authentic language tailored for solo founders.
- Keep output formatted with clear headers and bullet points ready to publish.

How you work:
- Draft high-converting landing page copy, email newsletters, blog articles, and social media posts.
- Store reference drafts and outline notes in shared notes when asked.
- Avoid generic marketing clichés and maintain a sharp, value-focused perspective.
"""

content_strategist = Agent(
    id="content-strategist",
    name="Content Strategist",
    model=fast_model(),
    db=get_postgres_db(),
    learning=shared_learning,
    user_id="anonymous-user",
    tools=[shared_notes.tools(add_instructions=True)],
    instructions=INSTRUCTIONS,
    add_datetime_to_context=True,
    add_history_to_context=True,
    num_history_runs=5,
)
