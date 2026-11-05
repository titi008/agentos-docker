"""Model Pricing and Cost Tracking Engine
====================================

Manages versioned (effective-dated) pricing rates for LLM providers and models,
and computes historical and real-time usage costs.
"""

from __future__ import annotations

import json
from collections.abc import Iterable, Mapping
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from agno.db.postgres import PostgresDb
from agno.utils.log import log_error
from sqlalchemy import case, cast, column, exists, func, inspect, select, table
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.exc import SQLAlchemyError

from db import get_postgres_db


@dataclass
class PriceRate:
    """A pricing rate for a specific model effective from a given timestamp."""

    model_id: str
    provider: str
    input_cost_per_m: float  # USD per 1M input tokens
    output_cost_per_m: float  # USD per 1M output tokens
    effective_from: str  # ISO 8601 UTC timestamp

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> PriceRate:
        return cls(
            model_id=str(data.get("model_id", "")),
            provider=str(data.get("provider", "Unknown")),
            input_cost_per_m=float(data.get("input_cost_per_m", 0.0)),
            output_cost_per_m=float(data.get("output_cost_per_m", 0.0)),
            effective_from=str(data.get("effective_from", "1970-01-01T00:00:00Z")),
        )


# Default baseline catalog for 2026 generations
DEFAULT_PRICE_BOOK: list[PriceRate] = [
    # Anthropic
    PriceRate(
        model_id="claude-sonnet-5-5",
        provider="Anthropic",
        input_cost_per_m=2.00,
        output_cost_per_m=10.00,
        effective_from="2026-01-01T00:00:00Z",
    ),
    PriceRate(
        model_id="claude-opus-5-5",
        provider="Anthropic",
        input_cost_per_m=4.00,
        output_cost_per_m=20.00,
        effective_from="2026-01-01T00:00:00Z",
    ),
    PriceRate(
        model_id="claude-haiku-5-5",
        provider="Anthropic",
        input_cost_per_m=0.10,
        output_cost_per_m=0.50,
        effective_from="2026-01-01T00:00:00Z",
    ),
    # Google Gemini
    PriceRate(
        model_id="gemini-4-argon",
        provider="Google",
        input_cost_per_m=2.50,
        output_cost_per_m=10.00,
        effective_from="2026-01-01T00:00:00Z",
    ),
    PriceRate(
        model_id="gemini-3.8-flash",
        provider="Google",
        input_cost_per_m=0.75,
        output_cost_per_m=3.75,
        effective_from="2026-01-01T00:00:00Z",
    ),
    PriceRate(
        model_id="gemini-3.8-live",
        provider="Google",
        input_cost_per_m=1.00,
        output_cost_per_m=4.00,
        effective_from="2026-01-01T00:00:00Z",
    ),
    # OpenAI
    PriceRate(
        model_id="gpt-6.1-sol",
        provider="OpenAI",
        input_cost_per_m=1.50,
        output_cost_per_m=6.00,
        effective_from="2026-01-01T00:00:00Z",
    ),
    PriceRate(
        model_id="gpt-6-astra",
        provider="OpenAI",
        input_cost_per_m=5.00,
        output_cost_per_m=20.00,
        effective_from="2026-01-01T00:00:00Z",
    ),
]


class PricingManager:
    """Manages effective-dated model pricing and calculates token costs."""

    def __init__(self, storage_path: Path | None = None) -> None:
        self.storage_path = storage_path or Path(__file__).resolve().parent.parent / "data" / "pricing_history.json"
        self._rates: list[PriceRate] = []
        self._load_rates()

    def _load_rates(self) -> None:
        """Load rates from storage, populating defaults if empty."""
        loaded: list[PriceRate] = []
        if self.storage_path.exists():
            try:
                with open(self.storage_path, encoding="utf-8") as f:
                    raw_list = json.load(f)
                    if isinstance(raw_list, list):
                        loaded = [PriceRate.from_dict(item) for item in raw_list]
            except Exception:
                loaded = []

        if not loaded:
            loaded = list(DEFAULT_PRICE_BOOK)
            self._save_rates(loaded)

        self._rates = loaded

    def _save_rates(self, rates: list[PriceRate]) -> None:
        """Persist rate history to storage file."""
        try:
            self.storage_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump([r.to_dict() for r in rates], f, indent=2)
        except Exception:
            # Fall back to in-memory state if disk writes are restricted
            pass

    def get_rates(self) -> list[PriceRate]:
        """Return full rate history sorted by effective date."""
        return list(self._rates)

    def get_current_rates(self) -> list[PriceRate]:
        """Return the latest active rate for each known model."""
        now_iso = datetime.now(UTC).isoformat()
        latest_by_model: dict[str, PriceRate] = {}

        # Sort chronologically
        sorted_rates = sorted(self._rates, key=lambda r: r.effective_from)
        for rate in sorted_rates:
            if rate.effective_from <= now_iso:
                latest_by_model[rate.model_id] = rate

        return list(latest_by_model.values())

    def update_rate(
        self, model_id: str, input_cost_per_m: float, output_cost_per_m: float, provider: str | None = None
    ) -> PriceRate:
        """Add a new rate version effective immediately, leaving past runs immutable."""
        now_iso = datetime.now(UTC).isoformat()

        # Determine provider if omitted
        if not provider:
            for r in reversed(self._rates):
                if r.model_id == model_id:
                    provider = r.provider
                    break
        if not provider:
            provider = "Unknown"

        new_rate = PriceRate(
            model_id=model_id,
            provider=provider,
            input_cost_per_m=input_cost_per_m,
            output_cost_per_m=output_cost_per_m,
            effective_from=now_iso,
        )

        self._rates.append(new_rate)
        self._save_rates(self._rates)
        return new_rate

    def get_rate_for_timestamp(self, model_id: str, timestamp_iso: str | None = None) -> PriceRate | None:
        """Find the rate for a model effective at the specified point in time."""
        target_ts = timestamp_iso or datetime.now(UTC).isoformat()

        matching_rates = [r for r in self._rates if r.model_id == model_id and r.effective_from <= target_ts]

        if matching_rates:
            matching_rates.sort(key=lambda r: r.effective_from, reverse=True)
            return matching_rates[0]

        # Fuzzy match for provider prefixes e.g. "google/gemini-3.8-flash"
        clean_model_id = model_id.split("/")[-1].split(":")[-1]
        fallback_matches = [r for r in self._rates if r.model_id == clean_model_id and r.effective_from <= target_ts]
        if fallback_matches:
            fallback_matches.sort(key=lambda r: r.effective_from, reverse=True)
            return fallback_matches[0]

        return None

    def calculate_cost(
        self, model_id: str, input_tokens: int, output_tokens: int, timestamp_iso: str | None = None
    ) -> float:
        """Calculate estimated USD cost for a token pair at the designated timestamp."""
        rate = self.get_rate_for_timestamp(model_id, timestamp_iso)
        if rate is None:
            return 0.0

        in_cost = (max(0, input_tokens) / 1_000_000.0) * rate.input_cost_per_m
        out_cost = (max(0, output_tokens) / 1_000_000.0) * rate.output_cost_per_m
        return round(in_cost + out_cost, 6)


# Shared global pricing manager
pricing_manager = PricingManager()


# ---------------------------------------------------------------------------
# Cost breakdown
# ---------------------------------------------------------------------------

UNKNOWN_MODEL = "unknown-model"


@dataclass(frozen=True)
class RunUsageRow:
    """One stored run, reduced to the fields cost accounting reads."""

    model: str | None
    model_provider: str | None
    metrics: Any
    created_at: Any
    parent_run_id: str | None = None


@dataclass(frozen=True)
class ModelUsage:
    """Tokens one run spent on one model."""

    model_id: str
    provider: str
    input_tokens: int
    output_tokens: int
    total_tokens: int


def _non_negative_int(value: Any) -> int:
    try:
        return max(0, int(value or 0))
    except TypeError, ValueError:
        return 0


def _token_counts(metrics: Mapping[str, Any]) -> tuple[int, int, int]:
    input_tokens = _non_negative_int(metrics.get("input_tokens") or metrics.get("prompt_tokens"))
    output_tokens = _non_negative_int(metrics.get("output_tokens") or metrics.get("completion_tokens"))
    total_tokens = _non_negative_int(metrics.get("total_tokens")) or input_tokens + output_tokens
    return input_tokens, output_tokens, total_tokens


def _normalize_provider(model_id: str, provider: str | None) -> str:
    """Use the recorded provider, or infer the common ones from the model id."""
    if provider and provider.strip() and provider.strip().lower() != "unknown":
        return provider.strip()
    lowered = model_id.lower()
    if "claude" in lowered:
        return "Anthropic"
    if "gemini" in lowered:
        return "Google"
    if lowered.startswith(("gpt", "o1", "o3", "o4")):
        return "OpenAI"
    return "Unknown"


def _usage_from_run_metrics(
    metrics: Mapping[str, Any], fallback_model: str | None, fallback_provider: str | None
) -> list[ModelUsage]:
    """Per-model usage of one agno RunMetrics dict.

    ``details`` lists every model the run called (main, output, memory, reasoning
    models…), so it is preferred over the run totals, which mix those models.
    """
    usage: list[ModelUsage] = []
    details = metrics.get("details")
    if isinstance(details, Mapping):
        for entries in details.values():
            if not isinstance(entries, list):
                continue
            for entry in entries:
                if not isinstance(entry, Mapping):
                    continue
                input_tokens, output_tokens, total_tokens = _token_counts(entry)
                if not total_tokens:
                    continue
                model_id = str(entry.get("id") or fallback_model or UNKNOWN_MODEL)
                usage.append(
                    ModelUsage(
                        model_id=model_id,
                        provider=_normalize_provider(model_id, entry.get("provider") or fallback_provider),
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        total_tokens=total_tokens,
                    )
                )
    if usage:
        return usage

    input_tokens, output_tokens, total_tokens = _token_counts(metrics)
    if not total_tokens:
        return []
    model_id = fallback_model or UNKNOWN_MODEL
    return [
        ModelUsage(
            model_id=model_id,
            provider=_normalize_provider(model_id, fallback_provider),
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
        )
    ]


def run_model_usage(row: RunUsageRow) -> list[ModelUsage]:
    """Tokens a stored run spent, per model.

    Agent and team runs carry RunMetrics. Team member runs are stored as their
    own rows (with ``parent_run_id``) and the leader's metrics exclude them, so
    every row is counted once. Workflow runs keep usage per step.
    """
    metrics = row.metrics
    if isinstance(metrics, str):
        try:
            metrics = json.loads(metrics)
        except ValueError:
            return []
    if not isinstance(metrics, Mapping):
        return []

    steps = metrics.get("steps")
    if isinstance(steps, Mapping):
        usage: list[ModelUsage] = []
        for step in steps.values():
            step_metrics = step.get("metrics") if isinstance(step, Mapping) else None
            if isinstance(step_metrics, Mapping):
                usage.extend(_usage_from_run_metrics(step_metrics, None, None))
        return usage

    return _usage_from_run_metrics(metrics, row.model, row.model_provider)


def _run_timestamp(value: Any) -> datetime | None:
    """Stored runs use unix seconds; legacy rows may hold them as strings."""
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    try:
        seconds = float(value)
    except TypeError, ValueError:
        return None
    if seconds > 1e12:  # milliseconds
        seconds /= 1000
    try:
        return datetime.fromtimestamp(seconds, tz=UTC)
    except OverflowError, OSError, ValueError:
        return None


def _empty_stat(**keys: str) -> dict[str, Any]:
    return {**keys, "runs": 0, "input_tokens": 0, "output_tokens": 0, "total_tokens": 0, "total_cost": 0.0}


def _add_usage(stat: dict[str, Any], usage: ModelUsage, cost: float) -> None:
    stat["input_tokens"] += usage.input_tokens
    stat["output_tokens"] += usage.output_tokens
    stat["total_tokens"] += usage.total_tokens
    stat["total_cost"] = round(stat["total_cost"] + cost, 6)


def aggregate_costs(rows: Iterable[RunUsageRow], manager: PricingManager) -> dict[str, Any]:
    """Aggregate token usage and estimated cost per model, provider and UTC day.

    Each model's cost uses the rate that was effective when the run happened.
    ``runs`` counts top-level runs (team member runs belong to their team run);
    per-model and per-provider ``runs`` count every run that used them.
    """
    current_rates = {rate.model_id: rate for rate in manager.get_current_rates()}
    model_stats: dict[str, dict[str, Any]] = {}
    provider_stats: dict[str, dict[str, Any]] = {}
    daily_stats: dict[str, dict[str, Any]] = {}
    total_runs = 0
    total_input_tokens = 0
    total_output_tokens = 0
    total_cost = 0.0

    for row in rows:
        timestamp = _run_timestamp(row.created_at)
        timestamp_iso = timestamp.isoformat() if timestamp else None
        day = timestamp.strftime("%Y-%m-%d") if timestamp else None
        is_top_level = not row.parent_run_id
        daily = daily_stats.setdefault(day, _empty_stat(date=day)) if day else None

        if is_top_level:
            total_runs += 1
            if daily is not None:
                daily["runs"] += 1

        models_seen: set[str] = set()
        providers_seen: set[str] = set()
        for usage in run_model_usage(row):
            cost = manager.calculate_cost(usage.model_id, usage.input_tokens, usage.output_tokens, timestamp_iso)
            total_input_tokens += usage.input_tokens
            total_output_tokens += usage.output_tokens
            total_cost += cost

            model_stat = model_stats.setdefault(
                usage.model_id, _empty_stat(model_id=usage.model_id, provider=usage.provider)
            )
            provider_stat = provider_stats.setdefault(usage.provider, _empty_stat(provider=usage.provider))
            if usage.model_id not in models_seen:
                model_stat["runs"] += 1
                models_seen.add(usage.model_id)
            if usage.provider not in providers_seen:
                provider_stat["runs"] += 1
                providers_seen.add(usage.provider)
            _add_usage(model_stat, usage, cost)
            _add_usage(provider_stat, usage, cost)
            if daily is not None:
                _add_usage(daily, usage, cost)

    # Priced models are listed even before their first run.
    for model_id, rate in current_rates.items():
        model_stats.setdefault(model_id, _empty_stat(model_id=model_id, provider=rate.provider))
        provider_stats.setdefault(rate.provider, _empty_stat(provider=rate.provider))

    providers = list(provider_stats.values())
    for provider in providers:
        provider["percentage"] = round(provider["total_cost"] / total_cost * 100, 1) if total_cost > 0 else 0.0

    return {
        "total_cost": round(total_cost, 4),
        "total_runs": total_runs,
        "total_tokens": total_input_tokens + total_output_tokens,
        "total_input_tokens": total_input_tokens,
        "total_output_tokens": total_output_tokens,
        "by_provider": sorted(providers, key=lambda item: item["total_cost"], reverse=True),
        "by_model": sorted(model_stats.values(), key=lambda item: (item["runs"], item["total_cost"]), reverse=True),
        "daily_history": [daily_stats[key] for key in sorted(daily_stats, reverse=True)],
        "rates": [rate.to_dict() for rate in current_rates.values()],
    }


def load_run_usage(db: PostgresDb) -> list[RunUsageRow]:
    """Read model, provider, metrics and time of every stored run.

    Runs live in the db's runs table (``ai.agno_runs`` by default). Sessions not
    yet migrated from agno 2.x still hold runs in the legacy ``runs`` column of
    the sessions table; those are read too, the same way agno's metrics do.
    Only these fields are selected, never whole runs. A database without the
    tables yet has no runs.
    """
    schema = db.db_schema
    runs_table_name = db.runs_table_name
    sessions_table_name = db.session_table_name
    rows: list[RunUsageRow] = []

    with db.db_engine.connect() as conn:
        inspector = inspect(conn)
        has_runs = inspector.has_table(runs_table_name, schema=schema)
        runs = table(
            runs_table_name,
            column("session_id"),
            column("run_data", JSONB),
            column("parent_run_id"),
            column("created_at"),
            schema=schema,
        )
        if has_runs:
            stmt = select(
                runs.c.run_data["model"].astext,
                runs.c.run_data["model_provider"].astext,
                runs.c.run_data["metrics"],
                runs.c.created_at,
                runs.c.parent_run_id,
            ).order_by(runs.c.created_at)
            rows.extend(RunUsageRow(*record) for record in conn.execute(stmt))

        has_legacy_runs = inspector.has_table(sessions_table_name, schema=schema) and any(
            col["name"] == "runs" for col in inspector.get_columns(sessions_table_name, schema=schema)
        )
        if has_legacy_runs:
            sessions = table(sessions_table_name, column("session_id"), column("runs"), schema=schema)
            legacy_runs = cast(sessions.c.runs, JSONB)
            legacy_run = func.jsonb_array_elements(
                case((func.jsonb_typeof(legacy_runs) == "array", legacy_runs), else_=func.jsonb_build_array()),
                type_=JSONB,
            ).column_valued("legacy_run", joins_implicitly=True)
            legacy_stmt = select(
                legacy_run["model"].astext,
                legacy_run["model_provider"].astext,
                legacy_run["metrics"],
                legacy_run["created_at"].astext,
                legacy_run["parent_run_id"].astext,
            ).select_from(sessions)
            if has_runs:
                # Sessions that already have rows in the runs table were migrated.
                legacy_stmt = legacy_stmt.where(
                    ~exists(select(runs.c.session_id).where(runs.c.session_id == sessions.c.session_id))
                )
            rows.extend(RunUsageRow(*record) for record in conn.execute(legacy_stmt))

    return rows


def compute_cost_breakdown() -> dict[str, Any]:
    """Token and estimated cost breakdown per model, provider and day.

    Raises SQLAlchemyError when the database can't be read, so callers can
    report an outage instead of showing zero spend.
    """
    try:
        rows = load_run_usage(get_postgres_db())
    except SQLAlchemyError as exc:
        log_error(f"Could not read runs for the cost breakdown: {exc}")
        raise
    return aggregate_costs(rows, pricing_manager)
