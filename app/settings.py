"""
App Settings
============

Shared runtime objects for the platform.
"""

from os import getenv
from typing import Any

from agno.models.anthropic import Claude
from agno.models.google import Gemini
from agno.models.openai import OpenAIResponses


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
