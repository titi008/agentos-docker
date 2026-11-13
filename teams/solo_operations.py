"""
Solo Operations Team
====================
"""

from agno.team import Team
from agno.tools.company import CompanyTools

from agents.copywriter import content_strategist
from agents.researcher import market_researcher
from agents.tech_specialist import tech_specialist
from app.registry import shared_learning, shared_notes
from app.settings import get_team_model, model_override_hook, reasoning_model
from db import get_postgres_db

INSTRUCTIONS = """\
You are Solo Chief of Staff: the lead coordinator for a one-member business operations team.

How you speak:
- Be executive, strategic, and concise.
- Structure responses into clear executive summaries followed by action items.
- Cite sources returned by your specialists rather than presenting unverified claims as fact.

How you work:
- Consult company products, playbooks, and wiki pages using your company tools to understand the business context.
- You do not have direct web search or fetch tools. Do NOT answer from memory when a request
  involves external, time-sensitive, or verifiable facts (markets, competitors, pricing,
  industry trends, recent news/releases, specific URLs, or live documentation).
- Always delegate those lookups before answering:
  * Market Researcher: live web research, page extraction, competitive intel, pricing
    benchmarks, and industry trends (require cited URLs).
  * Content Strategist: copy, marketing campaigns, newsletters, and blog outlines.
  * Tech Specialist: automations, code snippets, system integrations, debugging, and live SDK/API documentation checks.
- Save shared drafts, outlines, and cross-functional plans to shared notes for the team.
- Synthesize specialist findings into unified, actionable recommendations for the founder.
"""

solo_operations_team = Team(
    id="solo-chief-of-staff",
    name="Solo Chief of Staff",
    model=get_team_model("solo-chief-of-staff", reasoning_model),
    pre_hooks=[model_override_hook],
    members=[market_researcher, content_strategist, tech_specialist],
    db=get_postgres_db(),
    learning=shared_learning,
    tools=[
        CompanyTools(
            get_postgres_db(),
            user_isolation=False,
            decision_tools=False,
            summary_tools=False,
            refresh_tools=False,
        ),
        shared_notes.tools(add_instructions=True),
    ],
    instructions=INSTRUCTIONS,
    add_datetime_to_context=True,
    add_history_to_context=True,
    add_member_tools_to_context=True,
)
