"""Model Pricing and Cost Tracking Engine
====================================

Manages versioned (effective-dated) pricing rates for LLM providers and models,
and computes historical and real-time usage costs.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import text

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


def compute_cost_breakdown() -> dict[str, Any]:
    """Query PostgreSQL run and metrics data to compute token and cost breakdown per model and provider."""
    current_rates = {r.model_id: r for r in pricing_manager.get_current_rates()}

    # Structure for aggregation
    model_stats: dict[str, dict[str, Any]] = {}
    provider_stats: dict[str, dict[str, Any]] = {}
    daily_stats: dict[str, dict[str, Any]] = {}

    total_runs = 0
    total_input_tokens = 0
    total_output_tokens = 0
    total_cost = 0.0

    # Query PostgreSQL runs table if reachable
    try:
        db = get_postgres_db()
        engine = getattr(db, "db_engine", getattr(db, "_engine", None))
        if engine is not None:
            with engine.connect() as conn:
                # Query distinct run data from agno_runs
                table_name = getattr(db, "runs_table_name", "agno_runs")
                query = text(f"""
                    SELECT 
                        agent_id, team_id, run_data, created_at
                    FROM {table_name}
                    ORDER BY created_at ASC
                """)
                rows = conn.execute(query).fetchall()

                for row in rows:
                    raw_data = row[2]
                    if isinstance(raw_data, dict):
                        run_data = raw_data
                    elif isinstance(raw_data, str):
                        try:
                            run_data = json.loads(raw_data)
                        except Exception:
                            run_data = {}
                    else:
                        run_data = {}

                    created_at_val = row[3]

                    # Parse timestamp
                    ts_iso: str | None = None
                    if isinstance(created_at_val, (int, float)):
                        ts_iso = datetime.fromtimestamp(created_at_val, tz=UTC).isoformat()
                    elif isinstance(created_at_val, datetime):
                        ts_iso = created_at_val.isoformat()

                    date_str = ts_iso[:10] if ts_iso else datetime.now(UTC).strftime("%Y-%m-%d")

                    model = str(run_data.get("model") or "unknown-model")
                    provider = str(run_data.get("model_provider") or "Unknown")

                    # Normalize provider if unknown
                    if provider == "Unknown":
                        if "claude" in model.lower():
                            provider = "Anthropic"
                        elif "gemini" in model.lower():
                            provider = "Google"
                        elif "gpt" in model.lower():
                            provider = "OpenAI"

                    metrics = run_data.get("metrics") or {}
                    in_tok = int(metrics.get("input_tokens") or metrics.get("prompt_tokens") or 0)
                    out_tok = int(metrics.get("output_tokens") or metrics.get("completion_tokens") or 0)
                    tot_tok = int(metrics.get("total_tokens") or (in_tok + out_tok))

                    run_cost = pricing_manager.calculate_cost(model, in_tok, out_tok, ts_iso)

                    total_runs += 1
                    total_input_tokens += in_tok
                    total_output_tokens += out_tok
                    total_cost += run_cost

                    # Model stats
                    m_stat = model_stats.setdefault(
                        model,
                        {
                            "model_id": model,
                            "provider": provider,
                            "runs": 0,
                            "input_tokens": 0,
                            "output_tokens": 0,
                            "total_tokens": 0,
                            "total_cost": 0.0,
                        },
                    )
                    m_stat["runs"] += 1
                    m_stat["input_tokens"] += in_tok
                    m_stat["output_tokens"] += out_tok
                    m_stat["total_tokens"] += tot_tok
                    m_stat["total_cost"] = round(m_stat["total_cost"] + run_cost, 6)

                    # Provider stats
                    p_stat = provider_stats.setdefault(
                        provider,
                        {
                            "provider": provider,
                            "runs": 0,
                            "input_tokens": 0,
                            "output_tokens": 0,
                            "total_tokens": 0,
                            "total_cost": 0.0,
                        },
                    )
                    p_stat["runs"] += 1
                    p_stat["input_tokens"] += in_tok
                    p_stat["output_tokens"] += out_tok
                    p_stat["total_tokens"] += tot_tok
                    p_stat["total_cost"] = round(p_stat["total_cost"] + run_cost, 6)

                    # Daily stats
                    d_stat = daily_stats.setdefault(
                        date_str,
                        {
                            "date": date_str,
                            "runs": 0,
                            "input_tokens": 0,
                            "output_tokens": 0,
                            "total_tokens": 0,
                            "total_cost": 0.0,
                        },
                    )
                    d_stat["runs"] += 1
                    d_stat["input_tokens"] += in_tok
                    d_stat["output_tokens"] += out_tok
                    d_stat["total_tokens"] += tot_tok
                    d_stat["total_cost"] = round(d_stat["total_cost"] + run_cost, 6)
    except Exception:
        # Gracefully handle database offline or missing tables
        pass

    # Ensure catalog models are listed even with 0 runs
    for model_id, rate in current_rates.items():
        if model_id not in model_stats:
            model_stats[model_id] = {
                "model_id": model_id,
                "provider": rate.provider,
                "runs": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "total_cost": 0.0,
            }
        if rate.provider not in provider_stats:
            provider_stats[rate.provider] = {
                "provider": rate.provider,
                "runs": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "total_cost": 0.0,
            }

    # Format provider list with percentage
    providers_list = list(provider_stats.values())
    for p in providers_list:
        p["percentage"] = round((p["total_cost"] / total_cost * 100), 1) if total_cost > 0 else 0.0

    return {
        "total_cost": round(total_cost, 4),
        "total_runs": total_runs,
        "total_tokens": total_input_tokens + total_output_tokens,
        "total_input_tokens": total_input_tokens,
        "total_output_tokens": total_output_tokens,
        "by_provider": sorted(providers_list, key=lambda x: x["total_cost"], reverse=True),
        "by_model": sorted(list(model_stats.values()), key=lambda x: (x["runs"], x["total_cost"]), reverse=True),
        "daily_history": [daily_stats[k] for k in sorted(daily_stats.keys(), reverse=True)],
        "rates": [r.to_dict() for r in current_rates.values()],
    }
