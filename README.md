# AI Ransomware Readiness Assistant

Defensive AI assistant for ransomware readiness interviews, scoring, and practical recovery planning.

This project helps an organization answer a structured readiness questionnaire in plain language, saves normalized answers, calculates a deterministic backend-controlled score, and generates a practical report with findings, next steps, and evidence guidance.

The AI layer is used for conversation, clarification, and free-text interpretation. It does not calculate, override, or invent the official score.

## What The Project Does

- Runs a controlled readiness interview from `data/questions.json`.
- Accepts free-text answers through a chat interface.
- Normalizes answers into `yes`, `partial`, `no`, or `unsure`.
- Calculates the official score only from backend rules in `data/scoring_rules.json`.
- Generates a backend report, findings, action plan, and evidence checklist.
- Provides demo profiles for quick product demonstrations.
- Supports OpenAI-compatible providers, OpenRouter, Ollama, and offline fallback mode.

## What The Project Does Not Do

- It is not a full security audit.
- It does not scan infrastructure.
- It does not perform pentesting.
- It does not enumerate external systems.
- It does not provide malware, exploit, bypass, or offensive security guidance.
- It does not allow the LLM to control the readiness score.

## Architecture

Main project areas:

- `backend/` - FastAPI API, interview logic, scoring, reports, storage, and guardrails.
- `frontend-web/` - main React + Vite web interface.
- `frontend/` - legacy Streamlit interface.
- `data/` - questions, scoring rules, demo profiles, metadata, and checklists.
- `skills/` - defensive playbooks used for explanations and recommendations.
- `prompts/` - LLM prompts for interview, extraction, advisory, and reporting flows.
- `tests/` - backend regression and unit tests.
- `docker-compose.yml` - Docker deployment with backend and Caddy-served frontend.

High-level flow:

1. A user creates or opens a session.
2. The backend asks questions from `data/questions.json`.
3. The user answers in normal language.
4. The AI layer may clarify, explain, or interpret the answer.
5. The backend validates and saves a structured answer.
6. The backend calculates score from `data/scoring_rules.json`.
7. The backend generates the final report and action plan.

## Tech Stack

- Python 3.10+
- FastAPI
- Uvicorn
- Pydantic
- LangGraph for optional dialog routing
- React 18
- Vite
- TypeScript
- Tailwind CSS
- Docker
- Caddy

## Quick Start On Windows

Requirements:

- Python 3.10+
- Node.js 18+
- npm

Start the full local app:

```powershell
.\start.bat
```

Open:

- Frontend: `http://localhost:5173`
- Backend: `http://127.0.0.1:8000`
- API docs: `http://127.0.0.1:8000/docs`
- Provider status: `http://127.0.0.1:8000/provider/status`

`start.bat` calls `scripts/dev.ps1`, creates `.venv` if needed, installs backend/frontend dependencies, and starts both the FastAPI backend and Vite frontend.

## Manual Development Start

Backend only:

```powershell
.\run_backend.bat
```

Frontend only:

```powershell
.\run_frontend.bat
```

Manual commands:

```powershell
# backend
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000

# frontend
cd frontend-web
npm install
npm run dev
```

## macOS And Linux

```bash
chmod +x start.sh scripts/dev.sh
./start.sh
```

Default local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://127.0.0.1:8000`

## Public Demo Tunnel

For a temporary public demo link from your local machine:

Windows:

```powershell
.\start_public.bat
```

macOS/Linux:

```bash
./start_public.sh
```

This uses a Cloudflare Quick Tunnel and exposes the frontend while proxying `/api` back to the local backend.

## Docker Start

Requirements:

- Docker Desktop or Docker Engine

Create `.env`:

```powershell
copy .env.production.example .env
```

Start:

```powershell
docker compose up -d --build
```

Open:

```text
http://localhost
```

In Docker mode:

- Caddy serves the built React frontend.
- `/api/*` is proxied to the FastAPI backend.
- Runtime backend data is stored in the `backend_data` Docker volume.
- The backend is not exposed directly on a host port by default.

Useful commands:

```powershell
docker compose logs -f
docker compose down
docker compose up -d --build
```

After backend, prompt, or frontend changes, rebuild with `docker compose up -d --build`.

## LLM Provider Setup

Create `.env` from `.env.example`:

```powershell
copy .env.example .env
```

### OpenAI-Compatible Provider

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your-api-key-here
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
REQUEST_TIMEOUT_SECONDS=120
```

### OpenRouter

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your-openrouter-key-here
OPENAI_MODEL=openai/gpt-4o-mini
OPENAI_BASE_URL=https://openrouter.ai/api/v1
REQUEST_TIMEOUT_SECONDS=120
```

### Ollama

```env
LLM_PROVIDER=ollama
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_URL=http://localhost:11434/api/generate
REQUEST_TIMEOUT_SECONDS=120
```

### Offline Fallback

```env
LLM_PROVIDER=fallback
REQUEST_TIMEOUT_SECONDS=120
```

Fallback mode keeps the app usable for demos, but responses are less natural than with a real LLM provider.

## Security And Runtime Settings

Common environment variables:

```env
API_AUTH_TOKEN=
RATE_LIMIT_CHAT_PER_MINUTE=20
RATE_LIMIT_REPORT_PER_MINUTE=10
RATE_LIMIT_DEMO_PER_MINUTE=5
TRUST_PROXY_HEADERS=0
USE_LANGGRAPH_DIALOG=0
```

If `API_AUTH_TOKEN` is set, protected API routes require a bearer token. For simple local demos, leave it empty. If you enable it during frontend development, also provide `VITE_API_AUTH_TOKEN` to the frontend build or dev server.

`USE_LANGGRAPH_DIALOG=1` enables the graph-backed dialog route. `USE_LANGGRAPH_DIALOG=0` uses the standard chat controller path.

## Main API Endpoints

- `GET /` - service health and LLM status.
- `GET /provider/status` - LLM provider status.
- `POST /session` - create a session.
- `GET /questions` - list interview questions.
- `POST /answer` - save a structured answer.
- `POST /chat` - chat interview endpoint.
- `GET /score/{session_id}` - calculate session score.
- `GET /report/{session_id}` - generate session report.
- `GET /session/{session_id}` - read session state.
- `POST /demo/load-profile` - load a demo profile.
- `GET /technical/flow` - return the technical workflow description.

## Testing

Backend tests:

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Backend lint subset:

```powershell
.\.venv\Scripts\python.exe -m ruff check backend/config.py backend/main.py backend/storage.py backend/security.py tests/test_workflow.py --ignore E501
```

Frontend:

```powershell
cd frontend-web
npm run lint
npm run build
```

## Typical User Flow

1. Open the frontend.
2. Start the readiness interview.
3. Answer questions in normal language.
4. Ask for clarification when needed.
5. Complete the interview.
6. Review the readiness report, findings, and action plan.
7. Use the evidence checklist to prepare follow-up work.

Example chat messages:

```text
What does MFA mean?
Show me an example.
We have backups, but we have not tested restore recently.
Generate the report.
```

## Project Status

This is an MVP/demo-ready defensive ransomware readiness assessment app.

Core principles:

- The official score is deterministic and backend-controlled.
- The LLM can explain and interpret, but it does not make scoring decisions.
- The project focuses on preparation, recovery, access control, monitoring, backup strategy, incident response, and employee security hygiene.
- Offensive, exploit, malware, or bypass requests should be blocked by guardrails.

