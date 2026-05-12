# Ransomware Readiness AI Assistant MVP

Python MVP for a client-facing ransomware-readiness self-assessment.

The app keeps the assessment controlled and explainable:

- Streamlit frontend fallback
- Vite + React TypeScript frontend in `frontend-web/`
- FastAPI backend
- controlled AI interview
- `data/questions.json` as the interview source of truth
- `data/scoring_rules.json` for deterministic scoring
- provider-agnostic LLM layer: OpenAI-compatible API, Ollama, or fallback
- demo profiles and smoke tests

The LLM helps understand free text, explain concepts, and word the report. The readiness score is always rule-based.

## Defensive skills layer

The project now includes a local `skills/` directory with defensive ransomware-readiness playbooks. These files are inspired by structured AI-agent skill formats such as YAML frontmatter, `When to Use`, `What to Ask`, workflow-style guidance, evidence checklists, and NIST CSF mappings.

The skills improve:

- client explanations during the AI interview
- follow-up questions and practical evidence examples
- report recommendations and top-risk context
- prioritized action plan items
- evidence checklist items for readiness proof

Skills are mapped to assessment domains:

- `backups` -> `ransomware-backup-strategy`, `ransomware-recovery`
- `mfa_access` / `mfa` -> `mfa-access-control`
- `patching` -> `patch-management`
- `admin_rights` -> `admin-rights-review`
- `incident_response` -> `incident-response-plan`, `ransomware-response`, `tabletop-exercise`

Important: skills do **not** calculate or modify the numeric score. Scoring still comes only from `data/scoring_rules.json`; skills add explanation, recommendations, action plan items, evidence requirements, and NIST CSF references.

All local skills are marked `safe_use: defensive_only`. The assistant refuses requests for offensive hacking, exploitation, malware creation or analysis instructions, MFA bypass, credential theft, persistence, evasion, or red-team execution, and redirects to defensive readiness advice.

## Run

Install dependencies:

```powershell
cd ransomware-readiness-mvp
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Backend:

```powershell
python -m uvicorn backend.main:app --reload
```

Old Streamlit frontend:

```powershell
streamlit run frontend/app.py
```

New React frontend:

```powershell
cd frontend-web
npm install
npm run dev
```

Open:

- New React frontend: http://localhost:5173
- Old Streamlit frontend: http://localhost:8501
- Backend docs: http://127.0.0.1:8000/docs
- LLM status: http://127.0.0.1:8000/llm/status

## Enable OpenAI

Create a local `.env` from `.env.example` and paste your key:

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your-api-key-here
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
REQUEST_TIMEOUT_SECONDS=120
```

Do not commit `.env`. It is ignored by `.gitignore`.

For the React frontend, create `frontend-web/.env` from `frontend-web/.env.example` if the backend URL differs:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## Enable Ollama

```env
LLM_PROVIDER=ollama
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_URL=http://localhost:11434/api/generate
REQUEST_TIMEOUT_SECONDS=120
```

Start Ollama and make sure the model is available before running the backend.

## Fallback mode

Fallback mode works without API keys or local models:

```env
LLM_PROVIDER=fallback
REQUEST_TIMEOUT_SECONDS=120
```

Fallback keeps demos reliable. It uses deterministic explanations and keyword-based extraction for common answer words such as `jah`, `ei`, `osaliselt`, `ei tea`, `yes`, `no`, `partial`, and `unsure`.

## Frontend migration

The Streamlit UI remains available as a fallback in `frontend/app.py`.

The new TypeScript UI lives in `frontend-web/`. It is a Vite + React client inspired by mature assistant workspaces: chat thread, local session list, status panel, artifact tabs, provider/fallback badges, processing timelines, and technical transparency views.

The React frontend is presentation only:

- It calls FastAPI for questions, sessions, structured answers, scoring, reports, skills, action plans, evidence, and demos.
- It does not rewrite or duplicate scoring logic.
- It does not let the LLM or browser calculate the official score.
- Browser `localStorage` stores only a convenience session list; backend `session_id` remains the source of truth.

React artifact tabs:

1. `Readiness Report` - score metric, risk level, completion, domain bars, top risks, next steps, summary.
2. `Action Plan` - backend `action_plan` cards when available.
3. `Evidence Binder` - backend evidence checklist, with safe placeholders if missing.
4. `Ransomware Playbook` - defensive playbook view built from backend recommendations.
5. `Technical JSON` - raw session/report/provider/debug payloads outside the normal chat thread.



## How the LLM interview works

`POST /chat` supports two modes at the same time:

1. Controlled interview:
   - The assistant asks predefined questions from `data/questions.json`.
   - The user answers in free text.
   - The LLM or fallback extracts structured answers.
   - The backend validates `question_id` and allowed options.
   - Scoring uses `data/scoring_rules.json`.

2. Client-facing advisory chat:
   - The user can ask clarification questions during the interview.
   - The assistant explains cybersecurity concepts simply.
   - The assistant includes relevant defensive skill context based on the current or requested domain.
   - The assistant suggests practical evidence, such as the latest restore test date and result for backup questions.
   - Clarification questions do not save scoring answers.
   - The assistant returns to the current interview question.

Each user message is classified as:

- `answer`
- `clarification`
- `report_request`
- `smalltalk`
- `unknown`

Expected chat response fields include:

- `session_id`
- `assistant_message`
- `chat_history`
- `intent`
- `extracted_answers`
- `current_question`
- `completion_rate`
- `is_complete`
- `score`
- `report`
- `action_plan` in report payloads
- `evidence_checklist` in report payloads
- `skill_references` in report payloads
- `provider`
- `used_fallback`

## Prompt files

- `prompts/interview_system_prompt.txt`
- `prompts/extraction_prompt.txt`
- `prompts/advisor_prompt.txt`
- `prompts/followup_prompt.txt`
- `prompts/report_prompt.txt`

## Demo script

Suggested live demo:

1. Start the interview.
2. Ask: `Mida tähendab MFA?`
3. Answer: `Meil on varukoopiad olemas, aga taastamist pole testitud.`
4. Load the `weak_sme` demo profile.
5. Show the report.
6. Open `Tehniline läbipaistvus` and explain that scoring is deterministic.

Other useful prompts:

```text
Miks peab varukoopia taastamist testima?
Kas see on suur probleem, kui meil IR plaani pole?
Selgita seda lihtsamalt juhile.
Koosta raport praeguste vastuste põhjal.
```

## API

Existing endpoints remain:

- `GET /`
- `POST /session`
- `GET /questions`
- `POST /answer`
- `GET /score/{session_id}`
- `GET /report/{session_id}`
- `POST /chat`

Additional helper endpoint:

- `GET /llm/status`
- `GET /provider/status`
- `GET /session/{session_id}`
- `POST /demo/load-profile`
- `GET /technical/flow`

## Tests

```powershell
pytest
python scripts/smoke_test.py
```

Frontend checks:

```powershell
cd frontend-web
npm install
npm run build
```

Manual frontend checklist:

- Backend health is visible in the header.
- Start assessment creates a backend session.
- Ask `Mida tähendab MFA?`.
- Answer `Meil on varukoopiad olemas, aga taastamist pole testitud.`
- Progress/status updates from the backend.
- Load weak SME demo.
- Report renders clearly.
- Provider/fallback status is visible.
- Technical transparency tab is visible.
- Backend down state shows an error and retry control gracefully.

## Limits

- This is not a full security audit.
- It does not scan infrastructure.
- The score depends on user-provided answers.
- The LLM must not invent the score.
- Defensive skills support recommendations and evidence only; they do not calculate score.
- Offensive hacking, exploit workflows, malware instructions, credential theft, persistence, evasion, and MFA bypass guidance are out of scope.
- Fallback extraction is robust enough for demo use, not a complete natural-language understanding system.
