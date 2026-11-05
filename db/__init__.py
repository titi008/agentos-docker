"""Shared PostgreSQL storage and knowledge creation."""

from functools import cache
from os import getenv

from agno.db.postgres import PostgresDb
from agno.knowledge import Knowledge
from agno.knowledge.embedder.base import Embedder
from agno.knowledge.embedder.google import GeminiEmbedder
from agno.knowledge.embedder.openai import OpenAIEmbedder
from agno.vectordb.pgvector import PgVector, SearchType

from db.url import db_url

__all__ = ["create_knowledge", "db_url", "get_postgres_db"]

DB_ID = "agentos-db"


@cache
def get_postgres_db() -> PostgresDb:
    """Return the shared database for AgentOS and its components."""
    return PostgresDb(id=DB_ID, db_url=db_url)


def _get_default_embedder() -> Embedder:
    """Resolve embedder based on configured environment variables and credentials."""
    provider = getenv("EMBEDDER_PROVIDER", "").strip().lower()
    gemini_key = getenv("GEMINI_API_KEY") or getenv("GOOGLE_API_KEY")
    openai_key = getenv("OPENAI_API_KEY")

    if provider == "openai":
        return OpenAIEmbedder(id=getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"))

    if provider == "gemini" or gemini_key:
        return GeminiEmbedder(
            id=getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-2"),
            dimensions=1536,
            task_type="",
            api_key=gemini_key,
        )

    if openai_key:
        return OpenAIEmbedder(id=getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"))

    return GeminiEmbedder(
        id=getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-2"),
        dimensions=1536,
        task_type="",
        api_key=gemini_key,
    )


def create_knowledge(name: str, table_name: str) -> Knowledge:
    """Create hybrid-search knowledge with its own content adapter."""
    contents_table = f"{table_name}_contents"
    return Knowledge(
        name=name,
        vector_db=PgVector(
            db_url=db_url,
            table_name=table_name,
            search_type=SearchType.hybrid,
            embedder=_get_default_embedder(),
        ),
        contents_db=PostgresDb(
            id=f"{DB_ID}-{contents_table}",
            db_url=db_url,
            knowledge_table=contents_table,
        ),
    )
