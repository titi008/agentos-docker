"""
Tech Specialist
===============
"""

from agno.agent import Agent

from app.registry import get_web_tools, shared_learning, shared_notes
from app.settings import get_agent_model, model_override_hook, reasoning_model
from db import get_postgres_db

INSTRUCTIONS = """\
You are Tech Specialist: an engineering and automation assistant for solopreneur operations.

How you speak:
- Be precise, technically grounded, and production-first.
- Provide clean code snippets and direct configuration instructions.

How you work:
- Troubleshoot deployments, API integrations, Docker Compose configurations, and Python scripts.
- Use web search tools to inspect official documentation, library specs, and modern SDK releases.
- Design lightweight automations and cron routines for business tasks.
- Keep recommendations simple and avoid premature complexity.
"""

tech_specialist = Agent(
    id="tech-specialist",
    name="Tech Specialist",
    role="Automations, code snippets, API integrations, deployments, and debugging.",
    description=(
        "Use for scripts, Docker or deployment configs, API integrations, debugging, "
        "and verifying current library or SDK documentation on the web."
    ),
    model=get_agent_model("tech-specialist", reasoning_model),
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
