from __future__ import annotations

import logging
from datetime import datetime, timedelta

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, Response
from sqlmodel import Session

from .advisor import AdvisorService
from .behavior import BehaviorService
from .database import create_db_and_tables, get_session
from .metrics import MetricsService
from .models import Session as WorkSession, Task
from .notifier import NotificationConfigService
from .planner import PlannerService
from .reporting import ReportingService
from .schemas import (
    AdvisoryResponse,
    MetricsResponse,
    NotificationConfigUpdate,
    ScheduleCreate,
    SessionEndRequest,
    SessionMissedRequest,
    SessionStartRequest,
    TaskCreate,
    WeeklyReportResponse,
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
metrics = MetricsService()
behavior = BehaviorService()
advisor = AdvisorService()
reporting = ReportingService()
notification_config = NotificationConfigService()
sync_service = SyncService()


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
    block = planner.create_schedule_block(db, payload)
    sync_service.enqueue(db, "schedule", block.id, "create")
    return block


@app.get("/schedule")
def list_schedule(db: Session = Depends(get_session)):
    return planner.list_schedule(db)


@app.post("/sessions/start")
def start_session(payload: SessionStartRequest, db: Session = Depends(get_session)):
    try:
        session = tracker.start_session(db, payload)
        sync_service.enqueue(db, "session", session.id, "start")
        return session
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/sessions/end")
def end_session(payload: SessionEndRequest, db: Session = Depends(get_session)):
    try:
        session = tracker.end_session(db, payload)
        sync_service.enqueue(db, "session", session.id, "end")
        return session
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/sessions/missed")
def missed_session(payload: SessionMissedRequest, db: Session = Depends(get_session)):
    try:
        item = behavior.record_missed_session(db, payload)
        session = db.get(WorkSession, payload.session_id)
        task = db.get(Task, session.task_id) if session else None
        sync_service.enqueue(db, "habit", item.id, "missed")
        return {
            "habit": item,
            "prompt": behavior.missed_session_prompt(session, task) if session else None,
        }
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/sessions")
def list_sessions(db: Session = Depends(get_session)):
    return tracker.list_sessions(db)


@app.get("/metrics", response_model=MetricsResponse)
def get_metrics(db: Session = Depends(get_session)) -> MetricsResponse:
    end = datetime.utcnow()
    start = end - timedelta(days=7)
    return metrics.compute_metrics(db, start, end)


@app.get("/reports/weekly", response_model=WeeklyReportResponse)
def get_weekly_report(db: Session = Depends(get_session)) -> WeeklyReportResponse:
    end = datetime.utcnow()
    start = end - timedelta(days=7)
    return reporting.weekly_report(db, start, end)


@app.get("/reports/weekly/text")
def get_weekly_report_text(db: Session = Depends(get_session)) -> PlainTextResponse:
    end = datetime.utcnow()
    start = end - timedelta(days=7)
    report = reporting.weekly_report(db, start, end)
    return PlainTextResponse(reporting.export_text(report))


@app.get("/reports/weekly/json")
def get_weekly_report_json(db: Session = Depends(get_session)) -> JSONResponse:
    end = datetime.utcnow()
    start = end - timedelta(days=7)
    report = reporting.weekly_report(db, start, end)
    return JSONResponse(content=report.model_dump(mode="json"))


@app.get("/reports/weekly/excel")
def get_weekly_report_excel(db: Session = Depends(get_session)) -> Response:
    end = datetime.utcnow()
    start = end - timedelta(days=7)
    report = reporting.weekly_report(db, start, end)
    content = reporting.export_excel(report)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="weekly-report.xlsx"'},
    )


@app.get("/advisory", response_model=AdvisoryResponse)
def get_advisory(db: Session = Depends(get_session)) -> AdvisoryResponse:
    end = datetime.utcnow()
    start = end - timedelta(days=7)
    return advisor.generate(db, start, end)


@app.get("/habits")
def get_habits(db: Session = Depends(get_session)):
    end = datetime.utcnow()
    start = end - timedelta(days=7)
    return behavior.weekly_patterns(db, start, end)


@app.get("/notifications/templates")
def get_notification_templates(db: Session = Depends(get_session)):
    return notification_config.get_or_create(db)


@app.put("/notifications/templates")
def update_notification_templates(payload: NotificationConfigUpdate, db: Session = Depends(get_session)):
    return notification_config.update(db, payload)


@app.get("/sync/pending")
def get_pending_sync(db: Session = Depends(get_session)):
    return sync_service.pending_events(db)