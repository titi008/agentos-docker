"""Unit tests for the model pricing and cost tracking engine."""

import json
import unittest
import uuid
from datetime import datetime
from unittest import mock

from sqlalchemy.exc import OperationalError, SQLAlchemyError

from app.pricing import (
    DEFAULT_PRICE_BOOK,
    PriceRateStore,
    PricingManager,
    RunUsageRow,
    aggregate_costs,
    load_run_usage,
    run_model_usage,
)

# 2026-10-15T00:00:00Z and 2026-10-16T12:00:00Z
OCT_15 = 1_792_022_400
OCT_16_NOON = 1_792_152_000


class TestPricingManager(unittest.TestCase):
    def setUp(self) -> None:
        self.manager = PricingManager()

    def test_default_rates_loaded(self) -> None:
        rates = self.manager.get_current_rates()
        model_ids = {r.model_id for r in rates}
        self.assertIn("claude-sonnet-5-5", model_ids)
        self.assertIn("gemini-3.8-flash", model_ids)
        self.assertIn("gpt-6.1-sol", model_ids)

    def test_cost_calculation(self) -> None:
        # gemini-3.8-flash default: 0.75 in / 3.75 out per 1M tokens
        cost = self.manager.calculate_cost(
            model_id="gemini-3.8-flash",
            input_tokens=1_000_000,
            output_tokens=100_000,
            timestamp_iso="2026-10-01T00:00:00Z",
        )
        # Expected: 0.75 + (0.1 * 3.75) = 0.75 + 0.375 = 1.125
        self.assertAlmostEqual(cost, 1.125, places=4)

    def test_effective_dating_immutability(self) -> None:
        """Verify that updating a price never alters calculations for past runs."""
        # 1. Past run on Oct 10
        past_cost = self.manager.calculate_cost(
            model_id="claude-sonnet-5-5",
            input_tokens=1_000_000,
            output_tokens=0,
            timestamp_iso="2026-10-10T12:00:00Z",
        )
        self.assertEqual(past_cost, 2.00)

        # 2. Update rate on Nov 4
        self.manager.update_rate(
            model_id="claude-sonnet-5-5",
            input_cost_per_m=3.50,
            output_cost_per_m=15.00,
        )

        # 3. Recalculate past run on Oct 10 - must strictly remain 2.00
        recalculated_past = self.manager.calculate_cost(
            model_id="claude-sonnet-5-5",
            input_tokens=1_000_000,
            output_tokens=0,
            timestamp_iso="2026-10-10T12:00:00Z",
        )
        self.assertEqual(recalculated_past, 2.00)

        # 4. New run after update - must use new rate 3.50
        future_cost = self.manager.calculate_cost(
            model_id="claude-sonnet-5-5",
            input_tokens=1_000_000,
            output_tokens=0,
            timestamp_iso="2099-01-01T00:00:00Z",
        )
        self.assertEqual(future_cost, 3.50)


def _details(*models: tuple[str, str, str, int, int]) -> dict:
    """agno RunMetrics.details: {model_type: [{id, provider, tokens…}]}."""
    details: dict[str, list[dict]] = {}
    for model_type, model_id, provider, input_tokens, output_tokens in models:
        details.setdefault(model_type, []).append(
            {
                "id": model_id,
                "provider": provider,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": input_tokens + output_tokens,
            }
        )
    return details


class TestCostAggregation(unittest.TestCase):
    def setUp(self) -> None:
        self.manager = PricingManager()

    def test_breakdown_schema_without_runs(self) -> None:
        breakdown = aggregate_costs([], self.manager)
        for key in (
            "total_cost",
            "total_runs",
            "total_tokens",
            "total_input_tokens",
            "total_output_tokens",
            "by_provider",
            "by_model",
            "daily_history",
            "rates",
        ):
            self.assertIn(key, breakdown)
        self.assertEqual(breakdown["total_runs"], 0)
        self.assertEqual(breakdown["total_cost"], 0)
        # Priced models are listed before their first run.
        self.assertIn("claude-sonnet-5-5", {m["model_id"] for m in breakdown["by_model"]})

    def test_details_split_cost_per_model(self) -> None:
        """A run that used a main and an output model is charged for each at its own rate."""
        row = RunUsageRow(
            model="claude-sonnet-5-5",
            model_provider="Anthropic",
            metrics={
                "input_tokens": 1_100_000,
                "output_tokens": 200_000,
                "total_tokens": 1_300_000,
                "details": _details(
                    ("model", "claude-sonnet-5-5", "Anthropic", 1_000_000, 100_000),
                    ("output_model", "gemini-3.8-flash", "Google", 100_000, 100_000),
                ),
            },
            created_at=OCT_15,
        )
        breakdown = aggregate_costs([row], self.manager)
        by_model = {m["model_id"]: m for m in breakdown["by_model"]}
        # Sonnet: 2.00 + 0.1 * 10.00 = 3.00; Flash: 0.1 * 0.75 + 0.1 * 3.75 = 0.45
        self.assertAlmostEqual(by_model["claude-sonnet-5-5"]["total_cost"], 3.0, places=6)
        self.assertAlmostEqual(by_model["gemini-3.8-flash"]["total_cost"], 0.45, places=6)
        self.assertAlmostEqual(breakdown["total_cost"], 3.45, places=4)
        self.assertEqual(breakdown["total_input_tokens"], 1_100_000)
        self.assertEqual(breakdown["total_output_tokens"], 200_000)
        self.assertEqual(breakdown["total_runs"], 1)
        self.assertEqual(by_model["claude-sonnet-5-5"]["runs"], 1)
        providers = {p["provider"]: p for p in breakdown["by_provider"]}
        self.assertAlmostEqual(providers["Anthropic"]["percentage"], 87.0, places=1)

    def test_run_totals_used_when_details_missing(self) -> None:
        row = RunUsageRow(
            model="gpt-6.1-sol",
            model_provider=None,
            metrics={"input_tokens": 2_000_000, "output_tokens": 0},
            created_at=OCT_15,
        )
        usage = run_model_usage(row)
        self.assertEqual(len(usage), 1)
        self.assertEqual(usage[0].model_id, "gpt-6.1-sol")
        self.assertEqual(usage[0].provider, "OpenAI")
        self.assertEqual(usage[0].total_tokens, 2_000_000)
        self.assertAlmostEqual(aggregate_costs([row], self.manager)["total_cost"], 3.0, places=4)

    def test_team_member_runs_count_tokens_not_runs(self) -> None:
        leader = RunUsageRow(
            model="claude-sonnet-5-5",
            model_provider="Anthropic",
            metrics={"details": _details(("model", "claude-sonnet-5-5", "Anthropic", 1_000, 500))},
            created_at=OCT_15,
        )
        member = RunUsageRow(
            model="claude-haiku-5-5",
            model_provider="Anthropic",
            metrics={"details": _details(("model", "claude-haiku-5-5", "Anthropic", 4_000, 1_000))},
            created_at=OCT_15,
            parent_run_id="leader-run",
        )
        breakdown = aggregate_costs([leader, member], self.manager)
        self.assertEqual(breakdown["total_runs"], 1)
        self.assertEqual(breakdown["total_tokens"], 6_500)
        by_model = {m["model_id"]: m for m in breakdown["by_model"]}
        self.assertEqual(by_model["claude-haiku-5-5"]["runs"], 1)
        providers = {p["provider"]: p for p in breakdown["by_provider"]}
        self.assertEqual(providers["Anthropic"]["runs"], 2)
        self.assertEqual(breakdown["daily_history"][0]["runs"], 1)

    def test_workflow_usage_comes_from_steps(self) -> None:
        row = RunUsageRow(
            model=None,
            model_provider=None,
            metrics={
                "duration": 3.2,
                "steps": {
                    "research": {
                        "step_name": "research",
                        "executor_type": "agent",
                        "executor_name": "Market Researcher",
                        "metrics": {"details": _details(("model", "gemini-3.8-flash", "Google", 1_000_000, 0))},
                    },
                    "write": {
                        "step_name": "write",
                        "executor_type": "agent",
                        "executor_name": "Content Strategist",
                        "metrics": {"details": _details(("model", "claude-haiku-5-5", "Anthropic", 0, 1_000_000))},
                    },
                    "format": {"step_name": "format", "executor_type": "function", "metrics": None},
                },
            },
            created_at=OCT_15,
        )
        breakdown = aggregate_costs([row], self.manager)
        # Flash input 0.75 + Haiku output 0.50
        self.assertAlmostEqual(breakdown["total_cost"], 1.25, places=4)
        self.assertEqual(breakdown["total_runs"], 1)

    def test_rates_are_effective_dated_per_run(self) -> None:
        self.manager.update_rate("claude-sonnet-5-5", input_cost_per_m=3.5, output_cost_per_m=15.0)
        past = RunUsageRow(
            model="claude-sonnet-5-5",
            model_provider="Anthropic",
            metrics={"input_tokens": 1_000_000, "output_tokens": 0},
            created_at=OCT_15,
        )
        self.assertAlmostEqual(aggregate_costs([past], self.manager)["total_cost"], 2.0, places=4)

    def test_daily_history_buckets_by_utc_day(self) -> None:
        rows = [
            RunUsageRow("claude-haiku-5-5", "Anthropic", {"input_tokens": 10, "output_tokens": 5}, OCT_15),
            RunUsageRow("claude-haiku-5-5", "Anthropic", {"input_tokens": 20, "output_tokens": 5}, OCT_16_NOON),
            # Legacy rows: string timestamps and JSON-encoded metrics.
            RunUsageRow(
                "claude-haiku-5-5", "Anthropic", json.dumps({"input_tokens": 1, "output_tokens": 1}), str(OCT_16_NOON)
            ),
        ]
        history = aggregate_costs(rows, self.manager)["daily_history"]
        self.assertEqual([day["date"] for day in history], ["2026-10-16", "2026-10-15"])
        self.assertEqual(history[0]["runs"], 2)
        self.assertEqual(history[0]["total_tokens"], 27)

    def test_unusable_metrics_are_ignored(self) -> None:
        rows = [
            RunUsageRow("claude-haiku-5-5", "Anthropic", None, OCT_15),
            RunUsageRow("claude-haiku-5-5", "Anthropic", "not json", OCT_15),
            RunUsageRow("claude-haiku-5-5", "Anthropic", {"input_tokens": "oops", "output_tokens": -5}, OCT_15),
        ]
        breakdown = aggregate_costs(rows, self.manager)
        self.assertEqual(breakdown["total_tokens"], 0)
        self.assertEqual(breakdown["total_runs"], 3)


class TestLoadRunUsage(unittest.TestCase):
    """Reads runs stored by agno itself, in a throwaway schema of the local database."""

    def setUp(self) -> None:
        from agno.db.postgres import PostgresDb
        from sqlalchemy import text
        from sqlalchemy.exc import OperationalError

        from db.url import db_url

        self.schema = f"cost_test_{uuid.uuid4().hex[:10]}"
        self.db = PostgresDb(id=f"cost-test-{self.schema}", db_url=db_url, db_schema=self.schema)
        self.text = text
        try:
            with self.db.db_engine.connect() as conn:
                conn.execute(text("select 1"))
        except OperationalError as exc:
            self.skipTest(f"PostgreSQL is not reachable: {exc}")

    def tearDown(self) -> None:
        with self.db.db_engine.begin() as conn:
            conn.execute(self.text(f'DROP SCHEMA IF EXISTS "{self.schema}" CASCADE'))
        self.db.db_engine.dispose()

    def test_reads_runs_table_and_legacy_runs(self) -> None:
        from agno.metrics import ModelMetrics, RunMetrics
        from agno.run.agent import RunOutput
        from agno.run.team import TeamRunOutput
        from agno.session import AgentSession, TeamSession

        # A database without the tables yet has no runs.
        self.assertEqual(load_run_usage(self.db), [])

        def metrics(model_id: str, provider: str, input_tokens: int, output_tokens: int) -> RunMetrics:
            return RunMetrics(
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=input_tokens + output_tokens,
                details={
                    "model": [
                        ModelMetrics(
                            id=model_id,
                            provider=provider,
                            input_tokens=input_tokens,
                            output_tokens=output_tokens,
                            total_tokens=input_tokens + output_tokens,
                        )
                    ]
                },
            )

        agent_session = AgentSession(
            session_id="agent-session",
            agent_id="content-strategist",
            user_id="default",
            created_at=OCT_15,
            runs=[
                RunOutput(
                    run_id="agent-run",
                    agent_id="content-strategist",
                    session_id="agent-session",
                    model="claude-sonnet-5-5",
                    model_provider="Anthropic",
                    metrics=metrics("claude-sonnet-5-5", "Anthropic", 1_000_000, 100_000),
                    created_at=OCT_15,
                )
            ],
        )
        team_session = TeamSession(
            session_id="team-session",
            team_id="solo-chief-of-staff",
            user_id="default",
            created_at=OCT_16_NOON,
            runs=[
                TeamRunOutput(
                    run_id="team-run",
                    team_id="solo-chief-of-staff",
                    session_id="team-session",
                    model="claude-sonnet-5-5",
                    model_provider="Anthropic",
                    metrics=metrics("claude-sonnet-5-5", "Anthropic", 10_000, 1_000),
                    created_at=OCT_16_NOON,
                ),
                RunOutput(
                    run_id="member-run",
                    agent_id="market-researcher",
                    session_id="team-session",
                    parent_run_id="team-run",
                    model="gemini-3.8-flash",
                    model_provider="Google",
                    metrics=metrics("gemini-3.8-flash", "Google", 100_000, 0),
                    created_at=OCT_16_NOON,
                ),
            ],
        )
        # agno 3.1 writes the session row and its runs separately, as a running agent does.
        for session in (agent_session, team_session):
            self.db.upsert_session(session)
            for run_index, run in enumerate(session.runs or []):
                self.db.upsert_run(run, session_id=session.session_id, user_id=session.user_id, run_index=run_index)

        # A session written by agno 2.x and never migrated keeps its runs in the sessions table.
        sessions_table = f'"{self.schema}"."{self.db.session_table_name}"'
        legacy_runs = [
            {
                "run_id": "legacy-run",
                "model": "gpt-6.1-sol",
                "model_provider": "OpenAI",
                "metrics": {"input_tokens": 1_000_000, "output_tokens": 0, "total_tokens": 1_000_000},
                "created_at": OCT_15,
            }
        ]
        with self.db.db_engine.begin() as conn:
            conn.execute(self.text(f"ALTER TABLE {sessions_table} ADD COLUMN IF NOT EXISTS runs JSON"))
            conn.execute(
                self.text(
                    f"INSERT INTO {sessions_table} (session_id, session_type, created_at, runs) "
                    "VALUES ('legacy-session', 'agent', :created_at, CAST(:runs AS JSON))"
                ),
                {"created_at": OCT_15, "runs": json.dumps(legacy_runs)},
            )

        rows = load_run_usage(self.db)
        self.assertEqual(len(rows), 4)

        breakdown = aggregate_costs(rows, PricingManager())
        self.assertEqual(breakdown["total_runs"], 3)  # agent, team and legacy runs; the member run is the team's
        self.assertEqual(breakdown["total_input_tokens"], 2_110_000)
        # Sonnet 2.00 + 1.00 (agent) + 0.02 + 0.01 (team leader), Flash 0.075 (member), GPT 1.50 (legacy)
        self.assertAlmostEqual(breakdown["total_cost"], 4.605, places=4)


class TestPriceRateStore(unittest.TestCase):
    """Price changes are saved in PostgreSQL, in a throwaway schema of the local database."""

    def setUp(self) -> None:
        from agno.db.postgres import PostgresDb
        from sqlalchemy import text

        from db.url import db_url

        self.schema = f"price_test_{uuid.uuid4().hex[:10]}"
        self.db = PostgresDb(id=f"price-test-{self.schema}", db_url=db_url, db_schema=self.schema)
        self.text = text
        try:
            with self.db.db_engine.connect() as conn:
                conn.execute(text("select 1"))
        except OperationalError as exc:
            self.skipTest(f"PostgreSQL is not reachable: {exc}")

    def tearDown(self) -> None:
        with self.db.db_engine.begin() as conn:
            conn.execute(self.text(f'DROP SCHEMA IF EXISTS "{self.schema}" CASCADE'))
        self.db.db_engine.dispose()

    def test_changes_survive_a_restart(self) -> None:
        manager = PricingManager(store=PriceRateStore(self.db))
        self.assertEqual(len(manager.get_rates()), len(DEFAULT_PRICE_BOOK))
        rate = manager.update_rate("claude-sonnet-5-5", input_cost_per_m=3.5, output_cost_per_m=15.0)

        # A new manager and store stand in for the API after a redeploy.
        restarted = PricingManager(store=PriceRateStore(self.db))
        history = restarted.get_rates()
        self.assertEqual(len(history), len(DEFAULT_PRICE_BOOK) + 1)
        saved = history[-1]
        self.assertEqual(
            (saved.model_id, saved.provider, saved.input_cost_per_m, saved.output_cost_per_m),
            ("claude-sonnet-5-5", "Anthropic", 3.5, 15.0),
        )
        self.assertEqual(datetime.fromisoformat(saved.effective_from), datetime.fromisoformat(rate.effective_from))
        current = {r.model_id: r for r in restarted.get_current_rates()}
        self.assertEqual(current["claude-sonnet-5-5"].input_cost_per_m, 3.5)
        # Runs before the change keep the old price.
        past = restarted.calculate_cost("claude-sonnet-5-5", 1_000_000, 0, "2026-10-10T12:00:00Z")
        self.assertEqual(past, 2.0)

    def test_failed_save_changes_nothing(self) -> None:
        store = PriceRateStore(self.db)
        manager = PricingManager(store=store)
        failure = OperationalError("INSERT", {}, Exception("database is down"))
        with mock.patch.object(store, "add", side_effect=failure), self.assertRaises(SQLAlchemyError):
            manager.update_rate("claude-sonnet-5-5", input_cost_per_m=3.5, output_cost_per_m=15.0)
        self.assertEqual(len(manager.get_rates()), len(DEFAULT_PRICE_BOOK))
        self.assertEqual(len(PricingManager(store=PriceRateStore(self.db)).get_rates()), len(DEFAULT_PRICE_BOOK))


if __name__ == "__main__":
    unittest.main()
