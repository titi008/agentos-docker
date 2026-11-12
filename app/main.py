"""
AgentOS Entrypoint
==================
"""

from collections.abc import Awaitable, Callable
from os import getenv
from pathlib import Path
from typing import Any

from agno.agent import Agent
from agno.job_queue import QueueConfig
from agno.os import AgentOS, CompanyConfig, OSManager
from agno.os.config import CORSConfig
from agno.team import Team
from fastapi import FastAPI, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError

from agents.copywriter import content_strategist
from agents.researcher import market_researcher
from agents.tech_specialist import tech_specialist
from app.company import products
from app.interfaces import attach_interfaces, mcp_auth
from app.patches import apply_patches
from app.pricing import compute_cost_breakdown, pricing_manager
from app.registry import registry, shared_knowledge, shared_learning
from app.settings import (
    chat_model_state,
    get_available_models,
    manager_model,
    model_from_id,
    save_agent_model_override,
)
from db import get_postgres_db
from teams.solo_operations import solo_operations_team

apply_patches()

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

base_app = FastAPI()


@base_app.middleware("http")
async def user_identity_middleware(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    """Propagate verified user identity from Cloudflare Zero Trust or forwarded client headers."""
    user_header = request.headers.get("cf-access-authenticated-user-email") or request.headers.get("x-user-id")
    if user_header and not getattr(request.state, "user_id", None):
        request.state.user_id = user_header.strip()

    chat_model = chat_model_state(request.url.path, request.headers.get("x-model-override"))
    if chat_model:
        request.state.session_state = chat_model

    return await call_next(request)


class UpdateAgentModelPayload(BaseModel):
    model_id: str


def _palette_model(model_id: str) -> Any:
    """Return a model for an ID from the /api/models palette, or answer 422."""
    if model_id not in {m.id for m in get_available_models()}:
        raise HTTPException(status_code=422, detail=f"Unknown model {model_id!r}. Choose one listed by /api/models.")
    return model_from_id(model_id)


def _save_model_choice(component_id: str, model_id: str) -> None:
    """Save a model choice in the database, or answer 503."""
    try:
        save_agent_model_override(component_id, model_id)
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503, detail="The model couldn't be saved: the database is unavailable."
        ) from exc


@base_app.get("/api/models")
async def get_available_models_endpoint() -> list[dict]:
    """Return palette of supported models for the UI."""
    models = get_available_models()
    return [{"id": m.id, "provider": getattr(m, "provider", "Unknown")} for m in models]


# The model and pricing routes are sync so their database calls run in FastAPI's
# threadpool instead of blocking the event loop.
@base_app.api_route("/agents/{agent_id}/model", methods=["POST", "PATCH", "PUT"])
@base_app.api_route("/api/agents/{agent_id}/model", methods=["POST", "PATCH", "PUT"])
def update_agent_model_endpoint(agent_id: str, payload: UpdateAgentModelPayload) -> dict:
    """Change the model of a code-defined agent and save it, so redeploys keep it."""
    agent = next((a for a in agent_os.agents or [] if isinstance(a, Agent) and a.id == agent_id), None)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"No code-defined agent has the id {agent_id!r}.")
    new_model = _palette_model(payload.model_id)
    _save_model_choice(agent_id, payload.model_id)
    agent.model = new_model

    return {
        "status": "success",
        "agent_id": agent_id,
        "model_id": payload.model_id,
        "provider": getattr(new_model, "provider", "Unknown"),
        "updated_in_memory": True,
    }


@base_app.api_route("/teams/{team_id}/model", methods=["POST", "PATCH", "PUT"])
@base_app.api_route("/api/teams/{team_id}/model", methods=["POST", "PATCH", "PUT"])
def update_team_model_endpoint(team_id: str, payload: UpdateAgentModelPayload) -> dict:
    """Change the leader model of a code-defined team and save it, so redeploys keep it."""
    team = next((t for t in agent_os.teams or [] if isinstance(t, Team) and t.id == team_id), None)
    if team is None:
        raise HTTPException(status_code=404, detail=f"No code-defined team has the id {team_id!r}.")
    new_model = _palette_model(payload.model_id)
    _save_model_choice(team_id, payload.model_id)
    team.model = new_model

    return {
        "status": "success",
        "team_id": team_id,
        "model_id": payload.model_id,
        "provider": getattr(new_model, "provider", "Unknown"),
        "updated_in_memory": True,
    }


class UpdatePriceRequest(BaseModel):
    model_id: str = Field(min_length=1, max_length=200)
    input_cost_per_m: float = Field(ge=0, allow_inf_nan=False)
    output_cost_per_m: float = Field(ge=0, allow_inf_nan=False)
    provider: str | None = Field(default=None, max_length=100)


@base_app.get("/pricing")
@base_app.get("/api/pricing")
def get_pricing() -> dict:
    """Return active model rates and rate change history."""
    try:
        current_rates = pricing_manager.get_current_rates()
        history = pricing_manager.get_rates()
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Pricing is unavailable: the database could not be read.") from exc
    return {
        "current_rates": [r.to_dict() for r in current_rates],
        "history": [r.to_dict() for r in history],
    }


@base_app.post("/pricing")
@base_app.post("/api/pricing")
def update_pricing(payload: UpdatePriceRequest) -> dict:
    """Update pricing for a model effective immediately, leaving past runs unchanged."""
    try:
        rate = pricing_manager.update_rate(
            model_id=payload.model_id,
            input_cost_per_m=payload.input_cost_per_m,
            output_cost_per_m=payload.output_cost_per_m,
            provider=payload.provider,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503, detail="The price couldn't be saved: the database is unavailable."
        ) from exc
    return {"status": "success", "rate": rate.to_dict()}


@base_app.get("/costs")
@base_app.get("/api/costs")
def get_costs() -> dict:
    """Return aggregated token and cost breakdown per model, provider, and day.

    Sync on purpose: the database read runs in FastAPI's threadpool instead of
    blocking the event loop.
    """
    try:
        return compute_cost_breakdown()
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503, detail="Cost data is unavailable: the database could not be read."
        ) from exc


agent_os = AgentOS(
    base_app=base_app,
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
