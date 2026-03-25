from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from .behavior import BehaviorService
from .database import create_db_and_tables, get_session
from .models import Session as WorkSession, Task
from .notifier import NotificationConfigService
from .planner import PlannerService
from .schemas import (
    NotificationConfigUpdate,
    ScheduleCreate,
    SessionEndRequest,
    SessionMissedRequest,
    SessionStartRequest,
    TaskCreate,
)
from .sync import SyncService
from .tracker import TrackerService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Weekly Execution & Behavior Intelligence System")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:19006",
        "http://127.0.0.1:19006",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

planner = PlannerService()
tracker = TrackerService()
behavior = BehaviorService()
notification_config = NotificationConfigService()
sync_service = SyncService()


def _http_error_from_value_error(exc: ValueError) -> HTTPException:
    message = str(exc)
    lower = message.lower()
    if "not found" in lower:
        return HTTPException(status_code=404, detail=message)
    if "already active" in lower:
        return HTTPException(status_code=409, detail=message)
    return HTTPException(status_code=400, detail=message)


@app.on_event("startup")
def on_startup() -> None:
    create_db_and_tables()
    logger.info("Database initialized")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/tasks")
def create_task(payload: TaskCreate, db: Session = Depends(get_session)) -> Task:
    task = planner.create_task(db, payload)
    sync_service.enqueue(db, "task", task.id, "create")
    return task


@app.get("/tasks")
def list_tasks(db: Session = Depends(get_session)) -> list[Task]:
    return planner.list_tasks(db)


@app.post("/schedule")
def create_schedule(payload: ScheduleCreate, db: Session = Depends(get_session)):
    try:
        block = planner.create_schedule_block(db, payload)
    except ValueError as exc:
        raise _http_error_from_value_error(exc) from exc

    sync_service.enqueue(db, "schedule", block.id, "create")
    return block


@app.get("/schedule")
def list_schedule(db: Session = Depends(get_session)):
    return planner.list_schedule(db)


@app.get("/sessions")
def list_sessions(db: Session = Depends(get_session)):
    return tracker.list_sessions(db)


@app.post("/sessions/start")
def start_session(payload: SessionStartRequest, db: Session = Depends(get_session)):
    try:
        session = tracker.start_session(db, payload)
    except ValueError as exc:
        raise _http_error_from_value_error(exc) from exc

    sync_service.enqueue(db, "session", session.id, "start")
    return session


@app.post("/sessions/end")
def end_session(payload: SessionEndRequest, db: Session = Depends(get_session)):
    try:
        session = tracker.end_session(db, payload)
    except ValueError as exc:
        raise _http_error_from_value_error(exc) from exc

    sync_service.enqueue(db, "session", session.id, "end")
    return session


@app.post("/sessions/missed")
def missed_session(payload: SessionMissedRequest, db: Session = Depends(get_session)):
    try:
        item = behavior.record_missed_session(db, payload)
    except ValueError as exc:
        raise _http_error_from_value_error(exc) from exc

    session = db.get(WorkSession, payload.session_id)
    task = db.get(Task, session.task_id) if session else None
    sync_service.enqueue(db, "habit", item.id, "missed")
    return {
        "habit": item,
        "prompt": behavior.missed_session_prompt(session, task) if session else None,
    }


@app.get("/habits")
def get_habits(db: Session = Depends(get_session)):
    end = datetime.now(UTC)
    start = end - timedelta(days=7)
    return behavior.weekly_patterns(db, start, end)


@app.get("/notifications/templates")
def get_notification_templates(db: Session = Depends(get_session)):
    return notification_config.get_or_create(db)


@app.put("/notifications/templates")
def update_notification_templates(
    payload: NotificationConfigUpdate,
    db: Session = Depends(get_session),
):
    return notification_config.update(db, payload)


@app.get("/sync/pending")
def get_pending_sync(db: Session = Depends(get_session)):
    return sync_service.pending_events(db)
