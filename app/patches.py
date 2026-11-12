"""
Framework Patches
=================
Runtime fixes and defensive enhancements for Agno integration.
"""

from collections.abc import AsyncIterator, Iterator
from functools import wraps
from typing import Any

import agno.team._default_tools as _default_tools
import agno.team._tools as _team_tools
from agno.run.agent import IntermediateRunContentEvent, RunContentEvent
from agno.run.base import RunStatus
from agno.tools.function import Function
from agno.utils.log import log_error, log_warning


def apply_patches() -> None:
    """Apply framework-level runtime patches."""
    _patch_intermediate_run_content_event_hierarchy()
    _patch_team_delegation_error_handling()


def _patch_intermediate_run_content_event_hierarchy() -> None:
    """Ensure IntermediateRunContentEvent inherits from RunContentEvent.

    In Agno streaming mode (stream_events=True), delegated member output is emitted as
    IntermediateRunContentEvent. Agno's model tool runner (models/base.py) only accumulates
    events matching isinstance(item, (RunContentEvent, TeamRunContentEvent)). Without this
    inheritance, streamed member responses are dropped, resulting in empty delegation results.
    """
    if not issubclass(IntermediateRunContentEvent, RunContentEvent):
        IntermediateRunContentEvent.__bases__ = (RunContentEvent,)


def _patch_team_delegation_error_handling() -> None:
    """Wrap team delegation tool generation with structured logging and fallback handling."""
    orig_get_delegate_task = _default_tools._get_delegate_task_function

    if getattr(orig_get_delegate_task, "_is_patched", False):
        return

    @wraps(orig_get_delegate_task)
    def patched_get_delegate_task_function(
        team: Any,
        run_response: Any,
        run_context: Any,
        session: Any,
        team_run_context: dict[str, Any],
        user_id: str | None = None,
        stream: bool = False,
        stream_events: bool = False,
        async_mode: bool = False,
        input: str | None = None,
        images: list[Any] | None = None,
        videos: list[Any] | None = None,
        audio: list[Any] | None = None,
        files: list[Any] | None = None,
        add_history_to_context: bool | None = None,
        add_dependencies_to_context: bool | None = None,
        add_session_state_to_context: bool | None = None,
        debug_mode: bool | None = None,
    ) -> Function:
        delegate_func = orig_get_delegate_task(
            team=team,
            run_response=run_response,
            run_context=run_context,
            session=session,
            team_run_context=team_run_context,
            user_id=user_id,
            stream=stream,
            stream_events=stream_events,
            async_mode=async_mode,
            input=input,
            images=images,
            videos=videos,
            audio=audio,
            files=files,
            add_history_to_context=add_history_to_context,
            add_dependencies_to_context=add_dependencies_to_context,
            add_session_state_to_context=add_session_state_to_context,
            debug_mode=debug_mode,
        )

        orig_entrypoint = delegate_func.entrypoint
        if orig_entrypoint is None:
            return delegate_func

        team_id = getattr(team, "id", "unknown")

        if async_mode:

            @wraps(orig_entrypoint)
            async def async_wrapped_entrypoint(member_id: str, task: str) -> AsyncIterator[Any]:
                content_emitted = False
                try:
                    async for event in orig_entrypoint(member_id, task):
                        if isinstance(event, (RunContentEvent, IntermediateRunContentEvent)):
                            if getattr(event, "content", None):
                                content_emitted = True
                        elif isinstance(event, str) and event.strip():
                            content_emitted = True
                        yield event
                except Exception as exc:
                    log_error(
                        f"[Team '{team_id}'] Delegation to member '{member_id}' failed with exception: {exc}",
                        exc_info=True,
                    )
                    yield f"Error: Delegation to member '{member_id}' failed with exception: {exc}"
                    return

                if not content_emitted:
                    fallback = _resolve_fallback_and_log(team_id, member_id, task, run_response)
                    if fallback:
                        yield fallback

            delegate_func.entrypoint = async_wrapped_entrypoint
        else:

            @wraps(orig_entrypoint)
            def sync_wrapped_entrypoint(member_id: str, task: str) -> Iterator[Any]:
                content_emitted = False
                try:
                    for event in orig_entrypoint(member_id, task):
                        if isinstance(event, (RunContentEvent, IntermediateRunContentEvent)):
                            if getattr(event, "content", None):
                                content_emitted = True
                        elif isinstance(event, str) and event.strip():
                            content_emitted = True
                        yield event
                except Exception as exc:
                    log_error(
                        f"[Team '{team_id}'] Delegation to member '{member_id}' failed with exception: {exc}",
                        exc_info=True,
                    )
                    yield f"Error: Delegation to member '{member_id}' failed with exception: {exc}"
                    return

                if not content_emitted:
                    fallback = _resolve_fallback_and_log(team_id, member_id, task, run_response)
                    if fallback:
                        yield fallback

            delegate_func.entrypoint = sync_wrapped_entrypoint

        return delegate_func

    setattr(patched_get_delegate_task_function, "_is_patched", True)
    setattr(_default_tools, "_get_delegate_task_function", patched_get_delegate_task_function)
    setattr(_team_tools, "_get_delegate_task_function", patched_get_delegate_task_function)


def _resolve_fallback_and_log(team_id: str, member_id: str, task: str, run_response: Any) -> str | None:
    """Inspect member run results on empty output, log structured diagnostics, and provide a fallback."""
    last_member_run = (
        run_response.member_runs[-1] if (run_response and getattr(run_response, "member_runs", None)) else None
    )

    if last_member_run is not None:
        status = getattr(last_member_run, "status", None)
        if status == RunStatus.error:
            err_msg = getattr(last_member_run, "content", None) or "Member execution encountered an error status."
            log_error(f"[Team '{team_id}'] Member '{member_id}' completed with error status: {err_msg}")
            return f"Member '{member_id}' failed during task execution: {err_msg}"

        tools = getattr(last_member_run, "tools", None) or []
        if tools:
            tool_names = [getattr(t, "tool_name", "tool") for t in tools]
            tool_results = [str(getattr(t, "result", "")) for t in tools if getattr(t, "result", None)]
            log_warning(
                f"[Team '{team_id}'] Member '{member_id}' executed {len(tools)} tools ({', '.join(tool_names[:5])}) "
                f"but produced no final summary text."
            )
            if tool_results:
                summary_snippet = " | ".join(tool_results[:3])
                if len(summary_snippet) > 800:
                    summary_snippet = summary_snippet[:800] + "..."
                return (
                    f"Member '{member_id}' executed {len(tools)} tool calls ({', '.join(tool_names[:5])}), "
                    f"but did not return a summary. Retrieved data: {summary_snippet}"
                )
            return (
                f"Member '{member_id}' executed {len(tools)} tool calls ({', '.join(tool_names[:5])}), "
                "but returned no textual response."
            )

    log_warning(f"[Team '{team_id}'] Member '{member_id}' produced no content for task: {task[:100]}")
    return f"Member '{member_id}' completed the task but returned an empty response."
