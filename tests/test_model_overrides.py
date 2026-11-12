"""Model choices for code-defined agents and teams, saved in PostgreSQL."""

import unittest
import uuid
from types import SimpleNamespace
from unittest import mock

from agno.db.postgres import PostgresDb
from agno.models.anthropic import Claude
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.settings import ModelOverrideStore, chat_model_state, get_agent_model, model_override_hook
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


class TestChatModelState(unittest.TestCase):
    def test_records_the_chat_target(self) -> None:
        expected = {"model_override": "claude-opus-5-5", "model_override_for": "solo-chief-of-staff"}
        self.assertEqual(chat_model_state("/teams/solo-chief-of-staff/runs", " claude-opus-5-5 "), expected)
        self.assertEqual(
            chat_model_state("/agents/market-researcher/runs/", "claude-opus-5-5"),
            {"model_override": "claude-opus-5-5", "model_override_for": "market-researcher"},
        )
        self.assertEqual(
            chat_model_state("/agents/market-researcher/runs/run-1/continue", "claude-opus-5-5"),
            {"model_override": "claude-opus-5-5", "model_override_for": "market-researcher"},
        )

    def test_ignores_other_requests(self) -> None:
        for path in ("/agents/market-researcher", "/workflows/flow/runs", "/api/models", "/teams//runs"):
            self.assertIsNone(chat_model_state(path, "claude-opus-5-5"), path)
        self.assertIsNone(chat_model_state("/teams/solo-chief-of-staff/runs", "  "))
        self.assertIsNone(chat_model_state("/teams/solo-chief-of-staff/runs", None))


class TestModelOverrideHook(unittest.TestCase):
    """A model picked in a chat applies to the chat's agent or team, not to delegated members."""

    def setUp(self) -> None:
        self.default = object()
        patcher = mock.patch("app.settings.model_from_id", side_effect=lambda model_id: f"model:{model_id}")
        patcher.start()
        self.addCleanup(patcher.stop)

    def run_hook(self, target_id: str, session_state: dict | None = None, metadata: dict | None = None) -> object:
        target = SimpleNamespace(id=target_id, model=self.default)
        model_override_hook(run_context=SimpleNamespace(session_state=session_state, metadata=metadata), agent=target)
        return target.model

    def test_applies_to_the_chat_target(self) -> None:
        state = {"model_override": "claude-opus-5-5", "model_override_for": "solo-chief-of-staff"}
        self.assertEqual(self.run_hook("solo-chief-of-staff", state), "model:claude-opus-5-5")
        self.assertEqual(self.run_hook("solo-chief-of-staff", metadata=state), "model:claude-opus-5-5")

    def test_delegated_members_keep_their_models(self) -> None:
        # Members receive a copy of the team's session state.
        state = {"model_override": "claude-opus-5-5", "model_override_for": "solo-chief-of-staff"}
        self.assertIs(self.run_hook("market-researcher", dict(state)), self.default)

    def test_ignores_a_choice_without_a_target(self) -> None:
        self.assertIs(self.run_hook("solo-chief-of-staff", {"model_override": "claude-opus-5-5"}), self.default)
        self.assertIs(self.run_hook("solo-chief-of-staff", {}), self.default)
        self.assertIs(self.run_hook("solo-chief-of-staff"), self.default)


if __name__ == "__main__":
    unittest.main()
