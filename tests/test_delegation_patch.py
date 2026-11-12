"""
Tests for Framework Patches
===========================
"""

import unittest
from types import SimpleNamespace
from unittest import mock

from agno.run.agent import IntermediateRunContentEvent, RunContentEvent
from agno.run.base import RunStatus
from agno.run.team import RunContentEvent as TeamRunContentEvent

from app.patches import _patch_intermediate_run_content_event_hierarchy, _resolve_fallback_and_log, apply_patches


class TestDelegationPatch(unittest.TestCase):
    def setUp(self) -> None:
        apply_patches()

    def test_intermediate_run_content_event_subclass(self) -> None:
        _patch_intermediate_run_content_event_hierarchy()
        self.assertTrue(issubclass(IntermediateRunContentEvent, RunContentEvent))

        event = IntermediateRunContentEvent(content="Research results")
        self.assertIsInstance(event, (RunContentEvent, TeamRunContentEvent))

    def test_simulated_model_accumulation(self) -> None:
        events = [
            IntermediateRunContentEvent(content="Paragraph 1. "),
            IntermediateRunContentEvent(content="Paragraph 2."),
        ]
        function_call_output = ""
        for item in events:
            if isinstance(item, (RunContentEvent, TeamRunContentEvent)):
                function_call_output += item.content or ""

        self.assertEqual(function_call_output, "Paragraph 1. Paragraph 2.")

    def test_resolve_fallback_on_error_status(self) -> None:
        member_run = SimpleNamespace(
            status=RunStatus.error,
            content="API rate limit exceeded",
            tools=[],
        )
        run_response = SimpleNamespace(member_runs=[member_run])

        with mock.patch("app.patches.log_error") as mock_log:
            result = _resolve_fallback_and_log("team-1", "market-researcher", "Research task", run_response)
            mock_log.assert_called_once()
            self.assertIn("API rate limit exceeded", result or "")

    def test_resolve_fallback_with_tool_calls_and_no_summary(self) -> None:
        tool_mock = SimpleNamespace(tool_name="web_search", result="US Tax Treaty details")
        member_run = SimpleNamespace(
            status=RunStatus.completed,
            content="",
            tools=[tool_mock],
        )
        run_response = SimpleNamespace(member_runs=[member_run])

        with mock.patch("app.patches.log_warning") as mock_log:
            result = _resolve_fallback_and_log("team-1", "market-researcher", "Research task", run_response)
            mock_log.assert_called_once()
            self.assertIn("web_search", result or "")
            self.assertIn("US Tax Treaty details", result or "")

    def test_resolve_fallback_with_no_tools_and_no_content(self) -> None:
        member_run = SimpleNamespace(
            status=RunStatus.completed,
            content="",
            tools=[],
        )
        run_response = SimpleNamespace(member_runs=[member_run])

        with mock.patch("app.patches.log_warning") as mock_log:
            result = _resolve_fallback_and_log("team-1", "market-researcher", "Research task", run_response)
            mock_log.assert_called_once()
            self.assertIn("empty response", result or "")


if __name__ == "__main__":
    unittest.main()
