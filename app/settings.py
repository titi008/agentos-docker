"""
App Settings
============

Shared runtime objects for the platform.
"""

from os import getenv

from agno.models.openai import OpenAIResponses


def default_model() -> OpenAIResponses:
    """Fresh model instance per agent — avoids shared-state footguns."""
    model_id = getenv("OPENAI_MODEL", "gpt-4o")
    return OpenAIResponses(id=model_id)


def manager_model() -> OpenAIResponses:
    """Model for OS Manager and Company Product Manager."""
    model_id = getenv("OPENAI_MODEL", "gpt-4o")
    return OpenAIResponses(id=model_id)
