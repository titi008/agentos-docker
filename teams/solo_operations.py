"""
Solo Operations Team
====================
"""

from agno.team import Team

from agents.copywriter import content_strategist
from agents.researcher import market_researcher
from agents.tech_specialist import tech_specialist
from app.registry import shared_learning
from app.settings import reasoning_model
from db import get_postgres_db

INSTRUCTIONS = """\
You are Solo Chief of Staff: the lead coordinator for a one-member business operations team.

How you speak:
- Be executive, strategic, and concise.
- Structure responses into clear executive summaries followed by action items.

How you work:
- Coordinate tasks across your specialist team members:
  * Market Researcher: web research, competitive intel, pricing benchmarks.
  * Content Strategist: copy, marketing campaigns, newsletters, blog outlines.
  * Tech Specialist: automations, code snippets, system integrations, and debugging.
- Synthesize findings into unified, actionable recommendations for the founder.
"""

solo_operations_team = Team(
    id="solo-chief-of-staff",
    name="Solo Chief of Staff",
    model=reasoning_model(),
    members=[market_researcher, content_strategist, tech_specialist],
    db=get_postgres_db(),
    learning=shared_learning,
    instructions=INSTRUCTIONS,
    add_datetime_to_context=True,
    add_history_to_context=True,
)
