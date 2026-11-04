"""Unit tests for the model pricing and cost tracking engine."""

import tempfile
import unittest
from pathlib import Path

from app.pricing import PricingManager, compute_cost_breakdown


class TestPricingManager(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.storage_file = Path(self.temp_dir.name) / "pricing_history.json"
        self.manager = PricingManager(storage_path=self.storage_file)

    def tearDown(self) -> None:
        self.temp_dir.cleanup()

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

        # 4. New run after update on Nov 5 - must use new rate 3.50
        future_cost = self.manager.calculate_cost(
            model_id="claude-sonnet-5-5",
            input_tokens=1_000_000,
            output_tokens=0,
            timestamp_iso="2026-11-05T00:00:00Z",
        )
        self.assertEqual(future_cost, 3.50)

    def test_compute_cost_breakdown_schema(self) -> None:
        breakdown = compute_cost_breakdown()
        self.assertIn("total_cost", breakdown)
        self.assertIn("total_runs", breakdown)
        self.assertIn("total_tokens", breakdown)
        self.assertIn("by_provider", breakdown)
        self.assertIn("by_model", breakdown)
        self.assertIn("daily_history", breakdown)
        self.assertIn("rates", breakdown)


if __name__ == "__main__":
    unittest.main()
