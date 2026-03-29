from __future__ import annotations

import logging
import os
from datetime import UTC, datetime, timedelta

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from .behavior import BehaviorService
from .database import create_db_and_tables, get_session
from .models import Session as WorkSession, Task
from .notifier import GoalContextService, NotificationConfigService, resolve_task_category
from .planner import PlannerService
from .reporting import ReportingService
from .schemas import (
    GoalContextSettingsResponse,
    GoalContextSettingsUpdate,
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


def _cors_origins() -> list[str]:
    default_origins = [
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:19006",
        "http://127.0.0.1:19006",
        "null",
    ]
    configured = str(os.getenv("BACKEND_CORS_ORIGINS", "")).strip()
    if configured:
        origins = [item.strip() for item in configured.split(",") if item.strip()]
        return list(dict.fromkeys([*default_origins, *origins]))

    return default_origins


app = FastAPI(title="Weekly Execution & Behavior Intelligence System")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

planner = PlannerService()
tracker = TrackerService()
behavior = BehaviorService()
notification_config = NotificationConfigService()
goal_context = GoalContextService()
reporting = ReportingService()
sync_service = SyncService()


def _http_error_from_value_error(exc: ValueError) -> HTTPException:
    message = str(exc)
    lower = message.lower()
    if "not found" in lower:
        return HTTPException(status_code=404, detail=message)
    if "already active" in lower:
        return HTTPException(status_code=409, detail=message)
    return HTTPException(status_code=400, detail=message)


def _current_week_period(reference: datetime | None = None) -> tuple[datetime, datetime]:
    now = reference or datetime.now()
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start = start - timedelta(days=start.weekday())
    end = start + timedelta(days=6, hours=23, minutes=59, seconds=59)
    return start, end


def _resolve_report_period(
    start: datetime | None,
    end: datetime | None,
) -> tuple[datetime, datetime]:
    if start is None and end is None:
        return _current_week_period()

    if start is None or end is None:
        raise HTTPException(
            status_code=400,
            detail="Provide both start and end query parameters for weekly reports.",
        )

    if end < start:
        raise HTTPException(
            status_code=400,
            detail="Weekly report end must be after start.",
        )

    return start, end


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
    goal_context.register_goal(db, resolve_task_category(task), task.long_term_goal)
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

    task = db.get(Task, payload.task_id)
    goal_context.register_goal(
        db,
        resolve_task_category(task),
        payload.goal_context,
    )
    sync_service.enqueue(db, "schedule", block.id, "create")
    return block


@app.get("/schedule")
def list_schedule(db: Session = Depends(get_session)):
    return planner.list_schedule(db)


@app.get("/sessions")
def list_sessions(db: Session = Depends(get_session)):
    return tracker.list_sessions(db)


def _delete_session_response(
    session_id: int,
    db: Session,
):
    try:
        deleted = tracker.delete_session(db, session_id)
    except ValueError as exc:
        raise _http_error_from_value_error(exc) from exc

    sync_service.enqueue(db, "session", deleted["session_id"], "delete")
    if deleted["schedule_block_id"]:
        sync_service.enqueue(db, "schedule", deleted["schedule_block_id"], "delete")
    return {
        "deleted": True,
        "session_id": deleted["session_id"],
        "schedule_block_id": deleted["schedule_block_id"],
    }


@app.delete("/sessions/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_session)):
    return _delete_session_response(session_id, db)


@app.delete("/session/{session_id}")
def delete_session_legacy(session_id: int, db: Session = Depends(get_session)):
    return _delete_session_response(session_id, db)


@app.put("/sessions/{session_id}")
def update_session(
    session_id: int,
    payload: ScheduleCreate,
    db: Session = Depends(get_session),
):
    logger.info(
        "Session update requested: session_id=%s task_id=%s start_time=%s end_time=%s",
        session_id,
        payload.task_id,
        payload.start_time,
        payload.end_time,
    )
    try:
        session = planner.update_planned_session(db, session_id, payload)
    except ValueError as exc:
        raise _http_error_from_value_error(exc) from exc

    task = db.get(Task, payload.task_id)
    goal_context.register_goal(
        db,
        resolve_task_category(task),
        payload.goal_context,
    )
    sync_service.enqueue(db, "session", session.id, "update")
    if session.schedule_block_id:
        sync_service.enqueue(db, "schedule", session.schedule_block_id, "update")
    logger.info(
        "Session update completed: session_id=%s schedule_block_id=%s",
        session.id,
        session.schedule_block_id,
    )
    return session


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
    tracker.sync_overdue_sessions(db)
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


@app.get("/settings/goal-context", response_model=GoalContextSettingsResponse)
def get_goal_context_settings(
    db: Session = Depends(get_session),
) -> GoalContextSettingsResponse:
    return goal_context.get_category_goals(db)


@app.put("/settings/goal-context")
def update_goal_context_settings(
    payload: GoalContextSettingsUpdate,
    db: Session = Depends(get_session),
):
    return goal_context.update(db, payload)


@app.get("/sync/pending")
def get_pending_sync(db: Session = Depends(get_session)):
    return sync_service.pending_events(db)


@app.get("/reports/weekly/json")
def get_weekly_report_json(
    start: datetime | None = None,
    end: datetime | None = None,
    db: Session = Depends(get_session),
):
    period_start, period_end = _resolve_report_period(start, end)
    tracker.sync_overdue_sessions(db, period_end)
    return reporting.weekly_report(db, period_start, period_end)
