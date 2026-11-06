"""
App Settings
============

Shared runtime objects for the platform.
"""

from functools import cache
from os import getenv
from typing import Any

from agno.db.postgres import PostgresDb
from agno.models.anthropic import Claude
from agno.models.google import Gemini
from agno.models.openai import OpenAIResponses
from agno.utils.log import log_error
from sqlalchemy import Column, Connection, DateTime, MetaData, String, Table, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import SQLAlchemyError

from db import get_postgres_db
from db.tables import ensure_table

MODEL_OVERRIDES_TABLE = "app_model_overrides"


def model_from_id(model_id: str) -> Any:
    """Instantiate a model instance matching the model ID."""
    mid = model_id.lower()
    if any(k in mid for k in ("claude", "anthropic", "sonnet", "opus", "haiku")):
        return Claude(id=model_id)
    if any(k in mid for k in ("gemini", "argon", "flash", "live")):
        return Gemini(id=model_id)
    return OpenAIResponses(id=model_id)


class ModelOverrideStore:
    """Models chosen in Studio for code-defined agents and teams.

    Kept in the shared PostgreSQL database, so restarts and redeploys keep them.
    """

    def __init__(self, db: PostgresDb) -> None:
        self._engine = db.db_engine
        self._table = Table(
            MODEL_OVERRIDES_TABLE,
            MetaData(schema=db.db_schema),
            Column("component_id", String, primary_key=True),
            Column("model_id", String, nullable=False),
            Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
        )
        self._table_ready = False
        self._cache: dict[str, str] | None = None

    def _prepare(self, conn: Connection) -> None:
        if not self._table_ready:
            ensure_table(conn, self._table)
            self._table_ready = True

    def load(self) -> dict[str, str]:
        """Return the saved model ID for each agent or team ID."""
        if self._cache is None:
            with self._engine.begin() as conn:
                self._prepare(conn)
                rows = conn.execute(select(self._table.c.component_id, self._table.c.model_id)).all()
            self._cache = {component_id: model_id for component_id, model_id in rows}
        return dict(self._cache)

    def save(self, component_id: str, model_id: str) -> None:
        """Save the model for an agent or team. Raises SQLAlchemyError if the write fails."""
        statement = insert(self._table).values(component_id=component_id, model_id=model_id)
        statement = statement.on_conflict_do_update(
            index_elements=[self._table.c.component_id],
            set_={"model_id": statement.excluded.model_id, "updated_at": func.now()},
        )
        with self._engine.begin() as conn:
            self._prepare(conn)
            conn.execute(statement)
        if self._cache is not None:
            self._cache[component_id] = model_id


@cache
def model_override_store() -> ModelOverrideStore:
    """The store for the shared AgentOS database."""
    return ModelOverrideStore(get_postgres_db())


def get_agent_model_overrides() -> dict[str, str]:
    """Saved model IDs for code-defined agents and teams. Raises SQLAlchemyError if unreadable."""
    return model_override_store().load()


def save_agent_model_override(component_id: str, model_id: str) -> None:
    """Save the model for a code-defined agent or team. Raises SQLAlchemyError if the write fails."""
    model_override_store().save(component_id, model_id)


def get_agent_model(agent_id: str, default_factory: Any) -> Any:
    """Resolve an agent or team model, using the model saved in Studio if there is one."""
    try:
        model_id = get_agent_model_overrides().get(agent_id)
    except SQLAlchemyError as exc:
        log_error(f"Couldn't read saved models, so {agent_id} uses its default model: {exc}")
        model_id = None
    return model_from_id(model_id) if model_id else default_factory()


get_team_model = get_agent_model


def model_override_hook(
    run_context: Any = None,
    agent: Any = None,
    team: Any = None,
    **kwargs: Any,
) -> None:
    """Pre-hook that checks for chat-level model overrides in session_state or metadata."""
    target = agent or team or getattr(run_context, "agent", None) or getattr(run_context, "team", None)
    session_state = getattr(run_context, "session_state", None)
    if isinstance(session_state, dict):
        override = session_state.get("model_override")
        if override and target:
            target.model = model_from_id(override)
            return

    metadata = getattr(run_context, "metadata", None)
    if isinstance(metadata, dict):
        override = metadata.get("model_override")
        if override and target:
            target.model = model_from_id(override)


def _resolve_provider(tier_env_prefix: str = "") -> str:
    """Resolve provider honoring tier override first, then global MODEL_PROVIDER, then detected API keys."""
    if tier_env_prefix:
        override = getenv(f"{tier_env_prefix}_PROVIDER", "").lower()
        if override:
            return override

    provider = getenv("MODEL_PROVIDER", "").lower()
    if provider:
        return provider

    if getenv("ANTHROPIC_API_KEY"):
        return "anthropic"
    if getenv("GEMINI_API_KEY"):
        return "gemini"
    return "openai"


def reasoning_model() -> Any:
    """Tier 1: Frontier reasoning model for Team Leaders, Planners, and Engineers."""
    provider = _resolve_provider("REASONING")
    if provider == "anthropic":
        model_id = getenv("ANTHROPIC_REASONING_MODEL", getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5"))
        return Claude(id=model_id)
    if provider == "gemini":
        model_id = getenv("GEMINI_REASONING_MODEL", getenv("GEMINI_MODEL", "gemini-4-argon"))
        return Gemini(id=model_id)

    model_id = getenv("OPENAI_REASONING_MODEL", getenv("OPENAI_MODEL", "gpt-6.1-sol"))
    return OpenAIResponses(id=model_id)


def fast_model() -> Any:
    """Tier 2: High-throughput, sub-second execution model for workers, scraping, and routine tool use."""
    provider = _resolve_provider("FAST")
    if provider == "gemini":
        model_id = getenv("GEMINI_FAST_MODEL", "gemini-3.8-flash")
        return Gemini(id=model_id)
    if provider == "anthropic":
        model_id = getenv("ANTHROPIC_FAST_MODEL", "claude-haiku-5-5")
        return Claude(id=model_id)

    model_id = getenv("OPENAI_FAST_MODEL", "gpt-6.1-sol")
    return OpenAIResponses(id=model_id)


def default_model() -> Any:
    """Default fallback model instance per agent."""
    return fast_model()


def manager_model() -> Any:
    """Model for OS Manager and Company Product Manager."""
    return reasoning_model()


def get_available_models() -> list[Any]:
    """Palette of models available in the Agno Studio UI dropdown."""
    models: list[Any] = []

    # Anthropic latest generation
    models.extend(
        [
            Claude(id="claude-sonnet-5-5"),
            Claude(id="claude-opus-5-5"),
            Claude(id="claude-haiku-5-5"),
        ]
    )

    # Google Gemini latest generation
    models.extend(
        [
            Gemini(id="gemini-4-argon"),
            Gemini(id="gemini-3.8-flash"),
            Gemini(id="gemini-3.8-live"),
        ]
    )

    # OpenAI latest generation
    models.extend(
        [
            OpenAIResponses(id="gpt-6.1-sol"),
        ]
    )

    return models
