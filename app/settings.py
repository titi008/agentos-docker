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


def default_model() -> Any:
    """Fresh model instance per agent — supports Anthropic, Gemini, or OpenAI."""
    provider = getenv("MODEL_PROVIDER", "").lower()
    if not provider:
        if getenv("ANTHROPIC_API_KEY"):
            provider = "anthropic"
        elif getenv("GEMINI_API_KEY"):
            provider = "gemini"
        else:
            provider = "openai"

    if provider == "anthropic":
        model_id = getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5")
        return Claude(id=model_id)
    if provider == "gemini":
        model_id = getenv("GEMINI_MODEL", "gemini-3.8-flash")
        return Gemini(id=model_id)

    model_id = getenv("OPENAI_MODEL", "gpt-6.1-sol")
    return OpenAIResponses(id=model_id)


def manager_model() -> Any:
    """Model for OS Manager and Company Product Manager."""
    return default_model()


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
            Gemini(id="gemini-3.8-flash"),
            Gemini(id="gemini-3.8-live"),
            Gemini(id="gemini-3.1-pro"),
            Gemini(id="gemini-3.0-pro"),
        ]
    )

    # OpenAI latest generation
    models.extend(
        [
            OpenAIResponses(id="gpt-6.1-sol"),
        ]
    )

    return models
