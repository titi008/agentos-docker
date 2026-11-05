"""Unit tests for knowledge embedder resolution and configuration."""

import os
import unittest
from unittest.mock import patch

from agno.knowledge.embedder.google import GeminiEmbedder
from agno.knowledge.embedder.openai import OpenAIEmbedder
from agno.vectordb.pgvector import PgVector

from db import _get_default_embedder, create_knowledge


class TestEmbedder(unittest.TestCase):
    def test_default_embedder_defaults_to_gemini_embedding_2(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            embedder = _get_default_embedder()
            self.assertIsInstance(embedder, GeminiEmbedder)
            assert isinstance(embedder, GeminiEmbedder)
            self.assertEqual(embedder.id, "gemini-embedding-2")
            self.assertEqual(embedder.dimensions, 1536)
            self.assertEqual(embedder.task_type, "")

    def test_embedder_with_gemini_api_key(self) -> None:
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-gemini-key"}, clear=True):
            embedder = _get_default_embedder()
            self.assertIsInstance(embedder, GeminiEmbedder)
            assert isinstance(embedder, GeminiEmbedder)
            self.assertEqual(embedder.id, "gemini-embedding-2")
            self.assertEqual(embedder.api_key, "test-gemini-key")
            self.assertEqual(embedder.dimensions, 1536)

    def test_embedder_with_google_api_key(self) -> None:
        with patch.dict(os.environ, {"GOOGLE_API_KEY": "test-google-key"}, clear=True):
            embedder = _get_default_embedder()
            self.assertIsInstance(embedder, GeminiEmbedder)
            assert isinstance(embedder, GeminiEmbedder)
            self.assertEqual(embedder.id, "gemini-embedding-2")
            self.assertEqual(embedder.api_key, "test-google-key")

    def test_embedder_with_explicit_gemini_model_override(self) -> None:
        with patch.dict(
            os.environ,
            {"GEMINI_API_KEY": "test-key", "GEMINI_EMBEDDING_MODEL": "custom-gemini-embed"},
            clear=True,
        ):
            embedder = _get_default_embedder()
            self.assertIsInstance(embedder, GeminiEmbedder)
            assert isinstance(embedder, GeminiEmbedder)
            self.assertEqual(embedder.id, "custom-gemini-embed")

    def test_embedder_with_openai_provider_or_key(self) -> None:
        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-openai-key"}, clear=True):
            embedder = _get_default_embedder()
            self.assertIsInstance(embedder, OpenAIEmbedder)
            assert isinstance(embedder, OpenAIEmbedder)
            self.assertEqual(embedder.id, "text-embedding-3-small")

        with patch.dict(
            os.environ,
            {"EMBEDDER_PROVIDER": "openai", "GEMINI_API_KEY": "test-gemini-key"},
            clear=True,
        ):
            embedder = _get_default_embedder()
            self.assertIsInstance(embedder, OpenAIEmbedder)
            assert isinstance(embedder, OpenAIEmbedder)
            self.assertEqual(embedder.id, "text-embedding-3-small")

    def test_create_knowledge_uses_configured_embedder(self) -> None:
        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-gemini-key"}, clear=True):
            knowledge = create_knowledge("test-knowledge", "test_knowledge_table")
            self.assertEqual(knowledge.name, "test-knowledge")
            self.assertIsInstance(knowledge.vector_db, PgVector)
            assert isinstance(knowledge.vector_db, PgVector)
            self.assertIsInstance(knowledge.vector_db.embedder, GeminiEmbedder)
            self.assertEqual(knowledge.vector_db.dimensions, 1536)
