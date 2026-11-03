# Deploying Agno AgentOS on Self-Hosted Coolify

This guide walks you through deploying your self-hosted **Agno AgentOS** instance with the **Solopreneur AI Agent Team** to your VPS using **Coolify**, and connecting it to the Agno Hosted UI ([os.agno.com](https://os.agno.com)).

---

## 1. Prerequisites

- A VPS with **Coolify** installed and running.
- A domain or subdomain pointed to your VPS (e.g., `agentos.yourdomain.com`).
- An OpenAI API key (`OPENAI_API_KEY`).
- A free account at [os.agno.com](https://os.agno.com).

---

## 2. Deploy in Coolify

### Step 1: Add a New Resource
1. In your Coolify dashboard, navigate to your **Project** and **Environment**.
2. Click **+ Add Resource** -> **Git Based** -> **Public Repository** (or Private if using GitHub App).
3. Set Repository URL:
   ```text
   https://github.com/titi008/agentos-docker
   ```
4. Set Branch:
   ```text
   feat/solopreneur-agent-team
   ```
5. Choose **Docker Compose** as the build pack.
6. Set the Docker Compose Location / File to:
   ```text
   compose.coolify.yaml
   ```

### Step 2: Configure Domains & Routing
1. In the application view under **Configuration**:
   - For **`agentos-api`**, set Domain to your API domain (port `8000`):
     ```text
     https://agentos.lasttokens.dev:8000
     ```
   - For **`agentos-ui`**, set Domain to your Chat UI domain (port `3000`):
     ```text
     https://chat.lasttokens.dev:3000
     ```
2. Coolify handles Traefik reverse proxy routing and Let's Encrypt SSL certificates automatically for both domains.

### Step 3: Configure Environment Variables
In Coolify's **Environment Variables** tab, define:

```env
# LLM Provider (Choose Anthropic, Gemini, or OpenAI)
MODEL_PROVIDER=gemini
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-3.8-flash

# Or if using Anthropic:
# MODEL_PROVIDER=anthropic
# ANTHROPIC_API_KEY=sk-ant-...
# ANTHROPIC_MODEL=claude-sonnet-5-5

# Public URL of this AgentOS instance
AGENTOS_URL=https://agentos.yourdomain.com

# Database credentials
DB_USER=ai
DB_PASS=generate_a_secure_password
DB_DATABASE=ai

# Runtime environment:
# Use "dev" initially to verify the deployment without JWT enforcement,
# then switch to "prd" once you obtain your JWT key from os.agno.com.
RUNTIME_ENV=dev
```

### Step 4: Deploy
Click **Deploy** in Coolify.
- Coolify builds the `agentos-api` image.
- Launches the `agentos-db` (Postgres 18 with pgvector extension).
- Runs schema provisioning automatically.
- Starts serving on port 8000 behind HTTPS.

Verify by visiting:
```text
https://agentos.yourdomain.com/health
```
You should see:
```json
{"status":"healthy"}
```

---

## 3. Connect to Agno Hosted UI (os.agno.com)

1. Open your browser and navigate to [os.agno.com](https://os.agno.com).
2. Sign in to your account.
3. In the sidebar or top navigation, click **Connect OS**.
4. Fill in:
   - **Name**: `Solo Operations OS`
   - **Endpoint URL**: `https://agentos.yourdomain.com`
5. Click **Connect**.

Your browser will connect directly to your self-hosted AgentOS runtime.

---

## 4. Securing for Production (Enable JWT Authentication)

Once verified in `RUNTIME_ENV=dev`, switch to production mode:

1. In [os.agno.com](https://os.agno.com), go to your connected OS -> **Settings** -> **Security / Tokens**.
2. Copy the **Public Verification Key** (PEM format).
3. In Coolify, add/update the environment variables:
   ```env
   RUNTIME_ENV=prd
   JWT_VERIFICATION_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkq...\n-----END PUBLIC KEY-----"
   ```
4. Click **Redeploy** in Coolify.

Now, all unauthorized external requests to your API are rejected, and only authenticated sessions from your Agno Studio account can interact with your agents.

---

## 5. Your Solo Business Agent Team

This deployment includes the pre-configured **Solo Operations Team**:

- **Solo Chief of Staff (`solo-chief-of-staff`)**: Executive team coordinator that decomposes complex founder goals and orchestrates the specialists.
- **Market Researcher (`market-researcher`)**: Web search and competitor/market intelligence powered by Parallel web tools.
- **Content Strategist (`content-strategist`)**: Conversion copy, newsletters, social posts, and blog drafts.
- **Tech Specialist (`tech-specialist`)**: Code review, script automation, API integrations, and architecture troubleshooting.
