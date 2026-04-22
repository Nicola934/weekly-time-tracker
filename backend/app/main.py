from __future__ import annotations

import logging
import os
from datetime import UTC, datetime, timedelta

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session

from .auth import get_user_for_token, login_user, register_user
from .behavior import BehaviorService
from .database import create_db_and_tables, get_session
from .models import Session as WorkSession, SessionStatus, Task, UserAccount
from .notifier import GoalContextService, NotificationConfigService, resolve_task_category
from .ownership import get_owned_record, require_owned_record
from .planner import PlannerService
from .reporting import ReportingService
from .schemas import (
    AuthSessionResponse,
    GoalContextSettingsResponse,
    GoalContextSettingsUpdate,
    NotificationConfigUpdate,
    ScheduleCreate,
    SessionEndRequest,
    SessionMissedRequest,
    SessionStartRequest,
    TaskCreate,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
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
auth_scheme = HTTPBearer(auto_error=False)


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


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(auth_scheme),
    db: Session = Depends(get_session),
) -> UserAccount:
    token = credentials.credentials if credentials else None
    user = get_user_for_token(db, token)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


@app.on_event("startup")
def on_startup() -> None:
    create_db_and_tables()
    logger.info("Database initialized")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/auth/register", response_model=AuthSessionResponse)
def register(payload: UserRegisterRequest, db: Session = Depends(get_session)) -> AuthSessionResponse:
    try:
        return register_user(db, payload)
    except ValueError as exc:
        raise _http_error_from_value_error(exc) from exc


@app.post("/auth/login", response_model=AuthSessionResponse)
def login(payload: UserLoginRequest, db: Session = Depends(get_session)) -> AuthSessionResponse:
    try:
        return login_user(db, payload)
    except ValueError as exc:
        raise _http_error_from_value_error(exc) from exc


@app.get("/auth/me", response_model=UserResponse)
def me(user: UserAccount = Depends(get_current_user)) -> UserResponse:
    return UserResponse(id=user.id, name=user.name, email=user.email)


@app.post("/tasks")
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_session),
    user: UserAccount = Depends(get_current_user),
) -> Task:
    task = planner.create_task(db, payload, user.id)
    goal_context.register_goal(db, resolve_task_category(task), task.long_term_goal, user.id)
    sync_service.enqueue(db, "task", task.id, "create", user.id)
    return task


@app.get("/tasks")
def list_tasks(
    db: Session = Depends(get_session),
    user: UserAccount = Depends(get_current_user),
) -> list[Task]:
    return planner.list_tasks(db, user.id)


@app.post("/schedule")
def create_schedule(
    payload: ScheduleCreate,
    db: Session = Depends(get_session),
    user: UserAccount = Depends(get_current_user),
):
    try:
        block, planned_session = planner.create_schedule_block(db, payload, user.id)
    except ValueError as exc:
        raise _http_error_from_value_error(exc) from exc

    task = get_owned_record(db, Task, payload.task_id, user.id)
    goal_context.register_goal(
        db,
        resolve_task_category(task),
        payload.goal_context,
        user.id,
    )
    sync_service.enqueue(db, "schedule", block.id, "create", user.id)
    sync_service.enqueue(db, "session", planned_session.id, "create", user.id)
    response = block.model_dump()
    response["session_id"] = planned_session.id
    response["session"] = planned_session
    return response


@app.get("/schedule")
def list_schedule(
    db: Session = Depends(get_session),
    user: UserAccount = Depends(get_current_user),
):
    return planner.list_schedule(db, user.id)


@app.get("/sessions")
def list_sessions(
    db: Session = Depends(get_session),
    user: UserAccount = Depends(get_current_user),
):
    return tracker.list_sessions(db, user.id)


def _delete_session_response(
    session_id: int,
    db: Session,
    user_id: int,
):
    try:
        deleted = tracker.delete_session(db, session_id, user_id)
    except ValueError as exc:
        raise _http_error_from_value_error(exc) from exc

    sync_service.enqueue(db, "session", deleted["session_id"], "delete", user_id)
    if deleted["schedule_block_id"]:
        sync_service.enqueue(db, "schedule", deleted["schedule_block_id"], "delete", user_id)
    return {
        "deleted": True,
        "session_id": deleted["session_id"],
        "schedule_block_id": deleted["schedule_block_id"],
    }


@app.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    db: Session = Depends(get_session),
    user: UserAccount = Depends(get_current_user),
):
    return _delete_session_response(session_id, db, user.id)


@app.delete("/session/{session_id}")
def delete_session_legacy(
    session_id: int,
    db: Session = Depends(get_session),
    user: UserAccount = Depends(get_current_user),
):
    return _delete_session_response(session_id, db, user.id)


@app.put("/sessions/{session_id}")
def update_session(
    session_id: int,
    payload: ScheduleCreate,
    db: Session = Depends(get_session),
    user: UserAccount = Depends(get_current_user),
):
    logger.info(
        "Session update requested: session_id=%s task_id=%s start_time=%s end_time=%s",
        session_id,
        payload.task_id,
        payload.start_time,
        payload.end_time,
    )
    try:
        session = planner.update_planned_session(db, session_id, payload, user.id)
    except ValueError as exc:
        raise _http_error_from_value_error(exc) from exc

    task = get_owned_record(db, Task, payload.task_id, user.id)
    goal_context.register_goal(
        db,
        resolve_task_category(task),
        payload.goal_context,
        user.id,
    )
    sync_service.enqueue(db, "session", session.id, "update", user.id)
    if session.schedule_block_id:
        sync_service.enqueue(db, "schedule", session.schedule_block_id, "update", user.id)
    logger.info(
        "Session update completed: session_id=%s schedule_block_id=%s",
        session.id,
        session.schedule_block_id,
    )
    return session


@app.post("/sessions/start")
def start_session(
    payload: SessionStartRequest,
    db: Session = Depends(get_session),
    user: UserAccount = Depends(get_current_user),
):
    try:
        session = tracker.start_session(db, payload, user.id)
    except ValueError as exc:
        raise _http_error_from_value_error(exc) from exc

    sync_service.enqueue(db, "session", session.id, "start", user.id)
    return session


@app.post("/sessions/end")
def end_session(
    payload: SessionEndRequest,
    db: Session = Depends(get_session),
    user: UserAccount = Depends(get_current_user),
):
    try:
        session = tracker.end_session(db, payload, user.id)
    except ValueError as exc:
        raise _http_error_from_value_error(exc) from exc

    sync_service.enqueue(db, "session", session.id, "end", user.id)
    return session


@app.post("/sessions/missed")
def missed_session(
    payload: SessionMissedRequest,
    db: Session = Depends(get_session),
    user: UserAccount = Depends(get_current_user),
):
    try:
        item = behavior.record_missed_session(db, payload, user.id)
    except ValueError as exc:
        raise _http_error_from_value_error(exc) from exc

    session = require_owned_record(
        db,
        WorkSession,
        payload.session_id,
        user.id,
        f"Session not found for id {payload.session_id}",
    )
    if session.status != SessionStatus.missed:
        session.status = SessionStatus.missed
        db.add(session)
        db.commit()
        db.refresh(session)

    sync_service.enqueue(db, "habit", item.id, "missed", user.id)
    return session


@app.get("/habits")
def get_habits(
    db: Session = Depends(get_session),
    user: UserAccount = Depends(get_current_user),
):
    tracker.sync_overdue_sessions(db, user.id)
    end = datetime.now(UTC)
    start = end - timedelta(days=7)
    return behavior.weekly_patterns(db, start, end, user.id)


@app.get("/notifications/templates")
def get_notification_templates(
    db: Session = Depends(get_session),
    user: UserAccount = Depends(get_current_user),
):
    return notification_config.get_or_create(db, user.id)


@app.put("/notifications/templates")
def update_notification_templates(
    payload: NotificationConfigUpdate,
    db: Session = Depends(get_session),
    user: UserAccount = Depends(get_current_user),
):
    return notification_config.update(db, payload, user.id)


@app.get("/settings/goal-context", response_model=GoalContextSettingsResponse)
def get_goal_context_settings(
    db: Session = Depends(get_session),
    user: UserAccount = Depends(get_current_user),
) -> GoalContextSettingsResponse:
    return goal_context.get_category_goals(db, user.id)


@app.put("/settings/goal-context")
def update_goal_context_settings(
    payload: GoalContextSettingsUpdate,
    db: Session = Depends(get_session),
    user: UserAccount = Depends(get_current_user),
):
    return goal_context.update(db, payload, user.id)


@app.get("/sync/pending")
def get_pending_sync(
    after_event_id: int | None = None,
    db: Session = Depends(get_session),
    user: UserAccount = Depends(get_current_user),
):
    return sync_service.pending_events(db, user.id, after_event_id)


@app.get("/reports/weekly/json")
def get_weekly_report_json(
    start: datetime | None = None,
    end: datetime | None = None,
    db: Session = Depends(get_session),
    user: UserAccount = Depends(get_current_user),
):
    period_start, period_end = _resolve_report_period(start, end)
    tracker.sync_overdue_sessions(db, user.id, period_end)
    return reporting.weekly_report(db, period_start, period_end, user.id)
