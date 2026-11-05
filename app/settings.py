"""
App Settings
============

Shared runtime objects for the platform.
"""

import json
from os import getenv
from pathlib import Path
from typing import Any

from agno.models.anthropic import Claude
from agno.models.google import Gemini
from agno.models.openai import OpenAIResponses

OVERRIDES_PATH = Path(__file__).resolve().parent.parent / "data" / "agent_model_overrides.json"


def model_from_id(model_id: str) -> Any:
    """Instantiate a model instance matching the model ID."""
    mid = model_id.lower()
    if any(k in mid for k in ("claude", "anthropic", "sonnet", "opus", "haiku")):
        return Claude(id=model_id)
    if any(k in mid for k in ("gemini", "argon", "flash", "live")):
        return Gemini(id=model_id)
    return OpenAIResponses(id=model_id)


def get_agent_model_overrides() -> dict[str, str]:
    """Load persistent model overrides for code-defined agents."""
    if not OVERRIDES_PATH.exists():
        return {}
    try:
        with open(OVERRIDES_PATH, encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def save_agent_model_override(agent_id: str, model_id: str) -> None:
    """Save persistent model override for a code-defined agent."""
    overrides = get_agent_model_overrides()
    overrides[agent_id] = model_id
    try:
        OVERRIDES_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(OVERRIDES_PATH, "w", encoding="utf-8") as f:
            json.dump(overrides, f, indent=2)
    except Exception:
        pass


def get_agent_model(agent_id: str, default_factory: Any) -> Any:
    """Resolve an agent or team model, respecting saved Studio overrides."""
    overrides = get_agent_model_overrides()
    if agent_id in overrides:
        return model_from_id(overrides[agent_id])
    return default_factory()


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
