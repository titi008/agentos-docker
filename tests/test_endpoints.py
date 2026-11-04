"""Unit tests for AgentOS custom endpoints registration and routing."""

import unittest
from typing import ClassVar

from fastapi.testclient import TestClient

from app.main import app


class TestEndpoints(unittest.TestCase):
    client: ClassVar[TestClient]

    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app, base_url="http://127.0.0.1:8000")

    def test_api_models_endpoint(self) -> None:
        res = self.client.get("/api/models")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIsInstance(data, list)
        self.assertTrue(len(data) > 0)
        ids = [m["id"] for m in data]
        self.assertIn("claude-sonnet-5-5", ids)

    def test_update_agent_model_endpoint(self) -> None:
        # POST /api/agents/{agent_id}/model
        res = self.client.post(
            "/api/agents/market-researcher/model",
            json={"model_id": "claude-sonnet-5-5"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["agent_id"], "market-researcher")
        self.assertEqual(data["model_id"], "claude-sonnet-5-5")

        # Fallback alias /agents/{agent_id}/model
        res_alias = self.client.post(
            "/agents/market-researcher/model",
            json={"model_id": "claude-sonnet-5-5"},
        )
        self.assertEqual(res_alias.status_code, 200)

        # PATCH method
        res_patch = self.client.patch(
            "/api/agents/market-researcher/model",
            json={"model_id": "claude-sonnet-5-5"},
        )
        self.assertEqual(res_patch.status_code, 200)

    def test_pricing_endpoints(self) -> None:
        # GET /api/pricing
        res = self.client.get("/api/pricing")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("current_rates", data)
        self.assertIn("history", data)
        self.assertTrue(len(data["current_rates"]) >= 8)

        # GET /pricing alias
        res_alias = self.client.get("/pricing")
        self.assertEqual(res_alias.status_code, 200)

    def test_costs_endpoints(self) -> None:
        # GET /api/costs
        res = self.client.get("/api/costs")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("rates", data)

        # GET /costs alias
        res_alias = self.client.get("/costs")
        self.assertEqual(res_alias.status_code, 200)


if __name__ == "__main__":
    unittest.main()
