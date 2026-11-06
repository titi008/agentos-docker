"""Model choices for code-defined agents and teams, saved in PostgreSQL."""

import unittest
import uuid
from unittest import mock

from agno.db.postgres import PostgresDb
from agno.models.anthropic import Claude
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.settings import ModelOverrideStore, get_agent_model
from db.url import db_url


class TestModelOverrideStore(unittest.TestCase):
    """Uses a throwaway schema of the local database."""

    def setUp(self) -> None:
        self.schema = f"model_test_{uuid.uuid4().hex[:10]}"
        self.db = PostgresDb(id=f"model-test-{self.schema}", db_url=db_url, db_schema=self.schema)
        try:
            with self.db.db_engine.connect() as conn:
                conn.execute(text("select 1"))
        except OperationalError as exc:
            self.skipTest(f"PostgreSQL is not reachable: {exc}")

    def tearDown(self) -> None:
        with self.db.db_engine.begin() as conn:
            conn.execute(text(f'DROP SCHEMA IF EXISTS "{self.schema}" CASCADE'))
        self.db.db_engine.dispose()

    def test_choices_survive_a_restart(self) -> None:
        store = ModelOverrideStore(self.db)
        self.assertEqual(store.load(), {})

        store.save("market-researcher", "claude-haiku-5-5")
        store.save("market-researcher", "claude-opus-5-5")
        store.save("solo-chief-of-staff", "gemini-4-argon")
        expected = {"market-researcher": "claude-opus-5-5", "solo-chief-of-staff": "gemini-4-argon"}
        self.assertEqual(store.load(), expected)

        # A new store stands in for the API after a redeploy.
        self.assertEqual(ModelOverrideStore(self.db).load(), expected)


class TestGetAgentModel(unittest.TestCase):
    def test_uses_the_saved_model(self) -> None:
        with mock.patch("app.settings.get_agent_model_overrides", return_value={"tech-specialist": "claude-opus-5-5"}):
            model = get_agent_model("tech-specialist", lambda: None)
        self.assertIsInstance(model, Claude)
        self.assertEqual(model.id, "claude-opus-5-5")

    def test_falls_back_to_the_default(self) -> None:
        default = object()
        with mock.patch("app.settings.get_agent_model_overrides", return_value={}):
            self.assertIs(get_agent_model("tech-specialist", lambda: default), default)

        failure = OperationalError("SELECT", {}, Exception("database is down"))
        with mock.patch("app.settings.get_agent_model_overrides", side_effect=failure):
            self.assertIs(get_agent_model("tech-specialist", lambda: default), default)


if __name__ == "__main__":
    unittest.main()
