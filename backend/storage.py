from __future__ import annotations

import json
import os
import sqlite3
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

from backend.config import BASE_DIR


def _resolve_db_path() -> Path:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if database_url.startswith("sqlite:///"):
        parsed = urlparse(database_url)
        raw_path = unquote(parsed.path)
        if database_url.startswith("sqlite:////"):
            return Path(raw_path)
        return BASE_DIR / raw_path.lstrip("/")
    return BASE_DIR / "sessions.db"


DB_PATH = _resolve_db_path()


class SessionConflictError(RuntimeError):
    """Raised when concurrent writes update the same session version."""


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
    version: int = 0
    created_at: str = ""
    updated_at: str = ""


def _utc_now() -> str:
    return datetime.now(UTC).isoformat()


def _ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            session_id  TEXT PRIMARY KEY,
            data        TEXT NOT NULL,
            version     INTEGER NOT NULL DEFAULT 1,
            created_at  TEXT NOT NULL DEFAULT '',
            updated_at  TEXT NOT NULL DEFAULT ''
        )
        """
    )
    existing_columns = {
        row[1] for row in conn.execute("PRAGMA table_info(sessions)").fetchall()
    }
    migrations = {
        "version": "ALTER TABLE sessions ADD COLUMN version INTEGER NOT NULL DEFAULT 1",
        "created_at": "ALTER TABLE sessions ADD COLUMN created_at TEXT NOT NULL DEFAULT ''",
        "updated_at": "ALTER TABLE sessions ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''",
    }
    for column, statement in migrations.items():
        if column not in existing_columns:
            conn.execute(statement)

    timestamp = _utc_now()
    conn.execute(
        """
        UPDATE sessions
        SET created_at = CASE WHEN created_at = '' THEN ? ELSE created_at END,
            updated_at = CASE WHEN updated_at = '' THEN ? ELSE updated_at END
        WHERE created_at = '' OR updated_at = ''
        """,
        (timestamp, timestamp),
    )


def _get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=10000")
    _ensure_schema(conn)
    conn.commit()
    return conn


def _serialize_state(
    state: SessionState,
    version: int,
    created_at: str,
    updated_at: str,
) -> str:
    payload = asdict(state)
    payload["version"] = version
    payload["created_at"] = created_at
    payload["updated_at"] = updated_at
    return json.dumps(payload, ensure_ascii=False)


def save_session(state: SessionState) -> None:
    """Persist session to SQLite with optimistic locking."""
    with _get_conn() as conn:
        if state.version <= 0:
            created_at = state.created_at or _utc_now()
            updated_at = _utc_now()
            version = 1
            conn.execute(
                """
                INSERT OR REPLACE INTO sessions(session_id, data, version, created_at, updated_at)
                VALUES(?,?,?,?,?)
                """,
                (
                    state.session_id,
                    _serialize_state(state, version, created_at, updated_at),
                    version,
                    created_at,
                    updated_at,
                ),
            )
            state.version = version
            state.created_at = created_at
            state.updated_at = updated_at
            return

        next_version = state.version + 1
        created_at = state.created_at or _utc_now()
        updated_at = _utc_now()
        cursor = conn.execute(
            """
            UPDATE sessions
            SET data = ?, version = ?, updated_at = ?
            WHERE session_id = ? AND version = ?
            """,
            (
                _serialize_state(state, next_version, created_at, updated_at),
                next_version,
                updated_at,
                state.session_id,
                state.version,
            ),
        )
        if cursor.rowcount != 1:
            raise SessionConflictError(
                f"Session {state.session_id} was updated concurrently; reload before saving again."
            )
        state.version = next_version
        state.created_at = created_at
        state.updated_at = updated_at


def load_session(session_id: str) -> SessionState | None:
    """Load session from SQLite."""
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT data, version, created_at, updated_at FROM sessions WHERE session_id=?",
            (session_id,),
        ).fetchone()
    if row is None:
        return None
    d = json.loads(row[0])
    d["version"] = row[1]
    d["created_at"] = row[2]
    d["updated_at"] = row[3]
    state = SessionState(**d)
    return state


def get_or_create_session(session_id: str) -> SessionState:
    state = load_session(session_id)
    if state is None:
        state = SessionState(session_id=session_id)
        save_session(state)
    return state
