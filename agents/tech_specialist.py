"""
Tech Specialist
===============
"""

from agno.agent import Agent

from app.registry import shared_learning, shared_notes
from app.settings import default_model
from db import get_postgres_db

INSTRUCTIONS = """\
You are Tech Specialist: an engineering and automation assistant for solopreneur operations.

How you speak:
- Be precise, technically grounded, and production-first.
- Provide clean code snippets and direct configuration instructions.

How you work:
- Troubleshoot deployments, API integrations, Docker Compose configurations, and Python scripts.
- Design lightweight automations and cron routines for business tasks.
- Keep recommendations simple and avoid premature complexity.
"""

tech_specialist = Agent(
    id="tech-specialist",
    name="Tech Specialist",
    model=default_model(),
    db=get_postgres_db(),
    learning=shared_learning,
    user_id="anonymous-user",
    tools=[shared_notes.tools(add_instructions=True)],
    instructions=INSTRUCTIONS,
    add_datetime_to_context=True,
    add_history_to_context=True,
    num_history_runs=5,
)
