# Model Tiering & Dynamic Orchestration

AgentOS natively supports heterogeneous multi-model architectures. Rather than enforcing a single global LLM across the entire platform, every Agent, Team Leader, and Workflow step can be assigned an optimal model tier based on task complexity, speed requirements, and cost targets.

---

## 1. The 3-Tier Model Architecture

In a production agentic system, 70–85% of token consumption typically goes to raw context, multi-page web scrapes, database query outputs, and rough drafts. Running frontier reasoning models on these high-volume sub-tasks causes unnecessary latency and cost.

AgentOS organizes models into three semantic tiers:

| Tier | Role | Default Models | Characteristics | Target Use Cases |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1: Reasoning & Orchestration** | Team Leaders, Architects, Engineers, Planners | `claude-sonnet-5-5`<br/>`gemini-4-argon`<br/>`gpt-6.1-sol` | High multi-step reasoning, low hallucination, strict instruction-following. | `Team` leaders, `ClaudeAgent`, `CodexAgent`, `OSManager`, complex strategy. |
| **Tier 2: High-Speed Execution** | Specialists, Scrapers, Extractors, Formatters | `gemini-3.8-flash`<br/>`claude-haiku-5-5`<br/>`gpt-6.1-sol` (low effort) | Sub-second latency, massive context window (1M+ tokens), fractional token cost (~$0.75/M). | `market-researcher` (web scraping), `content-strategist` (drafting), JSON extraction. |
| **Tier 3: Platform Maintenance** | Periodic Sweeps, Scheduled Routines | `gemini-3.8-flash`<br/>`claude-haiku-5-5` | High durability, near-zero recurring execution cost. | `agentos-maintenance` routine in `app/company.py`, cron jobs. |

---

## 2. Configuration Guide

Model tiering is centralized in [`app/settings.py`](file:///Users/tiborszucs/My_files/Programming/Github/agno-integration/app/settings.py) and can be configured through environment variables, Python code, or the Studio UI.

### Option A: Environment Variables (`.env`)

You can switch providers globally or override individual tiers without modifying application code:

```bash
# Global provider fallback (anthropic, gemini, or openai)
MODEL_PROVIDER=openai

# Tier-specific provider overrides
REASONING_PROVIDER=anthropic    # Tier 1: Team Leaders, Engineers, Planners
FAST_PROVIDER=gemini            # Tier 2: Specialists, Scrapers, Formatters

# Tier-specific model IDs (optional overrides)
ANTHROPIC_REASONING_MODEL=claude-sonnet-5-5
ANTHROPIC_FAST_MODEL=claude-haiku-5-5
GEMINI_REASONING_MODEL=gemini-4-argon
GEMINI_FAST_MODEL=gemini-3.8-flash
OPENAI_REASONING_MODEL=gpt-6.1-sol
OPENAI_FAST_MODEL=gpt-6.1-sol
```

### Option B: Code Declarations

Import the semantic tier factories in your agent and team definitions:

* **Specialist Agent** ([`agents/researcher.py`](file:///Users/tiborszucs/My_files/Programming/Github/agno-integration/agents/researcher.py)):
  ```python
  from agno.agent import Agent
  from app.settings import fast_model

  market_researcher = Agent(
      id="market-researcher",
      name="Market Researcher",
      model=fast_model(),  # Resolves to Tier 2 (Gemini 3.8 Flash / Claude Haiku 5.5)
      ...
  )
  ```

* **Team Leader** ([`teams/solo_operations.py`](file:///Users/tiborszucs/My_files/Programming/Github/agno-integration/teams/solo_operations.py)):
  ```python
  from agno.team import Team
  from app.settings import reasoning_model

  solo_operations_team = Team(
      id="solo-chief-of-staff",
      name="Solo Chief of Staff",
      model=reasoning_model(),  # Resolves to Tier 1 (Claude Sonnet 5.5 / Gemini 4 Argon)
      members=[market_researcher, content_strategist, tech_specialist],
      ...
  )
  ```

### Option C: Agno Studio UI

The model selection palette exposed in the Studio UI is configured in [`app/settings.py:get_available_models()`](file:///Users/tiborszucs/My_files/Programming/Github/agno-integration/app/settings.py). Agents and teams created dynamically in Studio can select any model from this palette; changes persist directly to PostgreSQL.

---

## 3. How Multi-Agent Orchestration Works

When communicating with a Team, Agno converts each member agent into an isolated tool accessible to the Team Leader:

```
User Prompt: "Compare competitor pricing and draft a newsletter announcement"
  │
  ▼
[Team Leader: Solo Chief of Staff]  <-- Tier 1 (Claude Sonnet 5.5 / GPT-6.1 Sol)
  │
  ├── 1. Tool Call: market_researcher  <-- Tier 2 (Gemini 3.8 Flash)
  │      Scrapes 5 URLs (40,000 tokens of raw HTML).
  │      Returns structured pricing tables back to Leader.
  │
  ├── 2. Tool Call: content_strategist <-- Tier 2 (Claude Haiku 5.5)
  │      Generates 3 newsletter draft variations using pricing facts.
  │      Returns drafts back to Leader.
  │
  ▼
[Team Leader Review & Synthesis]
  Reviews drafts against verified pricing, produces unified executive response.
  Streams final response back to Chat UI.
```

**Token Isolation:** The 40,000 tokens of raw web search HTML only pass through the cost-effective Tier 2 model. The frontier Tier 1 leader only receives the distilled summary, saving up to 85% in token costs.

---

## 4. Dynamic Prompt-Driven Model Switching ("Use Cheaper Model")

By default, an instantiated `Agent` holds a static model reference. When users want the system to dynamically downgrade or upgrade models based on prompt instructions (e.g., *"Do this, but use a cheaper model"* or *"Be cost effective"*), three architectural patterns are supported:

### Pattern 1: Dynamic Pre-Hook (Single Agents)

Agno agents support `pre_hooks` that execute immediately before a run. The hook inspects the user prompt and reassigns `agent.model` dynamically for that run:

```python
from agno.agent import Agent
from app.settings import fast_model, reasoning_model

def dynamic_cost_hook(run_context) -> None:
    """Inspect user prompt for cost sensitivity and dynamically assign the model."""
    prompt = str(run_context.input).lower()
    cost_keywords = ["cheap", "cheaper", "cost effective", "budget", "fast model", "save money"]

    if any(keyword in prompt for keyword in cost_keywords):
        run_context.agent.model = fast_model()
    else:
        run_context.agent.model = reasoning_model()

tech_specialist = Agent(
    id="tech-specialist",
    name="Tech Specialist",
    model=reasoning_model(),
    pre_hooks=[dynamic_cost_hook],
    ...
)
```

### Pattern 2: Team Member Cost Routing (Multi-Agent Teams)

In a Team hierarchy, the Team Leader's instructions define routing criteria between high-depth and economical specialist variants:

```python
from agno.team import Team
from agents.tech_specialist import tech_specialist_deep, tech_specialist_fast
from app.settings import reasoning_model

INSTRUCTIONS = """\
You are Solo Chief of Staff.

When delegating engineering tasks:
- If the user explicitly asks for speed, cost-effectiveness, or a "cheaper model", delegate to 'Tech Specialist (Fast)'.
- If the task requires deep architectural planning, security audits, or formal proofs, delegate to 'Tech Specialist (Deep)'.
"""

solo_operations_team = Team(
    id="solo-chief-of-staff",
    model=reasoning_model(),
    members=[tech_specialist_deep, tech_specialist_fast],
    instructions=INSTRUCTIONS,
    ...
)
```

### Pattern 3: Dynamic Model Execution Tool

Expose a delegation tool to the agent so the model can autonomously run sub-tasks through a designated tier:

```python
from agno.agent import Agent
from app.settings import fast_model, reasoning_model

def execute_subtask(task: str, cost_preference: str = "reasoning") -> str:
    """Run a sub-task using a designated model tier: 'fast' (economical) or 'reasoning' (high depth)."""
    selected_model = fast_model() if cost_preference == "fast" else reasoning_model()
    worker = Agent(model=selected_model)
    response = worker.run(task)
    return str(response.content)
```

---

## 5. Summary Matrix

| Capability | Supported Mechanism | Implementation |
| :--- | :--- | :--- |
| **Global Provider Fallback** | Environment variable | `MODEL_PROVIDER=openai` in `.env` |
| **Tier-Specific Provider Override** | Environment variable | `REASONING_PROVIDER=anthropic`, `FAST_PROVIDER=gemini` in `.env` |
| **Per-Agent Model Assignment** | Python code | `model=fast_model()` or `model=reasoning_model()` |
| **Team Leader / Member Tiering** | Python code | Leader on Tier 1, specialist members on Tier 2 |
| **Runtime Selection in UI** | Studio UI & Chat | Entity Selector and Model Display badge |
| **On-the-Fly Prompt Downgrade** | Pre-hook / Team routing | `pre_hooks=[dynamic_cost_hook]` or Team Leader routing rules |
| **Token & Cost Observability** | REST API & Dashboard | `/api/costs`, `/api/pricing`, and Observability Metrics tab |
| **Immutable Rate Revisions** | Effective-dating engine | `app/pricing.py:PricingManager` |

---

## 6. Model Usage Cost Tracking & Effective-Dated Pricing

AgentOS includes a built-in token cost estimation and pricing engine ([`app/pricing.py`](file:///Users/tiborszucs/My_files/Programming/Github/agno-integration/app/pricing.py)):

### Effective-Dated Immutability
When token rates change, historical cost records must remain accurate. The pricing engine enforces this through point-in-time timestamp matching:
* Every rate version stores an `effective_from` UTC timestamp.
* When evaluating a run, the system resolves the rate active at the moment the run executed ($T_{\text{run}}$):
  $$\text{effective\_from} \le T_{\text{run}} < \text{next\_effective\_from}$$
* Updating a rate in the Price Book creates a new rate version effective immediately. **Past runs are never modified or re-priced.**

### Dashboard Visibility
In the **Observability $\rightarrow$ Metrics** view:
1. **Total Estimated Spend**: Real-time dollar totals and average cost per run.
2. **Provider Spend Distribution**: Cards breaking down spend, percentage share, and token throughput for Anthropic, Google Gemini, and OpenAI.
3. **Model Breakdown Table**: Per-model metrics including runs, input/output tokens, total estimated spend, and active rates.
4. **Price Book Management**: Direct modal to configure rates per 1M tokens and inspect the versioned audit history.
