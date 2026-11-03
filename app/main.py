"""
AgentOS Entrypoint
==================
"""

from os import getenv
from pathlib import Path

from agno.job_queue import QueueConfig
from agno.os import AgentOS, CompanyConfig, OSManager
from agno.os.config import CORSConfig

from agents.copywriter import content_strategist
from agents.researcher import market_researcher
from agents.tech_specialist import tech_specialist
from app.company import products
from app.interfaces import attach_interfaces, mcp_auth
from app.registry import registry, shared_knowledge, shared_learning
from app.settings import manager_model
from db import get_postgres_db
from teams.solo_operations import solo_operations_team

runtime_env = getenv("RUNTIME_ENV", "prd")
agentos_url = getenv("AGENTOS_URL", "http://127.0.0.1:8000")
agentos_root = Path(__file__).resolve().parent.parent
db = get_postgres_db()

cors_origins_env = getenv("CORS_ALLOWED_ORIGINS", "")
cors_regex_env = getenv("CORS_ORIGIN_REGEX")
cors_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
cors_config = (
    CORSConfig(
        origins=cors_origins if cors_origins else None,
        origin_regex=cors_regex_env if cors_regex_env else None,
    )
    if cors_origins or cors_regex_env
    else None
)

agent_os = AgentOS(
    db=db,
    mcp=True,
    tracing=True,
    scheduler=True,
    user_isolation=True,
    user_directory=True,
    scheduler_base_url=agentos_url,
    mcp_auth=mcp_auth(agentos_url),
    cors=cors_config,
    authorization=runtime_env != "dev",
    manager=OSManager(
        root=agentos_root,
        model=manager_model(),
        learning=shared_learning,
    ),
    company=CompanyConfig(products=products, model=manager_model()),
    queue=QueueConfig(durable=True, db=db),
    knowledge=[shared_knowledge],
    teams=[
        solo_operations_team,
    ],
    agents=[
        market_researcher,
        content_strategist,
        tech_specialist,
    ],
    registry=registry,
    config=str(agentos_root / "app" / "config.yaml"),
)
attach_interfaces(agent_os)
app = agent_os.get_app()

if __name__ == "__main__":
    agent_os.serve(app="app.main:app", host="127.0.0.1", port=8000, reload=False)
