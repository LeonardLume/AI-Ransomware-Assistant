# AI Ransomware Readiness Assistant

**An AI security-assessment workspace for ransomware readiness: agent-guided controls, backend-owned scoring, evidence guidance, and an IT-ready action plan.**

```powershell
copy .env.example .env
start.bat
```

Open `http://127.0.0.1:5173` and start answering.

This project is for teams that want more than a questionnaire. It keeps the structured readiness controls, but wraps them in an AI Security Agent that can explain controls, help classify answers, request evidence, and prepare a report your IT team, MSP, leadership, or client can actually review.

The agentic design is inspired by cybersecurity agent frameworks such as CAI: multiple roles, tool boundaries, guardrails, tracing, and human confirmation. Offensive automation is not enabled. The product is designed as an authorized defensive assessor, not an exploit runner.

## Why It Exists

| You need | What this app gives you |
| --- | --- |
| A serious security-assessment workflow | AI-guided controls instead of a plain questionnaire |
| Consistent scoring | Deterministic backend rules from `data/scoring_rules.json` |
| AI help that understands security context | Clarification, answer classification, evidence guidance, and advisory replies |
| A usable outcome | Report, findings, action plan, and evidence checklist |
| Safe agentic behavior | Guardrails for prompt injection, unsafe requests, and score tampering |

## What You Get

| Part | What it does |
| --- | --- |
| `backend/` | FastAPI API, interview flow, scoring, reports, storage, guardrails |
| `frontend-web/` | Main React + Vite web app |
| `frontend/` | Legacy Streamlit UI |
| `data/` | Questions, scoring rules, demo profiles, checklists |
| `prompts/` | LLM prompts for chat, clarification, advisory, and reporting |
| `tests/` | Backend regression and unit tests |

## Security Agent Layer

The assistant is moving from a simple interview into a bounded AI security agent.

| Agent role | What it does |
| --- | --- |
| Assessment Guide | Runs the interview and keeps the user on the current readiness control |
| Answer Classifier | Maps natural-language answers to `yes / partial / no / unsure` only after validation |
| Evidence Advisor | Suggests documents, logs, screenshots, or policies that would support the answer |
| Source Researcher | Grounds explanations in curated defensive sources and future allowlisted web research |
| Report Writer | Turns backend-owned scores and findings into a concise report and action plan |
| Safety Reviewer | Blocks offensive or unsafe requests before scoring state changes |

Available profile endpoint:

```text
GET /security-agent/profile
GET /security-agent/cai
```

Important boundary: this product does not enable exploit execution, credential theft, malware generation, MFA bypass, persistence, evasion, or unauthorized scanning. Future external checks should be read-only, allowlisted, and explicitly authorized by the asset owner.

### Optional CAI Bridge

CAI is added as an optional defensive bridge, not as the default chat engine. This protects the existing interview, scoring, report cache, and fallback behavior.

```powershell
python -m venv .venv-cai
.\.venv-cai\Scripts\pip install -r requirements-cai.txt
```

Then enable only metadata-level integration:

```env
CAI_AGENT_ENABLED=1
CAI_ALLOW_TOOL_EXECUTION=0
```

The bridge currently exposes status and a safe capability manifest. It does not execute CAI tools against targets and does not replace `/chat`, `/questions`, scoring, or fallback mode.

## Quick Start

### Windows

Use a real model:

```powershell
copy .env.example .env
start.bat
```

Use offline fallback mode:

```powershell
copy .env.example .env
powershell -Command "(Get-Content .env) -replace 'LLM_PROVIDER=openai','LLM_PROVIDER=fallback' -replace 'OPENAI_API_KEY=your-api-key-here','OPENAI_API_KEY=' | Set-Content .env"
start.bat
```

### macOS / Linux

Use a real model:

```bash
cp .env.example .env
chmod +x start.sh scripts/dev.sh
./start.sh
```

Use offline fallback mode:

```bash
cp .env.example .env
python - <<'PY'
from pathlib import Path
path = Path(".env")
text = path.read_text()
text = text.replace("LLM_PROVIDER=openai", "LLM_PROVIDER=fallback")
text = text.replace("OPENAI_API_KEY=your-api-key-here", "OPENAI_API_KEY=")
path.write_text(text)
PY
chmod +x start.sh scripts/dev.sh
./start.sh
```

### Open After Start

| URL | Purpose |
| --- | --- |
| `http://127.0.0.1:5173` | Frontend |
| `http://127.0.0.1:8000` | Backend |
| `http://127.0.0.1:8000/docs` | API docs |
| `http://127.0.0.1:8000/provider/status` | LLM provider status |

## How To Run It

### Recommended

| Command | What happens |
| --- | --- |
| `start.bat` | Windows full app: backend + frontend |
| `./start.sh` | macOS/Linux full app: backend + frontend |
| `start_public.bat` | Windows full app + temporary public tunnel |
| `./start_public.sh` | macOS/Linux full app + temporary public tunnel |

### Run Backend Only

```powershell
run_backend.bat
```

Or manually:

```powershell
.\.venv\Scripts\python.exe -m backend.serve --host 127.0.0.1 --port 8000
```

### Run Frontend Only

```powershell
run_frontend.bat
```

Or manually:

```powershell
cd frontend-web
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

## Model Setup

### OpenAI

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your-api-key-here
OPENAI_MODEL=gpt-5.4-mini
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

### Fallback

```env
LLM_PROVIDER=fallback
REQUEST_TIMEOUT_SECONDS=120
```

## Docker

```powershell
copy .env.production.example .env
docker compose up -d --build
```

Open `http://localhost`.

For a shared or public deployment, set `API_AUTH_TOKEN` in `.env` and pass the same value to the frontend as `VITE_API_AUTH_TOKEN` at build time. Keep `API_AUTH_TOKEN` empty only for local demos on a trusted machine.

| Docker piece | Role |
| --- | --- |
| Caddy | Serves the built frontend |
| FastAPI | Handles scoring, chat, reports, and sessions |
| `backend_data` volume | Keeps backend runtime data between restarts |

## How The Chat Behaves

| Chat behavior | Result |
| --- | --- |
| Quick answer buttons | Save structured `yes / partial / no / unsure` immediately |
| Help decide / Evidence / Good state buttons | Ask the agent for guidance without changing the official answer |
| Free-text answer | LLM proposes intent and normalized answer |
| Ambiguous free-text | Backend asks for confirmation instead of auto-saving |
| Clarification request | Assistant explains the current question |
| General advisory question | Assistant gives defensive guidance without changing score |
| Prompt injection or offensive request | Request is refused before scoring logic is touched |

The model does not calculate the official score. It does not mutate score state directly. It does not rewrite `questions.json` or `scoring_rules.json`.

## Assessment methodology

| File / module | Role |
| --- | --- |
| `data/questions.json` | Defines the interview questions, domains, source mappings, and per-question methodology notes |
| `data/scoring_rules.json` | Defines the official point values for `yes / partial / no / unsure` |
| `data/scoring_rationale.json` | Explains why each saved answer raises, lowers, or withholds points |
| `data/source_registry.json` | Maps stable source IDs to named frameworks and guidance |
| `data/assessment_methodology.json` | Versions the assessment methodology and its scoring principles |
| `backend/scoring.py` | Calculates the official score deterministically and explains awarded/lost points |

The official score is backend-owned. AI can explain questions and help normalize answers, but it does not calculate or alter the score.

MITRE ATT&CK mappings are included as contextual traceability only. They are not a full attack simulation. The threat overlay is planned and versioned, but it does not affect the score yet.

Validate the assessment data:

```powershell
python scripts/validate_assessment_data.py
```

## Testing

Backend:

```powershell
py -m pytest
```

Frontend:

```powershell
cd frontend-web
npm run build
```

## Author

[![Author: Leonard Lume](https://img.shields.io/badge/Author-Leonard%20Lume-111827?style=for-the-badge&logo=github)](https://github.com/LeonardLume)
[![Project Repo](https://img.shields.io/badge/GitHub-AI--Ransomware--Assistant-2563eb?style=for-the-badge&logo=github)](https://github.com/LeonardLume/AI-Ransomware-Assistant)
