"""
AgentOS Entrypoint
==================
"""

from collections.abc import Awaitable, Callable
from os import getenv
from pathlib import Path

from agno.agent import Agent
from agno.job_queue import QueueConfig
from agno.os import AgentOS, CompanyConfig, OSManager
from agno.os.config import CORSConfig
from fastapi import Request, Response
from pydantic import BaseModel

from agents.copywriter import content_strategist
from agents.researcher import market_researcher
from agents.tech_specialist import tech_specialist
from app.company import products
from app.interfaces import attach_interfaces, mcp_auth
from app.pricing import compute_cost_breakdown, pricing_manager
from app.registry import registry, shared_knowledge, shared_learning
from app.settings import (
    get_available_models,
    manager_model,
    model_from_id,
    save_agent_model_override,
)
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


@app.middleware("http")
async def user_identity_middleware(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    """Propagate verified user identity from Cloudflare Zero Trust or forwarded client headers."""
    user_header = request.headers.get("cf-access-authenticated-user-email") or request.headers.get("x-user-id")
    if user_header and not getattr(request.state, "user_id", None):
        request.state.user_id = user_header.strip()

    model_override = request.headers.get("x-model-override")
    if model_override:
        request.state.session_state = {"model_override": model_override.strip()}

    return await call_next(request)


class UpdateAgentModelPayload(BaseModel):
    model_id: str


@app.get("/api/models")
async def get_available_models_endpoint() -> list[dict]:
    """Return palette of supported models for the UI."""
    models = get_available_models()
    return [{"id": m.id, "provider": getattr(m, "provider", "Unknown")} for m in models]


@app.post("/api/agents/{agent_id}/model")
async def update_agent_model_endpoint(agent_id: str, payload: UpdateAgentModelPayload) -> dict:
    """Update and persist the model for an application agent."""
    new_model = model_from_id(payload.model_id)
    save_agent_model_override(agent_id, payload.model_id)

    found = False
    if agent_os.agents:
        for a in agent_os.agents:
            if isinstance(a, Agent) and a.id == agent_id:
                a.model = new_model
                found = True
                break

    return {
        "status": "success",
        "agent_id": agent_id,
        "model_id": payload.model_id,
        "provider": getattr(new_model, "provider", "Unknown"),
        "updated_in_memory": found,
    }


class UpdatePriceRequest(BaseModel):
    model_id: str
    input_cost_per_m: float
    output_cost_per_m: float
    provider: str | None = None


@app.get("/api/pricing")
async def get_pricing() -> dict:
    """Return active model rates and rate change history."""
    return {
        "current_rates": [r.to_dict() for r in pricing_manager.get_current_rates()],
        "history": [r.to_dict() for r in pricing_manager.get_rates()],
    }


@app.post("/api/pricing")
async def update_pricing(payload: UpdatePriceRequest) -> dict:
    """Update pricing for a model effective immediately, leaving past runs unchanged."""
    rate = pricing_manager.update_rate(
        model_id=payload.model_id,
        input_cost_per_m=payload.input_cost_per_m,
        output_cost_per_m=payload.output_cost_per_m,
        provider=payload.provider,
    )
    return {"status": "success", "rate": rate.to_dict()}


@app.get("/api/costs")
async def get_costs() -> dict:
    """Return aggregated token and cost breakdown per model, provider, and day."""
    return compute_cost_breakdown()


if __name__ == "__main__":
    agent_os.serve(app="app.main:app", host="127.0.0.1", port=8000, reload=False)
