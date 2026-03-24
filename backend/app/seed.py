from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from sqlmodel import Session

from .database import create_db_and_tables, engine
from .models import ScheduleBlock, Session as WorkSession, Task


def _parse_dt(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    if "T" not in value:
        return value
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return value


def _convert_datetimes(payload: dict[str, Any], fields: list[str]) -> dict[str, Any]:
    converted = payload.copy()
    for field in fields:
        if field in converted:
            converted[field] = _parse_dt(converted[field])
    return converted


def load_seed_data(seed_path: str = "sample_data/seed.json") -> None:
    create_db_and_tables()

    payload = json.loads(Path(seed_path).read_text(encoding="utf-8"))

    with Session(engine) as db:
        for task_payload in payload.get("tasks", []):
            db.add(Task(**task_payload))
        db.commit()

        for block_payload in payload.get("schedule", []):
            converted_block = _convert_datetimes(
                block_payload,
                ["start_time", "end_time"],
            )
            db.add(ScheduleBlock(**converted_block))
        db.commit()

        for session_payload in payload.get("sessions", []):
            converted_session = _convert_datetimes(
                session_payload,
                ["planned_start", "planned_end", "actual_start", "actual_end"],
            )
            db.add(WorkSession(**converted_session))
        db.commit()


if __name__ == "__main__":
    load_seed_data()