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

    def test_update_team_model_endpoint(self) -> None:
        # POST /api/teams/{team_id}/model
        res = self.client.post(
            "/api/teams/solo-chief-of-staff/model",
            json={"model_id": "claude-sonnet-5-5"},
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["team_id"], "solo-chief-of-staff")
        self.assertEqual(data["model_id"], "claude-sonnet-5-5")

        # Fallback alias /teams/{team_id}/model
        res_alias = self.client.post(
            "/teams/solo-chief-of-staff/model",
            json={"model_id": "claude-sonnet-5-5"},
        )
        self.assertEqual(res_alias.status_code, 200)

        # PATCH method
        res_patch = self.client.patch(
            "/api/teams/solo-chief-of-staff/model",
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

    def test_company_product_project_task_flow(self) -> None:
        import uuid

        test_suffix = uuid.uuid4().hex[:6]
        prod_name = f"Test Product {test_suffix}"

        # 1. Create Product
        res_prod = self.client.post(
            "/company/products",
            json={"name": prod_name, "purpose": "Testing product & team association"},
        )
        self.assertEqual(res_prod.status_code, 201)
        prod_data = res_prod.json()
        prod_id = prod_data["id"]
        self.assertEqual(prod_data["name"], prod_name)

        # 2. Create Project under Product
        proj_name = f"Test Project {test_suffix}"
        res_proj = self.client.post(
            "/company/projects",
            json={"product_id": prod_id, "name": proj_name, "outcome": "Deliver test artifact"},
        )
        self.assertEqual(res_proj.status_code, 201)
        proj_data = res_proj.json()
        proj_id = proj_data["id"]
        self.assertEqual(proj_data["product_id"], prod_id)

        # 3. Create Task with Team assignment
        res_task = self.client.post(
            "/company/tasks",
            json={
                "product_id": prod_id,
                "project_id": proj_id,
                "title": f"Execute team task {test_suffix}",
                "brief": "Delegate this task to solo operations team",
                "executor_type": "team",
                "executor_id": "solo-chief-of-staff",
                "status": "backlog",
            },
        )
        self.assertEqual(res_task.status_code, 201)
        task_data = res_task.json()
        self.assertEqual(task_data["executor_type"], "team")
        self.assertEqual(task_data["executor_id"], "solo-chief-of-staff")
        self.assertEqual(task_data["project_id"], proj_id)
        self.assertEqual(task_data["product_id"], prod_id)


if __name__ == "__main__":
    unittest.main()
