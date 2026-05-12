from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from backend.config import BASE_DIR

DB_PATH = BASE_DIR / "sessions.db"

# In-memory cache so we don't hit SQLite on every attribute access
SESSIONS: dict[str, "SessionState"] = {}


@dataclass
class SessionState:
    session_id: str
    org_info: dict[str, Any] = field(default_factory=dict)
    answers: dict[str, dict[str, Any]] = field(default_factory=dict)
    followups: list[dict[str, Any]] = field(default_factory=list)
    events: list[dict[str, Any]] = field(default_factory=list)
    chat_history: list[dict[str, Any]] = field(default_factory=list)
    unclear_question_ids: list[str] = field(default_factory=list)
    current_question_id: str | None = None
    current_domain: str | None = None
    interview_complete: bool = False
    completion_mode: str | None = None


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            data       TEXT NOT NULL
        )
        """
    )
    conn.commit()
    return conn


def save_session(state: SessionState) -> None:
    """Persist session to SQLite and update in-memory cache."""
    SESSIONS[state.session_id] = state
    data = json.dumps(asdict(state), ensure_ascii=False)
    with _get_conn() as conn:
        conn.execute(
            "INSERT INTO sessions(session_id, data) VALUES(?,?) "
            "ON CONFLICT(session_id) DO UPDATE SET data=excluded.data",
            (state.session_id, data),
        )


def load_session(session_id: str) -> SessionState | None:
    """Load session from cache or SQLite."""
    if session_id in SESSIONS:
        return SESSIONS[session_id]
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT data FROM sessions WHERE session_id=?", (session_id,)
        ).fetchone()
    if row is None:
        return None
    d = json.loads(row[0])
    state = SessionState(**d)
    SESSIONS[session_id] = state
    return state


def get_or_create_session(session_id: str) -> SessionState:
    state = load_session(session_id)
    if state is None:
        state = SessionState(session_id=session_id)
        save_session(state)
    return state
