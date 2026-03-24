from __future__ import annotations

import json
from pathlib import Path

from sqlmodel import Session

from .database import create_db_and_tables, engine
from .models import ScheduleBlock, Session as WorkSession, Task


def load_seed_data(seed_path: str = "sample_data/seed.json") -> None:
    create_db_and_tables()
    payload = json.loads(Path(seed_path).read_text())
    with Session(engine) as db:
        for task_payload in payload.get("tasks", []):
            db.add(Task(**task_payload))
        db.commit()
        for block_payload in payload.get("schedule", []):
            db.add(ScheduleBlock(**block_payload))
        db.commit()
        for session_payload in payload.get("sessions", []):
            db.add(WorkSession(**session_payload))
        db.commit()


if __name__ == "__main__":
    load_seed_data()
