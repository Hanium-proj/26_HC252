"""Local worklist. No seed patients or fabricated results."""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path

from app.core.config import get_settings


def root() -> Path:
    path = Path(get_settings().data_dir)
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    return path


@contextmanager
def database():
    conn = sqlite3.connect(root() / "worklist.sqlite3", timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, payload TEXT NOT NULL)")
    conn.execute(
        "CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT, expires REAL)"
    )
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def now() -> str:
    return datetime.now(UTC).isoformat()


def put_case(case: dict) -> dict:
    with database() as db:
        db.execute(
            "INSERT OR REPLACE INTO cases VALUES (?, ?)",
            (case["id"], json.dumps(case, ensure_ascii=False)),
        )
    return case


def get_case(case_id: str) -> dict | None:
    with database() as db:
        row = db.execute("SELECT payload FROM cases WHERE id=?", (case_id,)).fetchone()
    return json.loads(row[0]) if row else None


def save_analysis(case_id: str, clinical_snapshot: dict, result: dict) -> None:
    """Atomically reject a result if current inputs or prior linkage changed."""
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        row = db.execute("SELECT payload FROM cases WHERE id=?", (case_id,)).fetchone()
        current = json.loads(row[0]) if row else None
        if not current or current["clinical"] != clinical_snapshot:
            raise ValueError("분석 중 입력이 변경되었습니다. 최신 입력으로 다시 분석해 주세요.")
        if clinical_snapshot.get("prior_id"):
            prior_row = db.execute(
                "SELECT payload FROM cases WHERE id=?", (clinical_snapshot["prior_id"],)
            ).fetchone()
            prior = json.loads(prior_row[0]) if prior_row else None
            if not prior or prior["clinical"].get("patient_ref") != clinical_snapshot.get(
                "patient_ref"
            ):
                raise ValueError("비교 검사의 환자 연결이 변경되었습니다. 다시 분석해 주세요.")
        current["analysis"] = result
        current["updated_at"] = now()
        db.execute(
            "UPDATE cases SET payload=? WHERE id=?",
            (json.dumps(current, ensure_ascii=False), case_id),
        )


def list_cases() -> list[dict]:
    with database() as db:
        rows = db.execute("SELECT payload FROM cases ORDER BY rowid DESC").fetchall()
    return [json.loads(row[0]) for row in rows]


def image_path(case_id: str, kind: str = "image") -> Path:
    # Never accept caller supplied paths, URLs, or patient filenames.
    import re

    if not re.fullmatch(r"[a-f0-9]{32}", case_id):
        raise ValueError("잘못된 검사 ID")
    if not re.fullmatch(r"(?:image|anatomy|lung-mask|cam-\d{1,2})", kind):
        raise ValueError("잘못된 영상 유형")
    return root() / f"{case_id}-{kind}.png"
